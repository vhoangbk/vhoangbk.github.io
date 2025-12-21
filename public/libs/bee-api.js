const mainBroadcastChannel = new BroadcastChannel("app_channel");
mainBroadcastChannel.onmessage = async (event) => {
    if (event.data && event.data.type_cmd === CMD_BEE_ERROR_CONFIG_CODER) {
        debugger;
        var is_encoder = event.data.is_encoder;
        if (is_encoder == false && self.settings.videodecoder_enabled != false) {
            convertFileWithOptions_New(self.inputOptions, { videodecoder_enabled: false })
        } else {
            hideLoadingDialog();
            hideProgressDialog();
            showAppError(event.data.msg || 'Your browser does not support the required video codec for this conversion.');
        }
    } else if (event.data && event.data.type_cmd === CMD_BEE_ERROR) {
        hideLoadingDialog();
        hideProgressDialog();
        showAppError(event.data.msg);
    }
};

self.currentWorker = null;
self.fileInfoMap = {};
var isReadyLib = false;


function saveToDisk(worker, filename, position, data, writable) {

    var dataSaveQueue = worker.dataSaveQueue;
    var writable = worker.writable;

    dataSaveQueue.push({ filename, position, data });

    if (!window.postDataTimeout) {
        window.postDataTimeout = setTimeout(async function postData() {
            if (dataSaveQueue.length > 0) {
                var { filename, data, position } = dataSaveQueue.shift();

                if (writable != null) {
                    await writable.write({ type: 'write', position: position, data: data });
                } else {
                    var responseJson = await postDataToServer(data, position, filename);
                }
                console.log('Saved data chunk at position:', position, responseJson);
                const isPostDataDone = data.length === 0 && position === 0;
                if (isPostDataDone) {
                    clearTimeout(window.postDataTimeout);
                    window.postDataTimeout = null;
                    if (writable != null) {
                        await writable.close();
                        var file = await worker.fsFile.getFile();
                        window.savedFileUrl = createBlobUrl(file, 'savedFileUrl');
                    } else {
                        //mobile app
                        window.savedFileUrl = responseJson.url;
                    }

                } else {
                    window.postDataTimeout = setTimeout(postData, 100);
                }
            } else {
                window.postDataTimeout = setTimeout(postData, 100);
            }
        }, 100);
    }

    if (dataSaveQueue.length > 20) {
        return { await: true };
    } else {
        return { await: false };
    }
}

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
    return new Promise(async (resolve, reject) => {

        if (!currentWorker) {
            currentWorker = new Worker(MAIN_THREAD_URL);
        }

        currentWorker.dataSaveQueue = [];
        currentWorker.onmessage = async function (intent) {
            var type_cmd = intent.data.type_cmd;
            if (type_cmd === CMD_BEE_GET_DATA) {
                var { fd, pos, size, filename } = intent.data;

                const slice = APP_STATE.selectedFile.slice(pos, pos + size);
                const arrayBuffer = await slice.arrayBuffer();
                const buf = new Uint8Array(arrayBuffer);

                intent.target.postMessage({
                    type_cmd: CMD_BEE_GET_DATA_RESPONSE,
                    fd: fd,
                    pos: pos,
                    data: buf,
                    filename: filename
                }, [buf.buffer]);
                return;
            }
            if (type_cmd === CMD_BEE_CALL_MAIN) {
                const { id, fn, payload } = intent.data;
                if (fn == 'saveToDisk') {

                    if (!IS_MOBILE_APP) {
                        if (intent.target.fsFile == null) {
                            intent.target.fsFile = await getFSFileByName(payload.filename);
                            if (!(intent.target.fsFile instanceof FileSystemFileHandle)) {
                                hideProgressDialog();
                                hideLoadingDialog();
                                if (typeof intent.target.fsFile == 'string') {
                                    showAppError(intent.target.fsFile)
                                }
                                return;
                            }
                            intent.target.writable = await intent.target.fsFile.createWritable();
                        }
                    }
                    var saveResult = saveToDisk(intent.target, payload.filename, payload.position, payload.data);
                    currentWorker.postMessage({ type_cmd: CMD_BEE_CALL_MAIN_RESPONSE, id, saveResult });
                    return;
                }

                if (fn == 'getSavedFileUrl') {
                    while (window.savedFileUrl == null) {
                        await new Promise(r => setTimeout(r, 100));
                    }
                    var saveResult = { fileUrl: window.savedFileUrl };
                    currentWorker.postMessage({ type_cmd: CMD_BEE_CALL_MAIN_RESPONSE, id, saveResult });
                    return;
                }

                return;
            }

            if (type_cmd === CMD_BEE_COMPLETE) {
                resolve(intent.data);
                return;
            }

            if (type_cmd === CMD_BEE_READY) {
                isReadyLib = true;
                return;
            }

            if (type_cmd === CMD_BEE_UPDATE_PROGRESS || type_cmd === CMD_BEE_ERROR || type_cmd === CMD_BEE_WRITE_FILE) {
                onCallBack && onCallBack(intent.data);
                return;
            }

            resolve(intent.data);
        };

        currentWorker.onerror = function (err) {
            reject(err);
        };


        start_time = Date.now();
        self.settings = settings;
        self.command = command;
        self.onCallBack = onCallBack;

        currentWorker.postMessage({
            command: command,
            settings: settings
        });

    });
}



async function getFileInfo(fileUrl, device = "DESKTOP") {

    if (fileUrl instanceof File) {
        fileUrl = 'file--|--' + fileUrl.name + '--|--' + fileUrl.size;
    }
    if (self.fileInfoMap[fileUrl]) {
        return self.fileInfoMap[fileUrl];
    }
    let array_cmd = ['-loglevel', 'info', '-i', fileUrl, '-vframes', '1', '-vf', `thumbnail=8,scale=${getScaleWidth(device)}:-1`, '-f', 'mjpeg', 'thumbnail.jpg'];

    var runResult = await runFFmpegCommand(array_cmd, settings = {
        type_cmd: CMD_BEE_GET_INFO
    });

    var fileInfo = getFileInfoFromString(runResult.logcat.join('\n'));
    if (fileInfo && fileInfo.videoBitRate == 0) {
        //vp9 không có thông tin video bitrate trong ffprobe
        if (fileInfo.audioBitRate == 0) {
            fileInfo.audioBitRate = 128; //128kbps mặc định
        }
        fileInfo.videoBitRate = fileInfo.bitrateTotal - fileInfo.audioBitRate;
    }
    //debugger;
    if (runResult.outputFiles.length > 0) {
        const outputFile = runResult.outputFiles[0];
        const blob = new Blob([outputFile.data], { type: 'image/jpeg' });
        fileInfo.thumbnail = createBlobUrl(blob, 'thumbnail');
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

/**
 * Convert a file with the specified options.
 */
async function convertFileWithOptions_New(inputOptions, defaultOptions = {}) {
    self.inputOptions = inputOptions;
    window.savedFileUrl = null;


    const msg = validateObj(inputOptions);
    if (msg) {
        throw new Error(msg);
    }

    //  debugger;
    const checkBitrate = inputOptions.target_size ? true : false;
    var { command, settings } = await convertUserOptionsToCommand(inputOptions, checkBitrate, 1);

    if (command === null) {
        showAppError("Video conversion failed. Please choose compatible video settings and try again.");
        return;
    }

    if (settings.needReencode == true) {
        const isSupported = await isVideoEncoderConfigSupported(settings.format_name, settings.width, settings.height, (settings.fps < 0) ? 25 : settings.fps, settings.bitrate || 0);
        if (isSupported == false) {
            showAppError("Your browser doesn't support the chosen video settings (resolution or frame rate). Please select different options.");
            return;
        }
    }

    settings = { ...defaultOptions, ...settings };

    showProgressDialog(async function () {
        hideProgressDialog();
        currentWorker.postMessage({ type_cmd: CMD_BEE_CANCEL_CONVERT });
        notificationAndroid('cancel')
        if (typeof releaseWakeLock === 'function') {
            releaseWakeLock();
        }
    });

    var start_time = Date.now();

    notificationAndroid('start')

    if (checkBitrate == true && 1 > 0) {
        var runResult = await runFFmpegCommand(command, settings = { type_cmd: CMD_BEE_CONVERT, start_time: Date.now(), ...settings }, function (data) {
            if (data.type_cmd === CMD_BEE_ERROR) {
                hideProgressDialog();
                showAppError('Conversion failed: ' + (data.error || 'Unknown error occurred'));
                if (typeof releaseWakeLock === 'function') {
                    releaseWakeLock();
                }

                return;
            }
        });


        // if(1>0){
        //     return;
        // }


        var bitrateScale = settings.videoBitRate / runResult.output_info.bitrate;
        //bitrateScale = bitrateScale * 0.9;
        var { command, settings } = await convertUserOptionsToCommand(inputOptions, false, bitrateScale);

    }
    var { command, settings } = await convertUserOptionsToCommand(inputOptions, false, 1);
    var runResult = await runFFmpegCommand(command, settings = { type_cmd: CMD_BEE_CONVERT, start_time: Date.now(), ...settings }, function (data) {
        console.log('write file:', data.type_cmd);

        if (data.type_cmd === CMD_BEE_UPDATE_PROGRESS) {
            updateProgressDialog(data.percent_complete, data.remainingTime);
            notificationAndroid('progress', `Video conversion is progressing...${Math.round(data.percent_complete)}%`)
        } else if (data.type_cmd === CMD_BEE_ERROR) {
            hideProgressDialog();
            showAppError('Conversion failed: ' + (data.error || 'Unknown error occurred'));
            if (typeof releaseWakeLock === 'function') {
                releaseWakeLock();
            }
        }
    });

    notificationAndroid('finish')

    if (runResult.outputFiles && runResult.outputFiles.length > 0) {

        //debugger;
        // console.log("time to convert:", Date.now() - start_time);
        const outputFile = runResult.outputFiles[runResult.outputFiles.length - 1];
        console.log("time to convert:", Date.now() - start_time);

        var url = null;
        if (outputFile.fileUrl) {
            url = outputFile.fileUrl;
        } else {
            const blob = new Blob([outputFile.data], { type: 'video/mp4' });
            url = createBlobUrl(blob, 'outputVideo');
        }

        var newFileInfo = await getFileInfo(url);

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
        const videoCompleteDialog = showVideoDetailDialog(newFileInfo, 'test.mp4', async function (url, name) {
            //khi người dùng bấm nút save.
            if (!outputFile) {
                console.error('outputFile is undefined');
                if (IS_MOBILE_APP) {
                    console.log('Cannot save: outputFile is undefined');
                } else {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'test.mp4';
                    a.click();
                }
                return;
            }

            if (outputFile.isVideoOnDisk == true) {
                console.log('Video file is already saved on disk.');
                return;
            } else {
                if (IS_MOBILE_APP) {
                    showLoadingDialog();
                    await uploadToServer(outputFile.data, outputFile.name);
                    hideLoadingDialog();
                } else {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'test.mp4';
                    a.click();
                }
            }

        }, async () => {
            // ✅ Kiểm tra outputFile có tồn tại trước khi truy cập property
            if (!outputFile) {
                console.error('outputFile is undefined in onClose callback');
                return;
            }

            if (outputFile.isVideoOnDisk == true) {
                if (IS_MOBILE_APP) {
                    let id = new URL(url).searchParams.get("id");
                    if (id) {
                        callApiDeleteVideo(id);
                    }
                } else {
                    await deleteFileSystemByName(outputFile.name);
                }
            }
        }, "Save", platform.isBeeConvertApp ? 'muted' : '');


        // ✅ Đóng ProgressDialog SAU KHI VideoCompleteDialog đã mở
        // Sử dụng requestAnimationFrame để đảm bảo VideoCompleteDialog đã render
        requestAnimationFrame(() => {
            hideProgressDialog();
            if (typeof releaseWakeLock === 'function') {
                releaseWakeLock();
            }
        });

    } else {
        hideProgressDialog();
        if (typeof releaseWakeLock === 'function') {
            releaseWakeLock();
        }
    }
}
if(isReadyLib==false)
runFFmpegCommand([], settings = { type_cmd: CMD_BEE_READY }, null);