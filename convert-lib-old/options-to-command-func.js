function detectSafari() {
    const ua = navigator.userAgent;
    const isSafari = /Safari/.test(ua)
        && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPR|Opera|SamsungBrowser/.test(ua);

    const isIOS = /iPhone|iPad|iPod/.test(navigator.platform)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isWKWebView = window.webkit?.messageHandlers !== undefined;

    return {

        isSafariOrWKWebView: isSafari || (isIOS && isWKWebView)
    };
}

/**
 * Chọn bitrateMode tối ưu cho VideoEncoder
 * - VBR (variable): Chất lượng tốt hơn, bitrate không chính xác
 * - CBR (constant): Bitrate chính xác, chất lượng có thể không đồng đều
 * - Quantizer: Dựa vào quality parameter thay vì bitrate
 * 
 * @param {string} codec - Codec name (h264, h265, vp9, av1)
 * @param {boolean} needAccurateBitrate - Có cần bitrate chính xác không
 * @returns {string} - "variable" | "constant" | "quantizer"
 */
function getOptimalBitrateMode(codec, needAccurateBitrate = false) {
    // Nếu cần bitrate chính xác (ví dụ: target size)
    if (needAccurateBitrate) {
        return "constant"; // CBR mode
    }
    
    // Hardware encoder thường hỗ trợ CBR tốt hơn
    // Software encoder (VP9, AV1) nên dùng VBR
    if (codec === 'vp9' || codec === 'av1') {
        return "variable"; // VBR cho software encoder
    }
    
    // H264/H265 với hardware: VBR cho chất lượng tốt hơn
    return "variable";
}

/**
 * Tính toán bitrate với tolerance buffer
 * VideoEncoder thường không đạt chính xác bitrate mục tiêu
 * Cần tăng thêm 10-20% để compensate
 * 
 * @param {number} targetBitrate - Target bitrate (bits/sec)
 * @param {string} codec - Codec name
 * @param {string} bitrateMode - "variable" | "constant"
 * @returns {number} - Adjusted bitrate
 */
function adjustBitrateForEncoder(targetBitrate, codec, bitrateMode) {
    if (bitrateMode === "constant") {
        // CBR: Bitrate gần đúng hơn, không cần adjust nhiều
        return Math.round(targetBitrate * 1.05); // +5%
    }
    
    // VBR: Cần tăng target để average bitrate đạt mục tiêu
    const multiplier = {
        'h264': 1.10,  // +10%
        'h265': 1.12,  // +12%
        'vp9': 1.15,   // +15%
        'av1': 1.15    // +15%
    }[codec] || 1.10;
    
    return Math.round(targetBitrate * multiplier);
}

/**
 * 
 * @param {*} input_option 
 * input_option.input_object = [File, url, blob url];
 * note: 
 * VideoEncoder trên Safari làm việc chưa chính xác:
 *  đối với codec = h265 thì ko tạo ra pps và sps chính xác.
 *  đối với codec = h264 thì chỉ làm việc nếu có bitrate.
 *  tóm lại: với Safari khi sử dung VideoEncoder thì đầu ra nên là output.h264 hoặc output.h265, việc add bitstream được thực hiện trong ffmpeg.
 * @returns 
 */
async function convertOptionsToCommand(input_option, saveToDisk = false) {

    executeCommand(CMD_CANCEL_CONVERT);
    // Helper functions
    const getNumber = v => typeof v === 'number' ? v : -99999999;
    const makeEven = v => 2 * Math.round(v / 2);
    const dec = (fl, d = 2) => Math.round(fl * Math.pow(10, d)) / Math.pow(10, d);
    const getCodecId = name => ({ h264: 27, h265: 173, hevc: 173, av1: 226, vp9: 167 })[name];
    const ffmpegLibNameMap = { h264: 'libx264', h265: 'libx265', av1: 'libaom-av1', vp9: 'libvpx-vp9' };
    // Safari/AnnexB
    //var isSafari = /^((?!chrome|android|crios|fxios|edgios|opr|opera|samsungbrowser).)*safari/i.test(navigator.userAgent) && !window.chrome && !window.opr && !window.safari?.pushNotification;
    // const isSafari = window.webkit && window.webkit.messageHandlers;
    // WKWebView
    var { isSafariOrWKWebView } = detectSafari();

    // Get file info and settings
    const fileInfo = await getFileInfo(input_option.input_url);
    const outputDuration = input_option.trim && (dec(input_option.trim.endTime, 2) - dec(input_option.trim.startTime, 2) > 0) ? dec(input_option.trim.endTime, 2) - dec(input_option.trim.startTime, 2) : fileInfo.duration;
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
    // input_option.volume_level = 0;
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
    } else {
        startTime = 0;
        endTime = fileInfo.duration;
    }

    if (endTime == 0 || endTime > fileInfo.duration) endTime = fileInfo.duration;

    const videoCodecId = getCodecId(input_option.format_name);

    outputVideoFormat = ffmpegLibNameMap[input_option.format_name];
    outputAudioFormat = input_option.format_name === 'vp9' ? "libopus" : "aac";
    var needReEncodeVideo = false;
    if (fileInfo.video_stream_index >= 0) {
        if (fileInfo.streams[fileInfo.video_stream_index].mediaCode == 'hevc') {
            fileInfo.streams[fileInfo.video_stream_index].mediaCode = 'h265';
        }
        needReEncodeVideo = input_option.format_name !== fileInfo.streams[fileInfo.video_stream_index].mediaCode;
    }

    var numberOfSegmentOfVideo = 1;
    var codecStringVideoDecoder = await selectCodecStringForVideoDecoder(getCodecId(fileInfo.mediaCode), 1280, 720, null);

    //decoder bằng ffmpeg.
    if (codecStringVideoDecoder == null || !isSharedArrayBufferSupported) {
        //ví dụ webview android.
        const cpuCores = navigator.hardwareConcurrency || 0;
        var numberOfSegment = cpuCores / 2 - 1;
        numberOfSegment = Math.min(numberOfSegment, Math.floor(outputDuration / 10)); //thời gian nhỏ nhất mỗi segment là 10s
        numberOfSegmentOfVideo = Math.max(numberOfSegment - 1, 1);

    }


    /**
    - 1 
    convertCommand = {
        input_file:fileInfo,
        output_file:{
            codecId: videoCodecId,
            duration,
            fps: outputFps,
            width: outputWidth,
            height: outputHeight,
            bitrate_video: outputVideoBitrate,
            bitrate_audio: outputAudioBitrate,
            numberOfSegment: numberOfSegment,
            encoder_config:{codec,width,height,bitrate,framerate,hardwareAcceleration,latencyMode,avc,hevc}
            ....
        },
        start_time: xxx,//dùng để tính phần trăm hoàn thành.
        convertThreads:[
            {
                segment_index: xxx,
                type: 'video' | 'audio'
            },
            {
            
            }...
        ]
    }

     */
    const SEGMENT_TIME = 10;
    const NUMBER_OF_SEGMENTS = Math.ceil(outputDuration / SEGMENT_TIME) + 2;
    var mergeCommand = [];
    var convertCommand = {};
    convertCommand.convertThreads = [];

    //process video stream
    if (fileInfo.video_stream_index >= 0) {
        var video_array_cmd = ['-loglevel', 'info', '-stats_period', STATS_PERIOD, '-progress', '-', '-nostats'];

        // Add probing parameters to detect codec parameters properly
        // probesize: bytes to read (100MB), analyzeduration: microseconds (100M = 100 seconds)
        //video_array_cmd.push('-probesize', '104857600', '-analyzeduration', '100000000');
        video_array_cmd.push('-i', input_option.input_url);

        //encode-video
        video_array_cmd.push('-c:v', outputVideoFormat);
        if (input_option.format_name === 'vp9') {
            video_array_cmd.push('-strict', '-2');
        }

        if (input_option.format_name === 'av1') video_array_cmd.push('-pix_fmt', 'yuv420p');

        //video_array_cmd.push('-pix_fmt', 'yuv420p');
        // Video filters"{\"result\":true,\"convertCommand\":{\"convertThreads\":[{\"array_cmd\":[\"-loglevel\",\"info\",\"-stats_period\",2,\"-progress\",\"-\",\"-nostats\",\"-i\",\"blob:http://localhost:8000/adfe2771-72c9-49a9-974d-c7da83afed5b\",\"-c:v\",\"libx265\",\"-r\",25,\"-vsync\",\"2\",\"-an\",\"-segment_time\",10,\"-f\",\"segment\",\"-reset_timestamps\",1,\"video-segment-%05d.mp4\"],\"type_segment\":\"convert-video-segment\"},{\"array_cmd\":[\"-i\",\"blob:http://localhost:8000/adfe2771-72c9-49a9-974d-c7da83afed5b\",\"-c:a\",\"copy\",\"-vn\",\"-segment_time\",10,\"-f\",\"segment\",\"-reset_timestamps\",1,\"audio-segment-%05d.m4a\"],\"type_segment\":\"convert-audio-segment\"},{\"array_cmd\":[\"-r\",25,\"-f\",\"concat\",\"-safe\",\"0\",\"-i\",\"blob:http://localhost:8000/2428d0d1-dcb6-49f6-ac3b-e5bc8bd1b013\",\"-f\",\"concat\",\"-safe\",\"0\",\"-i\",\"blob:http://localhost:8000/a46b3287-3735-4bed-841c-cc48bdb0b731\",\"-c\",\"copy\",\"-movflags\",\"frag_keyframe+empty_moov+default_base_moof\",\"-tag:v\",\"hvc1\",\"converted-file-07d-11m-25y--13h-01m-32s.mp4\"],\"type_segment\":\"merge-audio-video-segment\"}],\"output_file\":{\"encoder_config\":{\"codec\":\"hev1.1.1f.H186.b0\",\"width\":1920,\"height\":804,\"framerate\":25,\"bitrate\":3584000,\"hardwareAcceleration\":\"prefer-hardware\",\"latencyMode\":\"quality\",\"hevc\":{\"format\":\"annexb\"}},\"duration\":30,\"format\":\"h265\",\"fps\":25},\"converted_data\":[],\"converted_data_length\":0,\"start_time\":1762495292465}}"

        const vf = [];
        if (input_option.rotate && getNumber(input_option.rotate)) vf.push('rotate=' + dec(3.14 * input_option.rotate / 180));

        // ✅ CROP: Nếu có crop, thêm crop filter trước
        if (input_option.crop && getNumber(input_option.crop.width) >= 80 && getNumber(input_option.crop.height) >= 80 && getNumber(input_option.crop.x) >= 0 && getNumber(input_option.crop.y) >= 0) {
            input_option.crop.width = makeEven(input_option.crop.width);
            input_option.crop.height = makeEven(input_option.crop.height);
            vf.push(`crop=${input_option.crop.width}:${input_option.crop.height}:${input_option.crop.x}:${input_option.crop.y}`);
            aspect = `${input_option.crop.width}:${input_option.crop.height}`;
            // Nếu có crop nhưng không có resolution, dùng kích thước crop làm resolution
            if (!input_option.resolution) {
                outputWidth = input_option.crop.width;
                outputHeight = input_option.crop.height;
            }
        }

        // ✅ FLIP: Thêm flip filters
        if (input_option.hflip) vf.push('hflip');
        if (input_option.vflip) vf.push('vflip');

        // ✅ SCALE + PAD: Nếu có resolution, thêm scale và pad
        if (input_option.resolution && getNumber(input_option.resolution.width) >= 80 && getNumber(input_option.resolution.height) >= 80) {
            const targetWidth = makeEven(input_option.resolution.width);
            const targetHeight = makeEven(input_option.resolution.height);
            
            // Scale với force_original_aspect_ratio=decrease để giữ tỷ lệ, không bị méo
            vf.push(`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`);
            
            // Pad để đạt đúng kích thước cố định, căn giữa
            vf.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`);
            
            // Cập nhật outputWidth và outputHeight
            outputWidth = targetWidth;
            outputHeight = targetHeight;
            aspect = `${targetWidth}:${targetHeight}`;
        }

        if (vf.length > 0) {
            video_array_cmd.push('-vf', vf.join(','));
            needReEncodeVideo = true;
        }

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

            let fpsOut = input_option.target_size <= 5 ? 15 : 25, bpp = 1 * getBppByFormat(input_option.format_name, 'medium');
            let aspectRatio = outputWidthTmp / outputHeightTmp;
            let newHeight = makeEven(Math.sqrt(targetBitrate / (bpp * fpsOut * aspectRatio)));
            let newWidth = makeEven(aspectRatio * newHeight);
            
            // Adjust bitrate để đạt target size chính xác
            const bitrateMode = getOptimalBitrateMode(input_option.format_name, true); // true = need accurate
            const adjustedBitrate = adjustBitrateForEncoder(targetBitrate, input_option.format_name, bitrateMode);
            
            let codecStringVideoEncoder = await selectCodecStringForVideoEncoder(videoCodecId, newWidth, newHeight, fpsOut, adjustedBitrate);
            let { minWidth, minHeight, maxWidth, maxHeight } = await getMinMaxVideoEncoderResolution(codecStringVideoEncoder);
            let { width: w1, height: h1 } = getSuitableResolution(newWidth, newHeight, minWidth, minHeight, maxWidth, maxHeight);
            outputWidth = makeEven(w1);
            outputHeight = makeEven(h1);

            let encoderConfig = {
                codec: codecStringVideoEncoder,
                width: outputWidth,
                height: outputHeight,
                bitrate: adjustedBitrate,
                bitrateMode: bitrateMode, // Thêm bitrateMode
                hardwareAcceleration: (videoCodecId == 226 || videoCodecId == 167) ? "prefer-software" : "prefer-hardware",
                latencyMode: getOptimalLatencyMode(input_option.format_name)
            };

            if (isSafariOrWKWebView) {
                if (videoCodecId == 27 || videoCodecId == 'h264' || videoCodecId == 173 || videoCodecId == 'h265') {
                    encoderConfig.avc = { format: 'annexb' };
                    //encoderConfig.hevc = { format: 'annexb' };
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

            //  outputFps = 24;
            if (getNumber(input_option.fps) != outputFps && getNumber(input_option.fps) > 0 && getNumber(input_option.fps) <= 120) {
                outputFps = input_option.fps;
                needReEncodeVideo = true;
            }

            //input_option.format_name
            if (input_option.quality != undefined) {
                outputVideoBitrate = selectBitrateByCodec(input_option.format_name, outputWidth, outputHeight, input_option.quality.toLowerCase());
                needReEncodeVideo = true;
            }

            // Chọn bitrateMode phù hợp (không cần bitrate chính xác cho quality mode)
            const bitrateMode = getOptimalBitrateMode(input_option.format_name, false);
            const finalBitrate = outputVideoBitrate > 0 ? outputVideoBitrate : selectBitrateByCodec(input_option.format_name, outputWidth, outputHeight, 'medium');
            const adjustedBitrate = adjustBitrateForEncoder(finalBitrate, input_option.format_name, bitrateMode);

            let encoderConfig = {
                codec: await selectCodecStringForVideoEncoder(videoCodecId, outputWidth, outputHeight, outputFps, adjustedBitrate),
                width: outputWidth,
                height: outputHeight,
                framerate: outputFps,
                bitrate: adjustedBitrate,
                bitrateMode: bitrateMode, // Thêm bitrateMode
                hardwareAcceleration: (videoCodecId == 226 || videoCodecId == 167) ? "prefer-software" : "prefer-hardware",
                latencyMode: getOptimalLatencyMode(input_option.format_name)
            };

            if (isSafariOrWKWebView) {
                if (videoCodecId == 27 || videoCodecId == 'h264' || videoCodecId == 173 || videoCodecId == 'h265') {
                    encoderConfig.avc = { format: 'annexb' };
                    // encoderConfig.hevc = { format: 'annexb' };
                }
            } else {
                if (videoCodecId == 27 || videoCodecId == 'h264') encoderConfig.avc = { format: 'annexb' };
                else if (videoCodecId == 173 || videoCodecId == 'h265') encoderConfig.hevc = { format: 'annexb' };
            }
            outputFileInfo.encoder_config = encoderConfig;
        }



        // Video bitrate
        if (outputVideoBitrate > 0) {
            video_array_cmd.push('-b:v', outputVideoBitrate);
        }
        // video_array_cmd.push('-movflags', 'frag_keyframe+empty_moov+default_base_moof');

        //     video_array_cmd.push('-live', '1');


        // Aspect & size
        if (outputWidth !== fileInfo.streams[fileInfo.video_stream_index].width || outputHeight !== fileInfo.streams[fileInfo.video_stream_index].height) {
            needReEncodeVideo = true;
            video_array_cmd.push('-aspect', aspect);
            video_array_cmd.push('-s', `${outputWidth}x${outputHeight}`);
        }

        // Output file name
        if (fileInfo.video_stream_index >= 0) {

            const extMap = {
                'libvpx-vp9': '.webm',
                'libx265': !needReEncodeVideo ? '.mp4' : (isSafariOrWKWebView ? '.h265' : '.mp4'),
                'libx264': !needReEncodeVideo ? '.mp4' : (isSafariOrWKWebView ? '.h264' : '.mp4'),
                'libaom-av1': '.mp4'
            };
            if (!needReEncodeVideo) {
                // khi copy thì phải thêm bsf, còn khi encode thì trong ffmpeg.c đã có phần thêm rồi.
                video_array_cmd[video_array_cmd.indexOf('-c:v') + 1] = 'copy';
                if (fileInfo.streams[fileInfo.video_stream_index].mediaCode == 'h265') {
                    video_array_cmd.push('-bsf:v', 'hevc_mp4toannexb');
                } else if (fileInfo.streams[fileInfo.video_stream_index].mediaCode == 'h264') {
                    video_array_cmd.push('-bsf:v', 'h264_mp4toannexb');
                }
            } else {
                // // FPS, vsync
                if (outputFps > -1) video_array_cmd.push('-r', outputFps);
                video_array_cmd.push('-vsync', '2');//always


                // video_array_cmd.push('-vsync', 'passthrough');
                // // Tăng queue size để tránh drop frames khi mux
                // video_array_cmd.push('-max_muxing_queue_size', '9999');
                // video_array_cmd.push('-enc_time_base', '-1');

            }


            var fileName = 'video-segment-%05d' + extMap[outputVideoFormat];
            video_array_cmd.push('-an', '-segment_time', SEGMENT_TIME, '-f', 'segment', '-reset_timestamps', 1, fileName);

            const listContent = [];
            for (var i = 0; i < NUMBER_OF_SEGMENTS; i++) {
                tmp_url = fileName.replace('%05d', String(i).padStart(5, '0'));
                listContent.push(`file '${tmp_url}'`);
            }

            mergeCommand.push('-r', (outputFps > -1) ? outputFps : fileInfo.fps);//always
            mergeCommand.push('-f', 'concat', '-safe', '0');
            mergeCommand.push('-i');
            console.log('listContent:', listContent.join('\n'));
            mergeCommand.push(URL.createObjectURL(textToFile(listContent.join('\n'), 'list.txt', 'text/plain')));

            convertCommand.convertThreads.push(
                {
                    array_cmd: video_array_cmd,
                    type_segment: 'convert-video-segment',
                }
            )
        }
    }

    //process audio stream, audio volume>0
    if (fileInfo.audio_stream_index >= 0 && getNumber(input_option.volume_level) > 0) {

        needEncodeAudio = needEncodeAudio || (fileInfo.streams[fileInfo.audio_stream_index].mediaCode !== outputAudioFormat);

        var audio_array_cmd = [];

        // Add probing parameters to detect codec parameters properly
        // probesize: bytes (50MB), analyzeduration: microseconds (50 seconds)
        //audio_array_cmd.push('-probesize', '52428800', '-analyzeduration', '50000000');
        audio_array_cmd.push('-i', input_option.input_url);


        // Audio
        if (getNumber(input_option.volume_level) != 1) {
            audio_array_cmd.push('-filter:a', 'volume=' + input_option.volume_level);
            needEncodeAudio = true;
        }

        // Audio codec
        if (needEncodeAudio) {
            audio_array_cmd.push('-c:a', outputAudioFormat);
            if (outputAudioBitrate > 0) audio_array_cmd.push('-b:a', outputAudioBitrate);
        } else {
            audio_array_cmd.push('-c:a', 'copy');
        }

        if (fileInfo.audio_stream_index >= 0 && getNumber(input_option.volume_level) > 0) {
            var extension = outputVideoFormat === 'libvpx-vp9' ? ".opus" : ".m4a";


            var fileName = 'audio-segment-%05d' + extension;
            audio_array_cmd.push('-vn', '-segment_time', SEGMENT_TIME, '-f', 'segment', '-reset_timestamps', 1, fileName);

            const listContent = [];
            for (var i = 0; i < NUMBER_OF_SEGMENTS; i++) {
                tmp_url = fileName.replace('%05d', String(i).padStart(5, '0'));
                listContent.push(`file '${tmp_url}'`);
            }

            mergeCommand.push('-f', 'concat', '-safe', '0');
            mergeCommand.push('-i');
            mergeCommand.push(URL.createObjectURL(textToFile(listContent.join('\n'), 'list.txt', 'text/plain')));

            convertCommand.convertThreads.push(
                {
                    array_cmd: audio_array_cmd,
                    type_segment: 'convert-audio-segment',
                }
            )

        }
    }

    mergeCommand.push('-c', 'copy');

    if (input_option.format_name === 'vp9') {
        mergeCommand.push('-live', '1');
    } else {
        mergeCommand.push('-movflags', 'frag_keyframe+empty_moov+default_base_moof');
    }
    if (input_option.format_name === 'h265') {
        mergeCommand.push('-tag:v');
        mergeCommand.push('hvc1');
    } else if (input_option.format_name === 'h264') {
        mergeCommand.push('-tag:v');
        mergeCommand.push('avc1');
    }
    if (input_option.format_name === 'vp9') {
        mergeCommand.push(`converted-file-${getStringTime()}.webm`);
    } else {
        mergeCommand.push(`converted-file-${getStringTime()}.mp4`);
    }

    convertCommand.convertThreads.push(
        {
            array_cmd: mergeCommand,
            type_segment: 'merge-audio-video-segment',
        }
    )

    //  debugger;

    outputFileInfo.duration = outputDuration;
    outputFileInfo.format = input_option.format_name;
    outputFileInfo.fps = outputFps;
    convertCommand.output_file = outputFileInfo;
    convertCommand.converted_data = [];
    convertCommand.converted_data_length = 0;
    convertCommand.start_time = Date.now();
    // Kết quả
    result = {
        result: true,
        convertCommand: convertCommand
    }

    console.log("convertOptionsToCommand===", JSON.stringify(result));
    return result;
}
/**
 * Lấy latency mode tối ưu cho từng format
 * @param {string} format - Video format  
 * @returns {string} - Latency mode
 */
function getOptimalLatencyMode(format) {
  //  if (1 > 0) return 'quality';
    switch (format) {
        case 'h264':
            return 'quality'; // H.264 mature, có thể dùng quality mode
        case 'h265':
        case 'av01':
        case 'vp9':
            return 'realtime'; // Formats mới ưu tiên tốc độ
        default:
            return 'quality';
    }
}