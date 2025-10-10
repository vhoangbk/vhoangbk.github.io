
// Hàm lấy min/max width/height mà VideoEncoder hỗ trợ cho một codec string
async function getMinMaxVideoEncoderResolution(codec) {
    // Danh sách độ phân giải phổ biến từ thấp đến cao
    const resolutions = [
        [160, 120], [240, 180], [320, 240], [480, 360], [640, 480],
        [960, 540], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160],
        [4096, 2160], [7680, 4320]
    ];
    let minWidth = null, minHeight = null, maxWidth = 0, maxHeight = 0;
    for (const [w, h] of resolutions) {
        const config = { codec, width: w, height: h, framerate: 30 };
        try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (support.supported) {
                if (minWidth === null || w < minWidth) {
                    minWidth = w;
                    minHeight = h;
                }
                if (w > maxWidth) {
                    maxWidth = w;
                    maxHeight = h;
                }
            }
        } catch (e) { }
    }
    return { minWidth, minHeight, maxWidth, maxHeight };
}

function getSuitableResolution(inputWidth, inputHeight, minWidth, minHeight, maxWidth, maxHeight) {
    const aspectRatio = inputWidth / inputHeight;

    if (inputWidth < minWidth || inputHeight < minHeight || inputWidth > maxWidth || inputHeight > maxHeight) {
        if (aspectRatio > 1) {
            // Landscape orientation
            inputWidth = Math.min(maxWidth, Math.max(minWidth, inputWidth));
            inputHeight = inputWidth / aspectRatio;
        } else {
            // Portrait orientation
            inputHeight = Math.min(maxHeight, Math.max(minHeight, inputHeight));
            inputWidth = inputHeight * aspectRatio;
        }
    }

    return {
        width: Math.round(inputWidth),
        height: Math.round(inputHeight)
    };
}



async function selectCodecStringForVideoEncoder(codecId, width, height, fps, bitrate) {

    var codec_list = null;
    if (codecId == 27) {
        codec_list = [...all_codecs['h264']['Baseline'], ...all_codecs['h264']['Main'], ...all_codecs['h264']['High']];
    } else if (codecId == 173) {
        codec_list = [...all_codecs['h265']['Main 10'], ...all_codecs['h265']['Main']];
    } else if (codecId == 226) {
        codec_list = [...all_codecs['av1']['Main'], ...all_codecs['av1']['High']];
    } else if (codecId == 167) {
        codec_list = [...all_codecs['vp9']['0']];
    }


    const config = { width, height, framerate: fps };
    if (bitrate > 0) {
        config.bitrate = bitrate;
    }

    // Duyệt từ cuối mảng để ưu tiên các codec mới hơn
    for (const codec of [...codec_list].reverse()) {
        config.codec = codec;
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) return codec;

        console.log('khong ho tro============codec=', codec);
    }

}

async function find_mime_codec_for_decoder(codec_id, width, height, suggested_mime_codec) {

    var codec_list = null;
    if (codec_id == 27) {
        codec_list = [...all_codecs['h264']['Baseline'], ...all_codecs['h264']['Main'], ...all_codecs['h264']['High'], suggested_mime_codec];
    } else if (codec_id == 173) {
        codec_list = [...all_codecs['h265']['Main 10'], ...all_codecs['h265']['Main'], suggested_mime_codec];
    } else if (codec_id == 226) {
        codec_list = [...all_codecs['av1']['Main'], ...all_codecs['av1']['High'], suggested_mime_codec];
    } else if (codec_id == 167) {
        codec_list = [...all_codecs['vp9']['0'], suggested_mime_codec];
    }

    var config = {
        width: width,
        height: height,
    };
    for (var n = codec_list.length - 1; n >= 0; n--) {
        if (!codec_list[n]) {
            continue;
        }
        config.codec = codec_list[n];
        const support = await VideoDecoder.isConfigSupported(config);
        if (support.supported) {
            return config.codec;
        }
    }
}

async function find_encoder_config(codec_id, bitrate, fps, width, height) {


    var codec_key = '';
    if (codec_id == 27) {
        codec_key = 'h264';
    } else if (codec_id == 173) {
        codec_key = 'h265';
    } else if (codec_id == 226) {
        codec_key = 'av1';
    } else if (codec_id == 167) {
        codec_key = 'vp9';
    }


    var codec_list = all_codecs[codec_key]['High'] || all_codecs[codec_key]['Main'] || all_codecs[codec_key]['Baseline'] || all_codecs[codec_key]['0'] || [];
    var methods = (codec_id == 226 || codec_id == 167) ? ["prefer-software"] : ["prefer-hardware"];

    var config = {
        width: width,
        height: height,
    };

    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
        if (codec_id == 27 || codec_id == 173) {
            config.avc = { format: 'annexb' };
            config.hevc = { format: 'annexb' };
        }
    } else {
        if (codec_id == 27) {
            config.avc = { format: 'annexb' };
        } else if (codec_id == 173) {
            config.hevc = { format: 'annexb' };
        }
    }

    if (bitrate > 0) {
        config.bitrate = bitrate;
    }
    if (fps > 0) {
        config.framerate = fps;
    }

    for (var i = 0; i < methods.length; i++) {
        config.hardwareAcceleration = methods[i];
        for (var n = 0; n < codec_list.length; n++) {
            try {
                config.codec = codec_list[n];
                const support = await VideoEncoder.isConfigSupported(config);
                if (support.supported) {
                    return config;
                }

            } catch (error) {
            }

        }
    }
}


async function get_videodecoder_method(encoded_video_chunk, mime_code, width, height, required_smallest) {

    var methods = ['prefer-hardware', 'prefer-software'];
    var selected_method;
    var selected_format;
    for (var i = 0; i < methods.length; i++) {

        var config = {
            codec: mime_code,
            width: width,
            height: height,
        };


        config.hardwareAcceleration = methods[i];
        const support = await VideoDecoder.isConfigSupported(config);
        if (support.supported) {
            try {
                var video_decoder = new VideoDecoder({
                    output: async (frame) => {
                        var format = frame.format;
                        frame.close();
                        selected_method = methods[i];
                        selected_format = format;
                    },
                    error: (error) => {
                        console.log('error get_videodecoder_method:', error);
                    }
                });

                video_decoder.configure(config);
                video_decoder.decode(encoded_video_chunk);
                await video_decoder.flush();
                video_decoder.close();
                if (selected_format == 'I420' || selected_format == 'NV12') {
                    return selected_method;
                }
            } catch (error) {
                console.log('hungnote get_videodecoder_method error===', error);
            }


        } else {
            // console.error('khong ho tro============mime_code=', mime_code, '|||methods[i]===', methods[i]);
        }
    }

    if (!required_smallest && selected_method) {
        return selected_method;
    }
}