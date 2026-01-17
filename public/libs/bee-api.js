async function sendTrackingLog(success, errorCode = null, outputSize = 0, realOutputCodec = null) {
    if (IS_MOBILE_APP) {
        return;
    }
    try {
        if (!self.inputOptions) return; // No active conversion context

        const inputUrl = self.inputOptions.input_url;
        const fileInfo = self.fileInfoMap[inputUrl] || {};

        // Input Codec: prefer 'h264', 'h265', etc.
        const inputCodec = fileInfo.videoCodec || 'unknown';
        const inputSize = fileInfo.size || 0;

        // Output Codec: from result or settings
        const outputCodec = realOutputCodec || self.settings?.format_name || 'unknown';

        const trackData = {
            video: {
                filename: self.settings?.output_filename || fileInfo.filename || 'unknown',
                codec: inputCodec,
                size: inputSize,
                // We let backend parse extension/codec from filename or user agent if complex, 
                // but passing basic info helps.
            },
            convert: {
                // "AV1 -> H265" format requested by user (Uppercase)
                format: `${String(inputCodec).toUpperCase()} -> ${String(outputCodec).toUpperCase()}`,
                targetSize: self.settings?.target_size,
                size: outputSize, // Output size
                success: success,
                errorCode: errorCode,
                duration: self.start_time ? Date.now() - self.start_time : 0
            },
            user: {
                isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            }
        };

        // Fire and forget
        fetch('/api/track-convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trackData),
            keepalive: true
        }).catch(e => console.warn('Tracking error:', e));

    } catch (e) {
        console.warn('Tracking setup error:', e);
    }
}

const mainBroadcastChannel = new BroadcastChannel("app_channel");
mainBroadcastChannel.onmessage = async (event) => {
    if (event.data && event.data.type_cmd === CMD_BEE_ERROR_CONFIG_CODER) {

        var is_encoder = event.data.is_encoder;
        if (is_encoder == false && self.settings.videodecoder_enabled != false) {
            if (isConverting == true) {
                currentWorker.postMessage({ type_cmd: CMD_BEE_CANCEL_CONVERT });
            }

            while (isConverting == true) {
                await new Promise(r => setTimeout(r, 100));
            }
            // hideLoadingDialog();
            // hideProgressDialog();
            convertFileWithOptions_New(self.inputOptions, { videodecoder_enabled: false })
        } else {
            isConverting = false; //Reset state để người dùng có thể chọn lại
            hideLoadingDialog();
            hideProgressDialog();
            const msg = event.data.msg || 'Your browser does not support the required video codec for this conversion.';
            showAppError(msg);
            if (window.sendTrackingLog) window.sendTrackingLog(false, 'Timeout 103');
        }
        stopTimeoutConversion();
    } else if (event.data && event.data.type_cmd === CMD_BEE_ERROR) {
        isConverting = false; //Reset state để người dùng có thể chọn lại
        hideLoadingDialog();
        hideProgressDialog();
        showAppError(event.data.msg);
        if (window.sendTrackingLog) window.sendTrackingLog(false, 'Timeout 103');
        stopTimeoutConversion();
    }
};

self.currentWorker = null;
self.fileInfoMap = {};
var isConverting = false;
var isCanceling = false;
var nextTask = null;
var totalBytes = 0;
var worker_pool = [];
let indexWorker = 0;

/**
 * on main thread.
 * @param {*} command
 * @param {*} sessionId
 * @returns {
 *        type_cmd:xxx,
 *        sessionId: self.sessionId,
 *        outputFiles: outputFiles,
 *        logcat: logcat
 *      }
 */
async function runFFmpegCommand(command, settings, onCallBack) {
    while (isReadyLibUrls === false) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    fileStorageDB = new IndexedDBFileStorage();
    await fileStorageDB.init();

    return new Promise(async (resolve, reject) => {
        if (!currentWorker) {
            currentWorker = new Worker(MAIN_THREAD_URL, { name: "main-worker" });
        }

        currentWorker.dataSaveQueue = [];
        totalBytes = 0;
        currentWorker.onmessage = async function (intent) {
            console.log('bee-api receive message from main-thread:', intent.data);
            stopTimeoutConversion()
            var type_cmd = intent.data.type_cmd;

            if (type_cmd === CMD_BEE_READY) {
                isConverting = false;
                isCanceling = false;
                if (nextTask != null) {
                    convertFileWithOptions_New(nextTask.inputOptions, nextTask.defaultOptions);
                    nextTask = null;
                }
                return;
            }

            if (isCanceling == true) {
                return;
            }

            if (type_cmd === CMD_BEE_COMPLETE) {
                console.log("FFmpeg WebWorker is complete.");
                resolve(intent.data);
                isConverting = false;
                convertQueue.length = 0;
                return;
            }

            if (type_cmd === CMD_BEE_UPDATE_PROGRESS || type_cmd === CMD_BEE_ERROR || type_cmd === CMD_BEE_WRITE_FILE) {
                onCallBack && onCallBack(intent.data);
                return;
            }
            isConverting = false;
            convertQueue.length = 0;
            resolve(intent.data);
        };

        currentWorker.onerror = function (err) {
            reject(err);
        };


        start_time = Date.now();
        self.settings = settings;
        self.onCallBack = onCallBack;
        isConverting = true;
        currentWorker.postMessage({
            command: command,
            settings: settings,
            browser_settings: window.browser_settings,
            LIB_URLs: LIB_URLs
        });

    });
}



async function getFileInfo(fileUrl, device = "DESKTOP", clearData = false) {
    handleConversionTimeout(clearData);

    if (self.fileInfoMap[fileUrl]) {
        return self.fileInfoMap[fileUrl];
    }
    let array_cmd = ['-fflags', '+genpts', '-avoid_negative_ts', '1', '-loglevel', 'info', '-i', fileUrl, '-vframes', '1', '-vf', `thumbnail=6,scale=${getScaleWidth(device)}:-1`, '-f', 'mjpeg', 'thumbnail.indb.jpg'];

    var runResult = await runFFmpegCommand(array_cmd, settings = {
        type_cmd: CMD_BEE_GET_INFO
    });

    if (runResult.error == 'decoder_error') {
        runResult = await runFFmpegCommand(array_cmd, settings = {
            type_cmd: CMD_BEE_GET_INFO,
            videodecoder_enabled: false
        });
    }
    var fileInfo = getFileInfoFromString(runResult.logcat.join('\n'));
    console.log('fileInfo ffprobe:', fileInfo);

    if (fileInfo && fileInfo.videoBitRate == 0) {
        //vp9 không có thông tin video bitrate trong ffprobe
        if (fileInfo.audioBitRate == 0) {
            fileInfo.audioBitRate = 128; //128kbps mặc định
        }
        fileInfo.videoBitRate = fileInfo.bitrateTotal - fileInfo.audioBitRate;
    }
    if (runResult.outputFiles.length > 0) {
        const outputFile = runResult.outputFiles[0];
        if (outputFile.name.includes('.indb.')) {
            var fileId = await fileStorageDB.findFileByName(outputFile.name);
            if (fileId) {
                var blob = await fileStorageDB.getFileAsBlob(fileId.id);
                if (clearData) {
                    fileInfo.thumbnail = createBlobUrl(blob, 'thumbnail');
                }
            } else {
                return null;
            }
        } else {
            const blob = new Blob([outputFile.data], { type: 'image/jpeg' });
            if (clearData) {
                fileInfo.thumbnail = createBlobUrl(blob, 'thumbnail');
            }
        }

        //48: Convert xong ==> Close ==> preview ==> net::ERR_FILE_NOT_FOUND

        if (runResult.decoded_format == 119) {
            fileInfo.fmt = "rgb0";
        } else if (runResult.decoded_format == 26) {
            fileInfo.fmt = "rgba";
        } else {
            fileInfo.fmt = "yuv420p";
        }
    } else {
        return null;
    }

    fileInfo.input_url = fileUrl;
    self.fileInfoMap[fileUrl] = fileInfo;
    return fileInfo;
}


function notificationAndroid(type, message) {
    const platform = detectPlatform();
    if (platform.isBeeConvertApp && platform.isAndroid) {
        switch (type) {
            case 'start':
                console.log("Conversion started");
                window.AndroidInterface.onConversionStart();
                break;
            case 'finish':
                console.log("Conversion finished");
                window.AndroidInterface.onConversionFinished();
                break;
            case 'cancel':
                console.log("Conversion cancel");
                window.AndroidInterface.onConversionCancel();
                break;
            case 'fail':
                console.log("Conversion failed");
                window.AndroidInterface.onConversionFailed();
                break;
            case 'progress':
                console.log("Conversion progress:", message);
                window.AndroidInterface.onConversionProgress(message);
                break;
        }
    }
}

let timerConversionTimeout = null;

function handleConversionTimeout(clearData = false) {
    console.log('handleConversionTimeout');
    if (timerConversionTimeout) {
        clearTimeout(timerConversionTimeout);
    }
    timerConversionTimeout = setTimeout(function () {
        hideLoadingDialog();
        hideProgressDialog();
        if (clearData) {
            clearRecentFile();
        }
        if (window.sendTrackingLog) window.sendTrackingLog(false, 'Timeout 103');
        showAppError('An error occurred, please try again (103)', 'error', function () {
            location.reload();
        });
        if (typeof releaseWakeLock === 'function') {
            releaseWakeLock();
        }
    }, 60 * 1000);

}

function stopTimeoutConversion() {
    console.log('stopTimeoutConversion');
    if (timerConversionTimeout) {
        clearTimeout(timerConversionTimeout);
    }
}

/**
 * Convert a file with the specified options.
 */

const convertQueue = [];

function formatTimeHHMMSS(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Fetch data from blob URL with specific position and length
 * @param {string} blobUrl - The blob URL to fetch from
 * @param {number} position - Starting byte position (0-based)
 * @param {number} length - Number of bytes to read (if 0 or omitted, read all remaining bytes)
 * @returns {Promise<{data: Uint8Array, position: number, length: number, totalSize: number}>}
 */
async function fetchBlobInChunks(blobUrl, position = 0, length = 0) {
    try {
        // First, get the total size if we don't have length specified
        if (length === 0) {
            const headResponse = await fetch(blobUrl, { method: 'HEAD' });
            const contentLength = headResponse.headers.get('content-length');
            const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

            if (totalSize === 0) {
                throw new Error('Unable to determine blob size');
            }

            length = totalSize - position;
        }

        // Calculate range
        const start = position;
        const end = position + length - 1;

        // Fetch with Range header
        const response = await fetch(blobUrl, {
            headers: {
                'Range': `bytes=${start}-${end}`
            }
        });

        if (!response.ok && response.status !== 206) {
            throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
        }

        // Get total size from Content-Range header
        const contentRange = response.headers.get('content-range');
        let totalSize = 0;
        if (contentRange) {
            const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
            if (match) {
                totalSize = parseInt(match[1], 10);
            }
        }

        // Read the response as array buffer
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        return {
            data: data,
            position: position,
            length: data.byteLength,
            totalSize: totalSize
        };

    } catch (error) {
        console.error('Error fetching blob chunk:', error);
        throw error;
    }
}

function handleConversionError(msg) {
    hideProgressDialog();
    hideLoadingDialog();
    showAppError(msg);
    if (window.sendTrackingLog) window.sendTrackingLog(false, msg);
    if (typeof releaseWakeLock === 'function') {
        releaseWakeLock();
    }
    stopTimeoutConversion()
}

async function convertFileWithOptions_New(inputOptions, defaultOptions = {}) {

    if (isConverting == true) {
        nextTask = {
            inputOptions,
            defaultOptions
        }
        return;
    }
    isConverting = true;
    await fileStorageDB.deleteAllFiles();
    self.inputOptions = inputOptions;
    window.savedFileUrl = null;

    const msg = validateObj(inputOptions);
    if (msg) {
        isConverting = false; // Reset state khi validation fail
        hideLoadingDialog();
        hideProgressDialog();
        showAppError(msg);
        if (window.sendTrackingLog) window.sendTrackingLog(false, msg);
        return

    }


    //const checkBitrate = inputOptions.target_size ? true : false;
    var { command_list, settings } = await convertUserOptionsToCommand(inputOptions);

    if (command_list === null) {
        isConverting = false; // Reset state để người dùng có thể chọn lại
        hideLoadingDialog();
        hideProgressDialog();
        const errMsg = "Video conversion failed. Please choose compatible video settings and try again.";
        showAppError(errMsg);
        if (window.sendTrackingLog) window.sendTrackingLog(false, errMsg);
        return;
    }

    if (settings.needReencode == true) {
        const isSupported = await isVideoEncoderConfigSupported(settings.format_name, settings.width, settings.height, (settings.fps < 0) ? 25 : settings.fps, settings.bitrate || 0);
        if (isSupported == false) {
            isConverting = false; // Reset state để người dùng có thể chọn lại
            hideLoadingDialog();
            hideProgressDialog();
            const errMsg = "Your browser doesn't support the chosen video settings (resolution or frame rate). Please select different options.";
            showAppError(errMsg);
            if (window.sendTrackingLog) window.sendTrackingLog(false, errMsg);
            return;
        }
    }

    settings = { ...defaultOptions, ...settings };
    handleConversionTimeout()

    showProgressDialog(async function () {
        hideProgressDialog();
        isCanceling = true;
        nextTask = null;
        console.log('********************** cancel call ************************');
        currentWorker.postMessage({ type_cmd: CMD_BEE_CANCEL_CONVERT });
        notificationAndroid('cancel')
        sendTrackingLog(false, 'User Cancelled');
        if (typeof releaseWakeLock === 'function') {
            releaseWakeLock();
        }
        stopTimeoutConversion()
    });

    var start_time = Date.now();

    notificationAndroid('start')


    var callback = function (data) {
        if (data.type_cmd === CMD_BEE_UPDATE_PROGRESS) {
            console.log('updateProgressDialog', data.percent_complete, data.remainingTime, formatTimeHHMMSS(new Date()));
            updateProgressDialog(data.percent_complete, data.remainingTime);
            notificationAndroid('progress', `Video conversion is progressing...${Math.round(data.percent_complete)}%`)
            handleConversionTimeout()
        } else if (data.type_cmd === CMD_BEE_ERROR) {
            isConverting = false; // Reset state để người dùng có thể chọn lại
            hideProgressDialog();
            hideLoadingDialog();
            const errMsg = 'Conversion failed: ' + (data.error || 'Unknown error occurred');
            showAppError(errMsg);
            if (window.sendTrackingLog) window.sendTrackingLog(false, 'Timeout 103');
            if (typeof releaseWakeLock === 'function') {
                releaseWakeLock();
            }
            stopTimeoutConversion()
        }
    };

    for (var i = 0; i < command_list.length; i++) {
        var t = Date.now();
        command = command_list[i];
        updateProgressDialog(0, 0, command.title);

        var runResult = await runFFmpegCommand(command.cmd, settings = { type_cmd: CMD_BEE_CONVERT, start_time: Date.now(), ...settings }, callback);

        if (runResult.error == 'decoder_error') {
            runResult = await runFFmpegCommand(command.cmd, settings = { type_cmd: CMD_BEE_CONVERT, videodecoder_enabled: false, start_time: Date.now(), ...settings }, callback);
        }
        console.log("Time to run command:", Date.now() - t, "ms");
        //  await sleep(2100);
    }

    notificationAndroid('finish')
    stopTimeoutConversion()

    if (runResult.outputFiles && runResult.outputFiles.length > 0) {

        const outputFile = runResult.outputFiles[runResult.outputFiles.length - 1];
        console.log("time to convert:", Date.now() - start_time);

        var url = null;

        if (outputFile.name.includes('.indb.')) {
            var fileId = await fileStorageDB.findFileByName(outputFile.name);
            if (fileId) {
                //var blob = await fileStorageDB.getFileAsBlob(fileId.id);

                url = await fileStorageDB.createStreamingBlobURL(fileId.id);

                // url = createBlobUrl(blob, 'outputVideo');
            }
        } else {
            const blob = new Blob([outputFile.data], { type: 'video/mp4' });
            url = createBlobUrl(blob, 'outputVideo');
        }


        var newFileInfo = await getFileInfo(url);

        if (newFileInfo === undefined) {
            handleConversionError('An error occurred, please try again (104)'); 
            return;
        }

        // var newFileInfo = await getFileInfo(url);

        // hideProgressDialog();
        // hideLoadingDialog();
        // setTimeout(() => {

        //     const button = document.querySelector('.dialog-video-cancel');

        //     if (button) button.click();
        //     clickStartConvert();
        // }, 3500);
        // if(1>0){
        //     return;
        // }



        // ✅ Mở VideoCompleteDialog TRƯỚC khi đóng ProgressDialog
        // để tránh race condition restore scroll
        let platform = detectPlatform();

        // Log Success Here because dialog is about to show
        sendTrackingLog(true, null, newFileInfo.size, newFileInfo.videoCodec);

        const videoCompleteDialog = showVideoDetailDialog(newFileInfo, settings.output_filename.replace('.indb.', '.'), async function (url, name) {

            //khi người dùng bấm nút save.
            if (IS_MOBILE_APP) {
                showLoadingDialog();
                try {
                    let total = 0;
                    let size = 50 * 1024 * 1024; //50MB
                    let pos = 0;
                    let fileName = settings.output_filename.replace('.indb.', '.') || name;

                    do {
                        let { data, length, position, totalSize } = await fetchBlobInChunks(url, pos, size)
                        total = totalSize;
                        pos += length;
                        await postDataToServer(data, position, fileName)
                    } while (pos < total);

                    let res = await postDataToServer([], total, fileName)
                    showBeeToast(res.message);
                } catch (error) {
                    hideLoadingDialog();
                    showAppError('Failed to retrieve video data. Please try again.', 'error');
                } finally {
                    hideLoadingDialog();
                }
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = settings.output_filename.replace('.indb.', '.') || name;
                a.click();
            }

        }, async () => {

        }, "Save", platform.isBeeConvertApp ? 'muted' : '');


        // ✅ Đóng ProgressDialog SAU KHI VideoCompleteDialog đã mở
        // Sử dụng requestAnimationFrame để đảm bảo VideoCompleteDialog đã render
        requestAnimationFrame(() => {
            hideProgressDialog();
            if (typeof releaseWakeLock === 'function') {
                releaseWakeLock();
            }
            stopTimeoutConversion()
        });

    } else {
        hideProgressDialog();
        const errMsg = "Conversion finished but no output file generated.";
        showAppError(errMsg);
        if (window.sendTrackingLog) window.sendTrackingLog(false, 'Timeout 103');

        if (typeof releaseWakeLock === 'function') {
            releaseWakeLock();
        }
        stopTimeoutConversion()
    }
}