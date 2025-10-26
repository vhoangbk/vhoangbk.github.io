
/**
 * @key: Lấy thông tin chi tiết về file
 * @param {*} inputUrl: có thể là http||blob:http||file , convert File to Blob Url: var blobURL = URL.createObjectURL(input_file);
 * @returns json {width,height,duration,video_codec,audio_codec,bitrate,frame_rate,rotation,has_audio,has_video,thumbnail}
 */
async function getFileInfo(inputUrl) {
    let input_id = getInputId(inputUrl);

    if (typeof cachedFileInfo === 'undefined') {
        cachedFileInfo = {};
    }


    if (cachedFileInfo[input_id]) {
        return cachedFileInfo[input_id];
    }

    let _resolve;
    let cmd_array = ['-loglevel', 'debug', '-i', inputUrl, '-vframes', '1', '-vf', 'scale=160:-1', 'thumbnail.jpg'];
    let result = {};

    let callback = async function (intent) {
        if (intent.data.cmd == CMD_GET_FILE_INFO) {
            try {
                result = await extractInfo(intent.data.value.join('\n'), inputUrl, intent.data.thumbnail);
            } catch (error) {

            }
            _resolve('finish');
        }
    }
    var cmd_data = {};
    cmd_data.cmd = cmd_array;
    executeCommand(CMD_GET_FILE_INFO, cmd_data, callback, inputUrl);
    await new Promise((resolve, reject) => {
        _resolve = resolve;
    });

    cachedFileInfo[input_id] = result;
    return result;
}

/**
 * Thục hiện lệnh biến đổi file.
 * @param {*} cmd 
 * @param {*} cmd_data 
 * @param {*} callback 
 */
async function executeCommand(cmd, cmd_data, callback) {

    if (cmd == CMD_CANCEL_CONVERT) {
        for (var i = 0; i < worker_pool.length; i++) {
            worker_pool[i].terminate();
        }
        worker_pool = [];
        return;
    }

    if (typeof worker_pool === 'undefined') {
        worker_pool = [];
    }
    // debugger;
    var convert_worker = new Worker(FFMPEG_WORKER_URL);
    worker_pool.push(convert_worker);
    convert_worker.cmd = cmd;
    convert_worker.output_index = cmd_data.cmd_component_index;
    convert_worker.onmessage = async function (intent) {

        if (intent.data.cmd == CMD_GET_FILE_INFO) {
            callback(intent);
        } else if (intent.data.cmd == CMD_UPDATE_PROGRESS) {
            callback(intent);
        } else if (intent.data.cmd == CMD_ERROR_ENCODER_CONFIG) {
            executeCommand(CMD_CANCEL_CONVERT);
            alert_browser_not_supported();
        } else if (intent.data.cmd == CMD_ERROR_DECODER_CONFIG) {
            intent.target.terminate();
            if (!cmd_data.disable_videodecoder) {
                cmd_data.disable_videodecoder = 1;
                executeCommand(cmd, cmd_data, callback);
            } else {
                executeCommand(CMD_CANCEL_CONVERT);
                alert_browser_not_supported();

            }
        } else {
            intent.output_index = intent.target.output_index;
            callback(intent);
        }

    }

    var postObj = {
        cmd: cmd,
        value: cmd_data,
        app_settings: window.app_settings,
        wasm_url: window.wasm_url
    }

    convert_worker.postMessage(postObj);
}

// var obj = {
//     "blob_url": "blob:http://localhost:8001/5d0b1f2a-8679-478c-908f-f70a32cf5975",
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
- blob_url và format_name là bắt buộc, còn lại có thể là undefined. Và nếu như khác undefined thì phải đúng định dạng.
- nếu target_size thoả mãn, thì các lựa chọn resolution, fps, quality sẽ bị bỏ qua. Thư viện sẽ tự động lựa chọn các thông số để đạt được target_size.

*/



function validateObj(obj) {
    const formatNames = ["h264", "h265", "vp9", "av1"];
    const qualities = ["Low", "Medium", "High"];


    if (!(obj.blob_url instanceof File) && !(typeof FileSystemFileHandle !== 'undefined' && obj.blob_url instanceof FileSystemFileHandle) && typeof obj.blob_url !== 'string' && !(obj.blob_url instanceof String)) return 'đầu blob_url không hợp lệ';
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
    if (obj.fps !== -1 && (typeof obj.fps !== 'number' || obj.fps < 24 || obj.fps > 60)) return 'đầu fps không hợp lệ';

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
        deleteAllTmpFiles();
    });

    var convertResult = await convertOptionsToCommand(inputOptions);
    if (convertResult.result) {
        window.convertCommand = convertResult.convertCommand;


        for (var i = 0; i < window.convertCommand.segmentConversionData.length; i++) {


            for (var j = 0; j < window.convertCommand.segmentConversionData[i].length; j++) {
                var streamConversionData = window.convertCommand.segmentConversionData[i][j];
                // Process each command as needed

                var successCallback = async function (intent) {

                    if (intent.data.cmd == CMD_PERFORM_CONVERT) {

                        var stream_index = intent.data.stream_index;
                        var segment_index = intent.data.segment_index;


                        const updateOutputUrl = async function (stream_index, segment_index, url) {
                            //stream nào đó vừa mới hoàn thành convert.
                            if (stream_index >= 0 && segment_index >= 0) {
                                var currentStream = window.convertCommand.segmentConversionData[segment_index][stream_index];
                                currentStream.output_url = url;

                                //tất cả các stream trong segment này đã hoàn thành convert.
                                if (window.convertCommand.segmentConversionData[segment_index].every(item => item.output_url !== undefined)) {

                                    var output_name = currentStream.output_url.name || currentStream.output_url;

                                    //nếu segment này chỉ có 1 stream, stream này đã hoàn thành và ko cần làm gì thêm nữa.
                                    if (window.convertCommand.segmentConversionData[segment_index].length == 1 && (output_name.endsWith('.mp4') || output_name.endsWith('.webm'))) {
                                        updateOutputUrl(segment_index, -1, currentStream.output_url);
                                    } else {

                                        const { format } = window.convertCommand.output_file;
                                        const is_h265 = format === 'libx265', is_h264 = format === 'libx264', is_vp9 = format === 'vp9';

                                        var cmd_component = [];

                                        for (var i = 0; i < window.convertCommand.segmentConversionData[segment_index].length; i++) {

                                            if ((is_h265 || is_h264)) {

                                                cmd_component.push('-r');
                                                cmd_component.push('' + window.convertCommand.output_file.fps);
                                            }
                                            cmd_component.push('-i');
                                            var output_url_in = window.convertCommand.segmentConversionData[segment_index][i].output_url;
                                            if (typeof FileSystemFileHandle !== 'undefined' && output_url_in instanceof FileSystemFileHandle) {
                                                output_url_in = URL.createObjectURL(await output_url_in.getFile());
                                            }
                                            cmd_component.push(output_url_in);

                                        }

                                        cmd_component.push('-c');
                                        cmd_component.push('copy');

                                        if (is_h265) {
                                            cmd_component.push('-tag:v');
                                            cmd_component.push('hvc1');
                                        } else if (is_h264) {
                                            cmd_component.push('-tag:v');
                                            cmd_component.push('avc1');
                                        }
                                        if (window.convertCommand.saveToDisk == true) {

                                            var tmp_output_file = await getFSFileByExtension(window.convertCommand.output_file == 'vp9' ? ".webm" : ".mp4");
                                            if (tmp_output_file) {
                                                cmd_component.push(tmp_output_file);
                                            } else {
                                                cmd_component.push(window.convertCommand.output_file == 'vp9' ? 'complete-output.webm' : 'complete-output.mp4');
                                            }
                                        } else {
                                            if (is_vp9) {
                                                cmd_component.push('complete-output.webm');
                                            } else {
                                                cmd_component.push('complete-output.mp4');
                                            }
                                        }

                                        var cmd_data = {};
                                        cmd_data.stream_index = -1;
                                        cmd_data.segment_index = segment_index;
                                        cmd_data.cmd = cmd_component;
                                        executeCommand(CMD_PERFORM_CONVERT, cmd_data, successCallback);
                                    }
                                }

                            } else if (segment_index >= 0 && stream_index < 0) {

                                // tất cả các stream trong segment_index đã hoàn thành.
                                window.convertCommand.segmentConversionData[segment_index].output_url = url;

                                //nếu như tất cả các segment đều hoàn thành.
                                if (window.convertCommand.segmentConversionData.every(item => item.output_url !== undefined)) {

                                    //nếu chỉ có 1 segment
                                    if (window.convertCommand.segmentConversionData.length == 1) {
                                        updateOutputUrl(-1, -1, url);
                                    } else {  //nếu có nhiều segment thì phải concat chúng lại.
                                        function textToFile(text, filename = 'file.txt', mimeType = 'text/plain') {
                                            return new File([text], filename, { type: mimeType });
                                        }


                                        const listContent = [];
                                        const concat_files = [];
                                        for (var i = 0; i < window.convertCommand.segmentConversionData.length; i++) {
                                            var tmp_url = window.convertCommand.segmentConversionData[i].output_url
                                            tmp_url = (typeof FileSystemFileHandle !== 'undefined' && tmp_url instanceof FileSystemFileHandle) ? URL.createObjectURL(await tmp_url.getFile()) : tmp_url;
                                            tmp_url = encodeURIComponent(tmp_url);
                                            concat_files.push(tmp_url);
                                            listContent.push(`file '${tmp_url}'`);
                                        }



                                        var listFile = textToFile(listContent.join('\n'), 'list.txt', 'text/plain');

                                        var cmdArray = [
                                            '-f', 'concat',
                                            '-safe', '0',
                                            '-i', listFile,
                                            '-c', 'copy'
                                        ];

                                        if (window.convertCommand.saveToDisk == true) {

                                            var tmp_output_file = await getFSFileByExtension(window.convertCommand.output_file == 'vp9' ? ".webm" : ".mp4");
                                            if (!tmp_output_file) {
                                                return { result: false, msg: 'No folder selected to save the file.' };
                                            }
                                            cmdArray.push(tmp_output_file);
                                        } else {
                                            if (window.convertCommand.output_file == 'vp9') {
                                                cmdArray.push('complete-output.webm');
                                            } else {
                                                cmdArray.push('complete-output.mp4');
                                            }
                                        }

                                        var cmd_data = {};
                                        cmd_data.stream_index = -1;
                                        cmd_data.segment_index = -1;
                                        cmd_data.concat_files = concat_files;
                                        cmd_data.cmd = cmdArray;
                                        executeCommand(CMD_PERFORM_CONVERT, cmd_data, successCallback);
                                    }
                                }
                            } else {
                                console.log('time to convert:', Date.now() - window.convertCommand.start_time);
                                window.convertCommand.output_url = url;
                                if (typeof FileSystemFileHandle !== 'undefined' && url instanceof FileSystemFileHandle) {
                                    url = URL.createObjectURL(await url.getFile());
                                }

                                var result = await getFileInfo(url);
                                hideProgressDialog();
                                showVideoDetailDialog(result, async function (url, name) {

                                    if (typeof FileSystemFileHandle !== 'undefined' && window.convertCommand.output_url instanceof FileSystemFileHandle) {
                                        deleteAllTmpFiles(window.convertCommand.output_url.name);
                                        showToast(`File "${window.convertCommand.output_url.name}" has been saved!`, 'success', 3000);
                                    } else {
                                        await handleFileOutput(url, name);
                                    }
                                }, () => {
                                    console.log('closed video detail dialog');
                                    if (typeof FileSystemFileHandle !== 'undefined' && window.convertCommand.output_url instanceof FileSystemFileHandle) {
                                        deleteAllTmpFiles();
                                    }
                                });
                            }
                        };
                        updateOutputUrl(stream_index, segment_index, intent.data.value[0].blob_url);


                    } else if (intent.data.cmd == CMD_UPDATE_PROGRESS) {

                        var stream_index = intent.data.stream_index;
                        if (stream_index == 0) {
                            var segment_index = intent.data.segment_index;
                            window.convertCommand.segmentConversionData[segment_index][stream_index].percent_complete = intent.data.percentage;
                            var totalPercentage = 0;

                            for (var m = 0; m < window.convertCommand.segmentConversionData.length; m++) {
                                totalPercentage = totalPercentage + window.convertCommand.segmentConversionData[m][stream_index].percent_complete;
                            }
                            var totalUsedTime = Date.now() - window.convertCommand.start_time;
                            var timeLeft = totalPercentage > 0 ? (window.convertCommand.output_file.numberOfSegment * 100 - totalPercentage) * totalUsedTime / totalPercentage : 0;
                            timeLeft = timeLeft / 1000;
                            updateProgressDialog(Math.min(totalPercentage, 99.9), totalUsedTime > 5000 ? timeLeft : 0);
                        }


                    } else if (intent.data.cmd == 'conversion_failed') {
                        hideProgressDialog();
                        showAppError('Conversion failed: ' + (intent.data.error || 'Unknown error occurred'));
                    }
                }

                var cmd_data = {};
                cmd_data.output_file = window.convertCommand.output_file;
                cmd_data.stream_index = streamConversionData.stream_index;
                cmd_data.segment_index = streamConversionData.segment_index;
                cmd_data.cmd = streamConversionData.cmd;
                executeCommand(CMD_PERFORM_CONVERT, cmd_data, successCallback);
            }
        }

        start_time_convert = Date.now();
    } else {
        showAppError(convertResult.msg);
    }
}

