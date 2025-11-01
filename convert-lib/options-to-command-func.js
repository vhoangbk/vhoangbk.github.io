
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

    // Helper functions
    const getNumber = v => typeof v === 'number' ? v : -99999999;
    const makeEven = v => 2 * Math.round(v / 2);
    const dec = (fl, d = 2) => Math.round(fl * Math.pow(10, d)) / Math.pow(10, d);
    const getCodecId = name => ({ h264: 27, h265: 173, hevc: 173, av1: 226, vp9: 167 })[name];
    const ffmpegLibNameMap = { h264: 'libx264', h265: 'libx265', av1: 'libaom-av1', vp9: 'libvpx-vp9' };
    // Safari/AnnexB
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    // Get file info and settings
    const fileInfo = await getFileInfo(input_option.blob_url);
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
    var numberOfSegment = 1;

    var codecStringVideoDecoder = await selectCodecStringForVideoDecoder(getCodecId(fileInfo.mediaCode), 1280, 720, null);

    //do av1 và vp9 encoder bằng software nên cần nhiều thread để giảm thời gian chuyển đổi.
    if (codecStringVideoDecoder == null || input_option.format_name === 'vp9' || input_option.format_name === 'av1') {
        const cpuCores = navigator.hardwareConcurrency || 0;
        numberOfSegment = cpuCores / 2 - 1;
    }

    numberOfSegment = Math.min(numberOfSegment, Math.floor(outputDuration / 10)); //thời gian nhỏ nhất mỗi segment là 10s
    numberOfSegment = Math.max(numberOfSegment, 1); //>=1
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
        output_url: xx,
        start_time: xxx,//dùng để tính phần trăm hoàn thành.
        segmentConversionData:[
            {
                startTime: xxx,
                endTime: xxx,
                output_url: xxx,
                segment_index: xxx,
                streamConversionData:[
                    {
                        cmd: [...],
                        stream_index: xxx,
                        segment_index: xxx,
                        output_url: xxx,
                        percent_complete: xxx

                    }
                ]
            }
        ]
    }




     */
    var convertCommand = {};
    convertCommand.segmentConversionData = [];


    for (var i = 0; i < numberOfSegment; i++) {

        var ss_value = dec(startTime + i * outputDuration / numberOfSegment, 2);
        var to_value = dec(startTime + (i + 1) * outputDuration / numberOfSegment, 2);
        if (i == numberOfSegment - 1) to_value = endTime;

        var stream_index = 0;
        var streamConversionData = [];

        //process video stream
        if (fileInfo.video_stream_index >= 0) {
            var video_convert_cmd = [];
            video_convert_cmd.push('-loglevel', 'info');
            video_convert_cmd.push('-stats_period', STATS_PERIOD);
            video_convert_cmd.push('-progress', '-', '-nostats');
            video_convert_cmd.push('-ss', ss_value);
            video_convert_cmd.push('-to', to_value);

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
            if (vf.length > 0) {
                video_convert_cmd.push('-vf', vf.join(','));
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
                let fpsOut = input_option.target_size <= 5 ? 15 : 25, bpp = 0.1;
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
                    bitrate: targetBitrate,
                    hardwareAcceleration: (videoCodecId == 226 || videoCodecId == 167) ? "prefer-software" : "prefer-hardware",
                    latencyMode: "quality"
                };

                if (isSafari) {
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
                    needReEncodeVideo = true;
                }

                //input_option.format_name
                if (input_option.quality != undefined) {
                    outputVideoBitrate = selectBitrateByCodec(input_option.format_name, outputWidth, outputHeight, input_option.quality.toLowerCase());
                    needReEncodeVideo = true;
                }


                let encoderConfig = {
                    codec: await selectCodecStringForVideoEncoder(videoCodecId, outputWidth, outputHeight, outputFps, outputVideoBitrate),
                    width: outputWidth,
                    height: outputHeight,
                    framerate: outputFps,
                    bitrate: outputVideoBitrate > 0 ? outputVideoBitrate : selectBitrateByCodec(input_option.format_name, outputWidth, outputHeight, 'medium'),
                    hardwareAcceleration: (videoCodecId == 226 || videoCodecId == 167) ? "prefer-software" : "prefer-hardware",
                    latencyMode: "quality"
                };


                if (isSafari) {
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



            // Video bitrate
            if (outputVideoBitrate > 0) {
                video_convert_cmd.push('-b:v', outputVideoBitrate);
            }


            // Aspect & size
            if (outputWidth !== fileInfo.streams[fileInfo.video_stream_index].width || outputHeight !== fileInfo.streams[fileInfo.video_stream_index].height) {
                needReEncodeVideo = true;
                video_convert_cmd.push('-aspect', aspect);
                video_convert_cmd.push('-s', `${outputWidth}x${outputHeight}`);
            }

            // Output file name
            if (fileInfo.video_stream_index >= 0) {

                const extMap = {
                    'libvpx-vp9': '.webm',
                    'libx265': !needReEncodeVideo ? '.mp4' : (isSafari ? '.h265' : '.mp4'),
                    'libx264': !needReEncodeVideo ? '.mp4' : (isSafari ? '.h264' : '.mp4'),
                    'libaom-av1': '.mp4'
                };
                if (!needReEncodeVideo) {
                    // khi copy thì phải thêm bsf, còn khi encode thì trong ffmpeg.c đã có phần thêm rồi.
                    video_convert_cmd[video_convert_cmd.indexOf('-c:v') + 1] = 'copy';
                    if (fileInfo.streams[fileInfo.video_stream_index].mediaCode == 'h265') {
                        video_convert_cmd.push('-bsf:v', 'hevc_mp4toannexb');
                    } else if (fileInfo.streams[fileInfo.video_stream_index].mediaCode == 'h264') {
                        video_convert_cmd.push('-bsf:v', 'h264_mp4toannexb');
                    }
                } else {
                    // FPS, vsync
                    if (outputFps > -1) video_convert_cmd.push('-r', outputFps);
                    video_convert_cmd.push('-vsync', '2');//always
                }
                if (extMap[outputVideoFormat]) {
                    if (saveToDisk) {
                        var tmp_output_file = await getFSFileByExtension(extMap[outputVideoFormat]);
                        if (!tmp_output_file) {
                            return { result: false, msg: 'No folder selected to save the file.' };
                        }
                        video_convert_cmd.push('-an', tmp_output_file);
                    } else {
                        video_convert_cmd.push('-an', 'video' + extMap[outputVideoFormat]);
                    }
                }
            }

            streamConversionData.push({
                cmd: video_convert_cmd,
                output_url: undefined,
                stream_index: stream_index,
                segment_index: i,
                percent_complete: 0
            });
            stream_index++;
        }

        //process audio stream, audio volume>0

        if (fileInfo.audio_stream_index >= 0 && getNumber(input_option.volume_level) > 0) {

            needEncodeAudio = needEncodeAudio || (fileInfo.streams[fileInfo.audio_stream_index].mediaCode !== outputAudioFormat);

            var audio_convert_cmd = [];

            if (stream_index == 0) {
                audio_convert_cmd.push('-loglevel', 'info');
                audio_convert_cmd.push('-stats_period', STATS_PERIOD);
                audio_convert_cmd.push('-progress', '-', '-nostats');
            }

            audio_convert_cmd.push('-ss', ss_value);
            audio_convert_cmd.push('-to', to_value);

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

            streamConversionData.push({
                cmd: audio_convert_cmd,
                output_url: undefined,
                stream_index: stream_index,
                segment_index: i,
                percent_complete: 0
            });
        }

        convertCommand.segmentConversionData.push(streamConversionData);

    }

    if (!saveToDisk) {
        var tmpVideoBitrate = 0;
        var tmpAudioBitrate = 0;
        if (fileInfo.video_stream_index >= 0) {
            if (outputVideoBitrate > 0) {
                tmpVideoBitrate = outputVideoBitrate;
            } else if (needReEncodeVideo) {
                const supportedProfiles = window.app_settings[input_option.format_name];
                for (const keys in supportedProfiles) {
                    const profile = supportedProfiles[keys];
                    tmpVideoBitrate = Math.max(tmpVideoBitrate, outputFps * outputWidth * outputHeight * profile.bpp);

                }
            } else if (fileInfo.streams[fileInfo.video_stream_index].bitrate > 0) {
                //copy stream
                tmpVideoBitrate = fileInfo.streams[fileInfo.video_stream_index].bitrate * 1024;
            }
        }

        if (fileInfo.audio_stream_index >= 0) {
            if (outputAudioBitrate > 0) {
                tmpAudioBitrate = outputAudioBitrate;
            } else if (needEncodeAudio) {
                tmpAudioBitrate = 128 * 1024;
            } else if (fileInfo.streams[fileInfo.audio_stream_index].bitrate > 0) {
                //copy stream
                tmpAudioBitrate = fileInfo.streams[fileInfo.audio_stream_index].bitrate * 1024;
            }
        }

        var estimatedSize = ((tmpVideoBitrate + tmpAudioBitrate) * outputDuration) / 8 / 1024 / 1024;
        if (estimatedSize >= 0.9 * 2000) {
            return convertOptionsToCommand(input_option, true)
        }
    }

    outputFileInfo.duration = outputDuration;
    outputFileInfo.format = outputVideoFormat || outputAudioFormat;
    outputFileInfo.fps = outputFps;
    outputFileInfo.numberOfSegment = numberOfSegment;
    convertCommand.output_file = outputFileInfo;
    convertCommand.input_file = fileInfo;
    convertCommand.output_url = undefined;
    convertCommand.start_time = Date.now();
    convertCommand.saveToDisk = saveToDisk;
    // Kết quả
    result = {
        result: true,
        convertCommand: convertCommand
    }
    console.log("convertOptionsToCommand===", JSON.stringify(result));
    return result;
}




