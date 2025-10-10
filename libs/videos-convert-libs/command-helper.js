/**
 * Thục hiện lệnh biến đổi file.
 * @param {*} cmd 
 * @param {*} cmd_data 
 * @param {*} callback 
 */
async function executeCommand(cmd, cmd_data, callback, input) {

    // if (cmd == CMD_CANCEL_CONVERT) {
    //     if (window.convert_worker) {
    //         window.convert_worker.terminate();
    //         window.convert_worker = null;
    //     }
    // }

    var convert_worker = new Worker(FFMPEG_WORKER_URL);
    convert_worker.cmd = cmd;
    convert_worker.output_index = cmd_data.cmd_component_index;
    convert_worker.onmessage = async function (intent) {

        if (intent.data.cmd == CMD_GET_FILE_INFO) {
            callback(intent);
        } else if (intent.data.cmd == CMD_UPDATE_PROGRESS) {
            callback(intent);
        } else if (intent.data.cmd == CMD_ERROR_ENCODER_CONFIG) {
            alert_browser_not_supported();
        } else if (intent.data.cmd == CMD_ERROR_DECODER_CONFIG) {
            intent.target.terminate();
            if (!cmd_data.disable_videodecoder) {
                cmd_data.disable_videodecoder = 1;
                executeCommand(cmd, cmd_data, callback);
            } else {
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
    postObj.input_files = {};
    if (input && input instanceof File) {
        postObj.input_files[input.name] = input;
    }
    convert_worker.postMessage(postObj);
}

/**
 * 
 * @param {*} input_option 
 * input_option.input_object = [File, url, blob url];
 * 
 * 
 * 
 * 
 * @returns 
 */
async function convertOptionsToCommand(input_option) {
    // Helper functions
    const getNumber = v => typeof v === 'number' ? v : -99999999;
    const makeEven = v => 2 * Math.round(v / 2);
    const dec = (fl, d = 2) => Math.round(fl * Math.pow(10, d)) / Math.pow(10, d);
    const getCodecId = name => ({ h264: 27, h265: 173, av1: 226, vp9: 167 })[name];
    const ffmpegLibNameMap = { h264: 'libx264', h265: 'libx265', av1: 'libaom-av1', vp9: 'libvpx-vp9' };
    // Get file info and settings

    const fileInfo = await getFileInfo(input_option.blob_url);
    console.log("file-info", fileInfo);
    const outputDuration = input_option.trim ? dec(input_option.trim.endTime, 2) - dec(input_option.trim.startTime, 2) : fileInfo.duration;
    console.log("outputDuration", outputDuration);
    let outputVideoFormat = "h264";
    let outputAudioFormat = "aac"; // đối với vp9 là opus còn lại đều là aac
    let outputWidth = fileInfo.streams[fileInfo.video_stream_index].width;
    let outputHeight = fileInfo.streams[fileInfo.video_stream_index].height;
    let needEncodeAudio = false;
    let outputFps = -1, outputAudioBitrate = -1, outputVideoBitrate = -1;
    let aspect = `${outputWidth}:${outputHeight}`; //aspect sẽ không đổi, chỉ đổi khi crop.
    let startTime = -1;
    let endTime = -1;
    let outputFileInfo = {};
    // Resolution option
    if (input_option.resolution) {
        if (getNumber(input_option.resolution.width) >= 80 && getNumber(input_option.resolution.height) >= 80) {
            input_option.resolution.width = makeEven(input_option.resolution.width);
            input_option.resolution.height = makeEven(input_option.resolution.height);
            outputWidth = input_option.resolution.width;
            outputHeight = input_option.resolution.height;
        } else {
            input_option.resolution = null;
        }
    }

    if (input_option.trim) {
        startTime = dec(input_option.trim.startTime, 2);
        endTime = dec(input_option.trim.endTime, 2);
    }

    const videoCodecId = getCodecId(input_option.format_name);

    outputVideoFormat = ffmpegLibNameMap[input_option.format_name];
    outputAudioFormat = input_option.format_name === 'vp9' ? "libopus" : "aac";

    var all_convert_cmd = [];
    //process video stream
    if (fileInfo.video_stream_index >= 0) {
        var video_convert_cmd = [];
        if (startTime > 0) {
            video_convert_cmd.push('-ss', startTime);
        }

        if (endTime != fileInfo.duration && endTime > 0) {
            video_convert_cmd.push('-to', endTime);
        }


        video_convert_cmd.push('-i', input_option.blob_url);

        //encode-video
        video_convert_cmd.push('-c:v', outputVideoFormat);
        if (input_option.format_name === 'vp9') {
            video_convert_cmd.push('-strict', '-2');
        }
        if (input_option.format_name === 'av1') video_convert_cmd.push('-pix_fmt', 'yuv420p');


        // Video filters
        const vf = [];
        if (input_option.rotate && getNumber(input_option.rotate)) vf.push('rotate=' + dec(3.14 * input_option.rotate / 180));
        if (input_option.crop && getNumber(input_option.crop.width) >= 80 && getNumber(input_option.crop.height) >= 80 && getNumber(input_option.crop.x) >= 0 && getNumber(input_option.crop.y) >= 0) {
            input_option.crop.width = makeEven(input_option.crop.width);
            input_option.crop.height = makeEven(input_option.crop.height);
            vf.push(`crop=${input_option.crop.width}:${input_option.crop.height}:${input_option.crop.x}:${input_option.crop.y}`);
            aspect = `${input_option.crop.width}:${input_option.crop.height}`;
            if (!input_option.resolution) {
                outputWidth = input_option.crop.width;
                outputHeight = input_option.crop.height;
            }
        }
        if (input_option.hflip) vf.push('hflip');
        if (input_option.vflip) vf.push('vflip');
        if (vf.length > 0) video_convert_cmd.push('-vf', vf.join(','));

        // Target size logic

        if (getNumber(input_option.target_size) > 0) {

            let targetSizeInBit = input_option.target_size * 1024 * 1024 * 8 * 0.9;
            if (fileInfo.audio_stream_index >= 0) {
                let maxAudioRatio = 0.5;
                let maxAudioBitrate = dec(targetSizeInBit * maxAudioRatio / outputDuration, 0);
                let streamAudioBitrate = fileInfo.streams[fileInfo.audio_stream_index].bitrate > 0 ? fileInfo.streams[fileInfo.audio_stream_index].bitrate : 128;
                if (maxAudioBitrate < 64 * 1024) return { result: false, msg: 'Target-Size too small' };
                if (1024 * streamAudioBitrate > maxAudioBitrate) {
                    outputAudioBitrate = maxAudioBitrate;
                    needEncodeAudio = true;
                    targetSizeInBit *= (1 - maxAudioRatio);
                } else {
                    targetSizeInBit -= 1024 * streamAudioBitrate * outputDuration;
                    if (fileInfo.streams[fileInfo.audio_stream_index].mediaCode !== outputAudioFormat) {
                        outputAudioBitrate = 1024 * streamAudioBitrate;
                        needEncodeAudio = true;
                    }
                }
            }
            let targetBitrate = dec(targetSizeInBit / outputDuration, 0);
            let outputWidthTmp = outputWidth, outputHeightTmp = outputHeight;
            if (input_option.crop && getNumber(input_option.crop.width) >= 80 && getNumber(input_option.crop.height) >= 80) {
                outputWidthTmp = input_option.crop.width;
                outputHeightTmp = input_option.crop.height;
            }
            let fpsOut = input_option.target_size <= 5 ? 20 : 25, bpp = 0.15;
            let aspectRatio = outputWidthTmp / outputHeightTmp;
            let newHeight = makeEven(Math.sqrt(targetBitrate / (bpp * fpsOut * aspectRatio)));
            let newWidth = makeEven(aspectRatio * newHeight);
            let codecStringVideoEncoder = await selectCodecStringForVideoEncoder(videoCodecId, newWidth, newHeight, fpsOut, targetBitrate);
            let { minWidth, minHeight, maxWidth, maxHeight } = await getMinMaxVideoEncoderResolution(codecStringVideoEncoder);
            let { width: w1, height: h1 } = getSuitableResolution(newWidth, newHeight, minWidth, minHeight, maxWidth, maxHeight);
            outputWidth = w1;
            outputHeight = h1;

            let encoderConfig = {
                codec: codecStringVideoEncoder,
                width: outputWidth,
                height: outputHeight,
                framerate: fpsOut,
                bitrate: targetBitrate,
                hardwareAcceleration: (videoCodecId == 226 || videoCodecId == 167) ? "prefer-software" : "prefer-hardware",
                latencyMode: "quality"
            };
            // Safari/AnnexB
            if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
                if (videoCodecId == 27 || videoCodecId == 'h264' || videoCodecId == 173 || videoCodecId == 'h265') {
                    encoderConfig.avc = { format: 'annexb' };
                    encoderConfig.hevc = { format: 'annexb' };
                }
            } else {
                if (videoCodecId == 27 || videoCodecId == 'h264') encoderConfig.avc = { format: 'annexb' };
                else if (videoCodecId == 173 || videoCodecId == 'h265') encoderConfig.hevc = { format: 'annexb' };
            }
            outputFps = fpsOut;
            outputFileInfo.encoder_config = encoderConfig;
            outputVideoBitrate = targetBitrate;
        } else {

            outputFps = fileInfo.fps;
            if (getNumber(input_option.fps) != outputFps && getNumber(input_option.fps) > 0 && getNumber(input_option.fps) <= 120) {
                outputFps = input_option.fps;
            }

            const qualityBitrateMap = {
                Low: 1,
                Medium: 0,
                High: 1024 * 1024 * 64
            };

            outputVideoBitrate = qualityBitrateMap[input_option.quality];

            let encoderConfig = {
                codec: await selectCodecStringForVideoEncoder(videoCodecId, outputWidth, outputHeight, outputFps, outputVideoBitrate),
                width: outputWidth,
                height: outputHeight,
                framerate: outputFps,
                hardwareAcceleration: (videoCodecId == 226 || videoCodecId == 167) ? "prefer-software" : "prefer-hardware",
                latencyMode: "quality"
            };

            if (outputVideoBitrate > 0) {
                encoderConfig.bitrate = outputVideoBitrate;
            }

            // Safari/AnnexB
            if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
                if (videoCodecId == 27 || videoCodecId == 'h264' || videoCodecId == 173 || videoCodecId == 'h265') {
                    encoderConfig.avc = { format: 'annexb' };
                    encoderConfig.hevc = { format: 'annexb' };
                }
            } else {
                if (videoCodecId == 27 || videoCodecId == 'h264') encoderConfig.avc = { format: 'annexb' };
                else if (videoCodecId == 173 || videoCodecId == 'h265') encoderConfig.hevc = { format: 'annexb' };
            }
            outputFileInfo.encoder_config = encoderConfig;
        }

        // FPS, vsync
        if (outputFps > -1) video_convert_cmd.push('-r', outputFps);
        video_convert_cmd.push('-vsync', '2');//always

        // Video bitrate
        if (outputVideoBitrate > 0) video_convert_cmd.push('-b:v', outputVideoBitrate);

        // Aspect & size
        if (outputWidth !== fileInfo.streams[fileInfo.video_stream_index].width || outputHeight !== fileInfo.streams[fileInfo.video_stream_index].height) {
            video_convert_cmd.push('-aspect', aspect);
            video_convert_cmd.push('-s', `${outputWidth}x${outputHeight}`);
        }

        // Output file name
        if (fileInfo.video_stream_index >= 0) {
            const extMap = {
                'libvpx-vp9': 'video.webm',
                'libx265': 'video.h265',
                'libx264': 'video.h264'
            };

            if (extMap[outputVideoFormat]) {
                video_convert_cmd.push('-an', extMap[outputVideoFormat]);
            }
        }


        all_convert_cmd.push(video_convert_cmd);
    }

    //process audio stream, audio volume>0

    if (fileInfo.audio_stream_index >= 0 && getNumber(input_option.volume_level) > 0) {

        needEncodeAudio = needEncodeAudio || (fileInfo.streams[fileInfo.audio_stream_index].mediaCode !== outputAudioFormat);

        var audio_convert_cmd = [];
        if (startTime > 0) {
            audio_convert_cmd.push('-ss', startTime);
        }

        if (endTime != fileInfo.duration && endTime > 0) {
            audio_convert_cmd.push('-to', endTime);
        }

        audio_convert_cmd.push('-i', input_option.blob_url);


        // Audio
        if (getNumber(input_option.volume_level) != 1) {
            audio_convert_cmd.push('-filter:a', 'volume=' + input_option.volume_level);
            needEncodeAudio = true;
        }

        // Audio codec
        if (needEncodeAudio) {
            audio_convert_cmd.push('-c:a', outputAudioFormat);
            if (outputAudioBitrate > 0) audio_convert_cmd.push('-b:a', outputAudioBitrate);
        } else {
            audio_convert_cmd.push('-c:a', 'copy');
        }

        if (fileInfo.audio_stream_index >= 0 && getNumber(input_option.volume_level) > 0) {
            audio_convert_cmd.push('-vn', outputVideoFormat === 'libvpx-vp9' ? "audio.opus" : "audio.m4a");
        }
        all_convert_cmd.push(audio_convert_cmd);

    }


    outputFileInfo.output_duration = outputDuration;
    outputFileInfo.output_fps = outputFps;

    // Kết quả
    result = {
        result: true,
        output_file: outputFileInfo,
        cmd_component_array: all_convert_cmd
    }

    console.log("convert-cmd", JSON.stringify(result));
    return result;
}




