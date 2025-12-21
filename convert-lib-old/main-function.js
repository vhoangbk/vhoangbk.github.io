
/**
 * Hiển thị toast notification
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại toast: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Thời gian hiển thị (ms), mặc định 3000ms
 */
function showToast(message, type = 'info', duration = 3000) {
    // Tạo container nếu chưa có
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(toastContainer);
    }

    // Tạo toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Style dựa theo type
    const styles = {
        success: { bg: '#4CAF50', icon: '✓' },
        error: { bg: '#f44336', icon: '✕' },
        warning: { bg: '#ff9800', icon: '⚠' },
        info: { bg: '#2196F3', icon: 'ℹ' }
    };

    const style = styles[type] || styles.info;

    toast.style.cssText = `
        background: ${style.bg};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 250px;
        animation: slideInRight 0.3s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
    `;

    toast.innerHTML = `
        <span style="font-size: 20px; font-weight: bold;">${style.icon}</span>
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.remove()" style="
            background: transparent;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
            opacity: 0.7;
            transition: opacity 0.2s;
        " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">×</button>
    `;

    // Thêm animation CSS nếu chưa có
    if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Thêm vào container
    toastContainer.appendChild(toast);

    // Auto remove sau duration
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}



/**
 * Thục hiện lệnh biến đổi file.
 * @param {*} type_cmd 
 * @param {*} data_cmd 
 * @param {*} callback 
 */
async function executeCommand(type_cmd, data_cmd, callback) {

    if (typeof worker_pool === 'undefined') {
        worker_pool = [];
    }

    if (type_cmd == CMD_CANCEL_CONVERT) {
        for (var i = 0; i < worker_pool.length; i++) {
            try {
                console.log("Terminating worker...", worker_pool[i].name);
                worker_pool[i].terminate();
            } catch (error) {
                console.error("Error terminating worker:", error);
            }
        }
        worker_pool = [];
        if (type_cmd == CMD_CANCEL_CONVERT){
            return;
        }
    }


    var convert_worker = new Worker(FFMPEG_WORKER_URL);
    worker_pool.push(convert_worker);
    convert_worker.type_cmd = type_cmd;
    convert_worker.onmessage = async function (intent) {

        if (intent.data.type_cmd == CMD_GET_FILE_INFO) {
            callback(intent);
            executeCommand(CMD_CANCEL_CONVERT);
        } else if (intent.data.type_cmd == CMD_UPDATE_PROGRESS || intent.data.type_cmd == CMD_NEW_CONVERTED_DATA) {
            callback(intent);
        } else if (intent.data.type_cmd == CMD_ERROR_ENCODER_CONFIG) {
            callback(intent);
            alert_browser_not_supported();
        } else if (intent.data.type_cmd == CMD_ERROR_DECODER_CONFIG) {
            if (!data_cmd.disable_videodecoder) {
                data_cmd.disable_videodecoder = 1;
                executeCommand(type_cmd, data_cmd, callback);
            } else {
                executeCommand(CMD_CANCEL_CONVERT);
                alert_browser_not_supported();
            }
        } else {
            callback(intent);
        }

    }

    if (!self.ffmpeg_url) {
        self.ffmpeg_url = await getBlobUrl(FFMPEG_UTILS_URL);
    }

    var postObj = {
        type_cmd: type_cmd,
        data_cmd: data_cmd,
        app_settings: self.app_settings,
        wasm_url: self.wasm_url,
        ffmpeg_url: self.ffmpeg_url,
        isSharedArrayBufferSupported: isSharedArrayBufferSupported
    }

    convert_worker.postMessage(postObj);
}

// var obj = {
//     "input_url": "blob:http://localhost:8001/5d0b1f2a-8679-478c-908f-f70a32cf5975",
//     "format_name": "h264", //[h264,h265,vp9,av1]
//     "trim": {"startTime": 0,"endTime": 10.08} //hoặc undefined
//     "crop": {width:1920, height:1080, x:0, y:0} //hoặc undefined,
//     "hflip": 0 //0 hoặc 1 hoặc undefined
//     "vflip": 1 //0 hoặc 1 hoặc undefined
//     "volume_level": 1, //từ 1 đến 3 hoặc undefined
//     "fps": -1, //hoặc từ 24 đến 60 hoặc undefined
//     "quality": "Medium",// Low, Medium, High hoặc undefined
//     "target_size":20 // từ 1 đến 1000, in MB hoặc undefined
//     "resolution":{"width":960,"height":540}  // hoặc undefined
// }
/*
note:
- input_url và format_name là bắt buộc, còn lại có thể là undefined. Và nếu như khác undefined thì phải đúng định dạng.
- nếu target_size thoả mãn, thì các lựa chọn resolution, fps, quality sẽ bị bỏ qua. Thư viện sẽ tự động lựa chọn các thông số để đạt được target_size.

*/



function validateObj(obj) {
    const formatNames = ["h264", "h265", "vp9", "av1"];
    const qualities = ["Low", "Medium", "High"];


    if (!(obj.input_url instanceof File) && !(typeof FileSystemFileHandle !== 'undefined' && obj.input_url instanceof FileSystemFileHandle) && typeof obj.input_url !== 'string' && !(obj.input_url instanceof String)) return 'đầu input_url không hợp lệ';
    if (!formatNames.includes(obj.format_name)) return 'đầu format_name không hợp lệ';
    if (obj.trim !== undefined) {
        if (typeof obj.trim !== 'object' || typeof obj.trim.startTime !== 'number' || typeof obj.trim.endTime !== 'number') return 'đầu trim không hợp lệ';
        if (obj.trim.startTime < 0 || obj.trim.endTime <= obj.trim.startTime) return 'đầu trim không hợp lệ';
    }

    if (obj.crop !== undefined) {
        if (typeof obj.crop !== 'object' || typeof obj.crop.width !== 'number' || typeof obj.crop.height !== 'number' || typeof obj.crop.x !== 'number' || typeof obj.crop.y !== 'number') return 'đầu crop không hợp lệ';
        if (obj.crop.width % 2 !== 0 || obj.crop.height % 2 !== 0) return 'đầu crop không hợp lệ';
    }

    if (obj.target_size !== undefined) {
        if (typeof obj.target_size !== 'number' || obj.target_size < 1 || obj.target_size > 1000) return 'đầu target_size không hợp lệ';
    }

    if (obj.resolution !== undefined) {
        if (typeof obj.resolution !== 'object' || typeof obj.resolution.width !== 'number' || typeof obj.resolution.height !== 'number') return 'đầu resolution không hợp lệ';
        if (obj.resolution.width % 2 !== 0 || obj.resolution.height % 2 !== 0) return 'đầu resolution không hợp lệ';
    }

    //cho phép các biến  hflip, vflip, volume_level, fps, quality có thể là undefined
    if (obj.hflip === undefined) obj.hflip = 0;
    if (obj.vflip === undefined) obj.vflip = 0;
    if (obj.volume_level === undefined) obj.volume_level = 1;
    if (obj.fps === undefined) obj.fps = -1;

    if (obj.hflip !== 0 && obj.hflip !== 1) return 'đầu hflip không hợp lệ';
    if (obj.vflip !== 0 && obj.vflip !== 1) return 'đầu vflip không hợp lệ';
    if (typeof obj.volume_level !== 'number' || obj.volume_level < 0 || obj.volume_level > 3) return 'đầu volume_level không hợp lệ';
    if (obj.fps !== -1 && (typeof obj.fps !== 'number' || obj.fps < 10 || obj.fps > 60)) return 'đầu fps không hợp lệ';

}


/**
 * Convert a file with the specified options.
 */
async function convertFileWithOptions(inputOptions) {


    const msg = validateObj(inputOptions);
    if (msg) {
        throw new Error(msg);
    }
    executeCommand(CMD_CANCEL_CONVERT);//terminate previous convert worker if any
    showProgressDialog(function () {
        hideProgressDialog();
        executeCommand(CMD_CANCEL_CONVERT);//terminate previous convert worker if any
        // deleteAllTmpFiles();
        if (window.postDataTimeout) {
            clearTimeout(window.postDataTimeout);
            window.postDataTimeout = null;
        }
    });

    var convertResult = await convertOptionsToCommand(inputOptions);
    if (convertResult.result) {
        window.convertCommand = convertResult.convertCommand;


        start_time_convert = Date.now();
        hasWarningMemoryUpload = false;
        const memoryUploadWarningThreshold = 600 * 1024 * 1024; // 600MB

        //====new implementation====

        var successCallback = async function (intent) {


            if (intent.data.type_cmd == CMD_NEW_CONVERTED_DATA) {

                window.convertCommand.converted_data.push(intent.data.data);
                window.convertCommand.converted_data_length += intent.data.data.length;
                if (IS_MOBILE_APP) {
                    if (!hasWarningMemoryUpload && window.convertCommand.converted_data_length > memoryUploadWarningThreshold) {
                        hasWarningMemoryUpload = true;
                        intent.target.postMessage({
                            type_cmd: CMD_NOTIFY_MEMORY_UPLOAD,
                            hasWarningMemoryUpload: hasWarningMemoryUpload
                        });
                    }
                    window.converted_filename = intent.data.filename;
                    if (!window.postDataTimeout) {
                        window.postDataTimeout = setTimeout(async function postData() {
                            if (window.convertCommand.converted_data.length > 0) {
                                var chunk = window.convertCommand.converted_data.shift();
                                var responseJson = await postDataToServer(chunk, window.converted_filename);
                                window.convertCommand.converted_data_length -= chunk.length;

                                await new Promise(r => setTimeout(r, 20));
                                if (hasWarningMemoryUpload && window.convertCommand.converted_data_length < memoryUploadWarningThreshold / 6) {
                                    hasWarningMemoryUpload = false;
                                    intent.target.postMessage({
                                        type_cmd: CMD_NOTIFY_MEMORY_UPLOAD,
                                        hasWarningMemoryUpload: hasWarningMemoryUpload
                                    });
                                    console.log('hasWarningMemoryUpload === false');
                                }

                                if (chunk.length == 0) {
                                    clearTimeout(window.postDataTimeout);
                                    window.postDataTimeout = null;
                                    let outputUrl = responseJson.url;
                                    let size = responseJson.size;
                                    let format = responseJson.format;
                                    let id = responseJson.id;
                                    showCompletedConvertDialog(outputUrl, size, format, id);
                                } else {
                                    window.postDataTimeout = setTimeout(postData, 100);
                                }
                            } else {
                                window.postDataTimeout = setTimeout(postData, 100);
                            }
                        }, 100);
                    }
                }
            } else if (intent.data.type_cmd == CMD_COMPLETE_CONVERT) {
                console.log('time to convert:', Date.now() - window.convertCommand.start_time);
                if (IS_MOBILE_APP) {
                    window.convertCommand.converted_data.push(new Uint8Array(0));
                } else {

                    var totalLength = window.convertCommand.converted_data_length;
                    console.log('Total converted data length:', totalLength);
                    var mergedArray = new Uint8Array(totalLength);
                    var currentPosition = 0;

                    for (var i = 0; i < window.convertCommand.converted_data.length; i++) {
                        var chunk = window.convertCommand.converted_data[i];
                        mergedArray.set(chunk, currentPosition);
                        currentPosition += chunk.length;
                    }


                    var outputBlob = new Blob([mergedArray], { type: 'application/octet-stream' });
                    var outputUrl = URL.createObjectURL(outputBlob);
                    showCompletedConvertDialog(outputUrl);

                }

            } else if (intent.data.type_cmd == CMD_UPDATE_PROGRESS) {

                var out_time = intent.data.out_time;
                var out_duration = window.convertCommand.output_file.duration;

                var timeLeft = 0;
                var used_time = 0;
                if (out_time > 1) {
                    used_time = Date.now() - window.convertCommand.start_time;
                    var used_time_total = (out_duration / out_time) * used_time;
                    timeLeft = (used_time_total - used_time) / 1000;
                }

                var percent_complete = (out_time / out_duration) * 100;
                updateProgressDialog(Math.min(percent_complete, 99.9), used_time > 5000 ? timeLeft : 0);



            } else if (intent.data.type_cmd == 'conversion_failed') {
                hideProgressDialog();
                showAppError('Conversion failed: ' + (intent.data.error || 'Unknown error occurred'));
            }
        }



        // if (intent.data.type_cmd == CMD_PERFORM_CONVERT) {

        // } else if (intent.data.type_cmd == CMD_UPDATE_PROGRESS) {

        // } else if (intent.data.type_cmd == CMD_FAILED_CONVERT) {
        //     hideProgressDialog();
        //     showAppError('Conversion failed: ' + (intent.data.error || 'Unknown error occurred'));
        // }


        // var cmd_data = {};
        // cmd_data.output_file = window.convertCommand.output_file;
        // cmd_data.type_cmd = window.convertCommand.type_cmd;
        // cmd_data.type = window.convertCommand.type;
        executeCommand(CMD_PERFORM_CONVERT, window.convertCommand, successCallback);

        //====end new implementation====
    } else {
        showAppError(convertResult.msg);
    }
}

async function showCompletedConvertDialog(outputUrl, size, format, id) {
    console.log("showCompletedConvertDialog", outputUrl, size, format, id);
    let result = await getFileInfo(outputUrl);
    if (result == undefined) {
        result = {
            url: `/video-data?id=${id}`,
            length: size,
            mediaCode: format
        };
    }
    console.log("result", result);
    hideProgressDialog();
    let platform = detectPlatform();
    
    const shouldRevoke = outputUrl && outputUrl.startsWith('blob:');
    
    // showVideoDetailDialog(result, function (url, name) {
    //     if (platform.isBeeConvertApp) {
    //         shareItemById(id, name);
    //     } else {
    //         const a = document.createElement('a');
    //         a.href = url;
    //         a.download = name;
    //         a.click();
    //     }
    //     // Revoke outputUrl after save/download
    //     if (shouldRevoke) {
    //         URL.revokeObjectURL(outputUrl);
    //     }
    // }, () => {
    //     if (shouldRevoke) {
    //         URL.revokeObjectURL(outputUrl);
    //     }
    // }, platform.isBeeConvertApp ? "Share" : "Save");
}

function shareItemById(itemId, name) {
  console.log("shareItemById:", itemId, name);
  const platform = detectPlatform();
  if (platform.isBeeConvertApp && platform.isAndroid) {
    window.AndroidInterface.shareVideo(itemId, name);
  } else if (platform.isBeeConvertApp && platform.isIOS) {
    window.webkit.messageHandlers.BeeBridge.postMessage({
      action: "shareVideo",
      id: itemId,
    });
  }
}

