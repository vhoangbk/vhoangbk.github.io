// importScripts('common-utils.js?v=0');
// import all exports as 'commonUtils'
// import * as commonUtils from './common-utils.js';
const mainBroadcastChannel = new BroadcastChannel("app_channel");
mainBroadcastChannel.onmessage = async (event) => {
    if (event.data && event.data.type_cmd === CMD_BEE_ERROR_CONFIG_CODER) {
        var is_encoder = event.data.is_encoder;
        if (is_encoder == false && self.settings.videodecoder_enabled != false) {
            convertFileWithOptions_New(self.inputOptions, { videodecoder_enabled: false })
        } else {
            //need implement: show error unsupport decoder
        }
    } else if (event.data && event.data.type_cmd === CMD_BEE_ERROR) {
        hideLoadingDialog()
        showAppError(event.data.msg)
    }
};

let currentWorker = null;
self.fileInfoMap = {};


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

                const isPostDataDone = data.length === 0 && position === 0;
                if (isPostDataDone) {
                    clearTimeout(window.postDataTimeout);
                    window.postDataTimeout = null;
                    if (writable != null) {
                        await writable.close();
                        var file = await worker.fsFile.getFile();
                        window.savedFileUrl = URL.createObjectURL(file);
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

        if (currentWorker != null) {
            currentWorker.terminate();
            currentWorker = null;
        }
        currentWorker = new Worker(MAIN_THREAD_URL);
        currentWorker.dataSaveQueue = [];

        currentWorker.onmessage = async function (intent) {
            var type_cmd = intent.data.type_cmd;
            if (type_cmd === CMD_BEE_CALL_MAIN) {
                const { id, fn, payload } = intent.data;
                if (fn == 'saveToDisk') {

                    if (!IS_MOBILE_APP) {
                        if (intent.target.fsFile == null) {
                            intent.target.fsFile = await getFSFileByName(payload.filename);
                            if (!(intent.target.fsFile instanceof FileSystemFileHandle)) {

                                if (currentWorker != null) {
                                    currentWorker.terminate();
                                    currentWorker = null;
                                }
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

            if (type_cmd === CMD_BEE_UPDATE_PROGRESS || type_cmd === CMD_BEE_ERROR || type_cmd === CMD_BEE_WRITE_FILE) {
                onCallBack && onCallBack(intent.data);
                return;
            }

            resolve(intent.data);
        };

        currentWorker.onerror = function (err) {
            reject(err);
        };

        if (!self.ffmpeg_url) {
            self.ffmpeg_url = await getBlobUrl(FFMPEG_BEE_LIB_URL);
        }

        if (!self.wasm_url) {
            self.wasm_url = await getBlobUrl(WASM_BEE_LIB_URL);
        }

        start_time = Date.now();
        self.settings = settings;
        self.command = command;
        self.onCallBack = onCallBack;
        currentWorker.postMessage({
            command: command,
            wasm_url: self.wasm_url,
            ffmpeg_url: self.ffmpeg_url,
            settings: settings
        });

    });
}



async function getFileInfo(fileUrl, device = "DESKTOP") {

    if (self.fileInfoMap[fileUrl]) {
        return self.fileInfoMap[fileUrl];
    }
    let array_cmd = ['-loglevel', 'info', '-i', fileUrl, '-vframes', '1', '-vf', `thumbnail=6,scale=${getScaleWidth(device)}:-1`, '-f', 'mjpeg', 'thumbnail.jpg'];

    var runResult = await runFFmpegCommand(array_cmd, settings = {
        type_cmd: CMD_BEE_GET_INFO
    });
    console.log('getFileInfo runResult:', runResult);
    var fileInfo = getFileInfoFromString(runResult.logcat.join('\n'));
    const outputFile = runResult.outputFiles[0];
    const blob = new Blob([outputFile.data], { type: 'image/jpeg' });
    fileInfo.thumbnail = URL.createObjectURL(blob);
    fileInfo.input_url = fileUrl;
    self.fileInfoMap[fileUrl] = fileInfo;
    return fileInfo;
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


    let { command, settings } = await convertUserOptionsToCommand(inputOptions);
    settings = { ...defaultOptions, ...settings };

    showProgressDialog(async function () {
        hideProgressDialog();
        //await executeCommand(CMD_CANCEL_CONVERT);//terminate previous convert worker if any

        if (currentWorker != null) {
            currentWorker.terminate();
        }
    });

    var start_time = Date.now();
    var runResult = await runFFmpegCommand(command, settings = { type_cmd: CMD_BEE_CONVERT, start_time: Date.now(), ...settings }, function (data) {
        //  console.log('write file:', data.type_cmd);

        if (data.type_cmd === CMD_BEE_UPDATE_PROGRESS) {
            updateProgressDialog(data.percent_complete, data.remainingTime);
        } else if (data.type_cmd === CMD_BEE_ERROR) {
            hideProgressDialog();
            showAppError('Conversion failed: ' + (data.error || 'Unknown error occurred'));
        }
    });

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
            url = URL.createObjectURL(blob);
        }

        var newFileInfo = await getFileInfo(url);
        
        // ✅ Mở VideoCompleteDialog TRƯỚC khi đóng ProgressDialog
        // để tránh race condition restore scroll
        let platform = detectPlatform();
        const videoCompleteDialog = showVideoDetailDialog(newFileInfo, settings.output_filename, async function (url, name) {
            //khi người dùng bấm nút save.
            if (outputFile.isVideoOnDisk == true) {
                console.log('Video file is already saved on disk.');
                return;
            } else {
                if (IS_MOBILE_APP) {
                    uploadToServer(outputFile.data, outputFile.name);
                } else {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = settings.output_filename || name;
                    a.click();
                }
            }

        }, async () => {
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
        });

    } else {
        hideProgressDialog();
    }
}