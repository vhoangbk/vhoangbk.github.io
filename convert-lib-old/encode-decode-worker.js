importScripts("constant.js");
importScripts(CONVERT_UTILS_URL);
importScripts(CODEC_HELPER_URL);


var coder_map = {}; //{name:(videodecoder|videoencoder)}
const ex_decoder_key = 'ex_decoder_key';
const ex_encoder_key = 'ex_encoder_key';
var ex_mime_codec;

(
    async function input_looper() {
        while (true) {
            const keys = Object.keys(coder_map);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var coder = coder_map[keys[i]];

                if (coder.pendding_inputs.length == 0) {
                    if (coder.request_flush == 1) {

                        if (coder.is_encoder && coder.name != ex_encoder_key) {
                            coder.request_flush = 2;
                            await coder.flush();
                            coder.close();
                            postMessage({ type_cmd: 'flushed' });
                        } else if (!coder.is_encoder && coder.name != ex_decoder_key) {
                            coder.request_flush = 2;
                            await coder.flush();
                            coder.close();
                            if (coder_map[ex_encoder_key]) {
                                coder_map[ex_encoder_key].request_flush = 1;
                            } else {
                                postMessage({ type_cmd: 'flushed' });
                            }
                        } else if (coder.name == ex_encoder_key) {
                            coder.request_flush = 2;
                            await coder.flush();
                            coder.close();
                            coder_map[ex_decoder_key].request_flush = 1;
                        } else if (coder.name == ex_decoder_key) {
                            coder.request_flush = 2;
                            await coder.flush();
                            coder.close();
                            postMessage({ type_cmd: 'flushed' });
                        }


                    }

                    continue;
                }

                if (coder.state != 'configured') {
                    if (!coder.is_encoder && !coder.init_decoder) {
                        coder.init_decoder = true;
                        config_decoder(coder);
                    }
                    continue;
                }
                const max_queue = 2;
                var queue_size = coder.is_encoder ? coder.encodeQueueSize : coder.decodeQueueSize;
                if (queue_size > max_queue) {
                    continue;
                }

                if (coder.is_encoder) {
                    const gopSize = 3 * Math.floor(coder.encoder_config?.framerate || 30);
                    var is_keyframe = coder.count_encode % gopSize == 0;
                    var frame = coder.pendding_inputs.shift();


                    const formats = ['I420', 'NV12', 'NV21', 'RGBA', 'RGBX', 'BGRA', 'BGRX'];
                    if (!formats.includes(frame.format)) {
                        frame = await fix_format_null(frame);
                    }
                    coder.encode(frame, { keyFrame: is_keyframe });
                    coder.count_encode = coder.count_encode + 1;
                    frame.close();
                    i = i - 1;
                    continue;
                } else {
                    coder.decode(coder.pendding_inputs.shift());
                    coder.count_decode = coder.count_decode + 1;
                    i = i - 1;
                    continue;
                }

            }
            await new Promise(r => setTimeout(r, 1));
        }
    }
)();
var timestamp = 0;
var count_chunk = 0;
function handleChunk(coder, chunk, config) {

    if (coder.name == ex_encoder_key) {
        if (!coder_map[ex_decoder_key]) {
            create_coder({ codec_id: 27, dec_width: coder.config.enc_width, dec_height: coder.config.enc_height }, ex_decoder_key, false);
        }
        var decoder = coder_map[ex_decoder_key];
        decoder.pendding_inputs.push(chunk);
        decoder.count_input = decoder.count_input + 1;
    } else {
        count_chunk++;
        postMessage({
            type_cmd: 'new_video_chunk',
            chunk: chunk
        });

    }
}

async function fix_format_null(frame) {

    const bitmap = await createImageBitmap(frame);
    const outputFrame = new VideoFrame(bitmap, {
        timestamp: frame.timestamp,
    });
    frame.close();
    bitmap.close();
    return outputFrame;
}

var postFrameCounter = 0;
function postFrame(frame) {
    const buffer = new Uint8Array(frame.allocationSize());
    frame.copyTo(buffer);
    postMessage({
        type_cmd: CMD_NEW_FRAME,
        pts: frame.timestamp,
        width: frame.displayWidth,
        height: frame.displayHeight,
        format: get_code_format_from_string(frame.format),
        duration: frame.duration,
        buffer: buffer
    }, [buffer.buffer]);
    frame.close();
    postFrameCounter++;
}


function handleFrame(coder, frame) {

    if (coder.name == ex_decoder_key) {
        postFrame(frame);
    } else {

        var is_ok_format = frame.format == 'I420' || frame.format == 'NV12' || frame.format == 'NV21';
        if (is_ok_format) {
            postFrame(frame);
        } else {
            if (!coder_map[ex_encoder_key]) {
                create_coder({ codec_id: 27, enc_width: frame.displayWidth, enc_height: frame.displayHeight }, ex_encoder_key, true);
            }
            coder_map[ex_encoder_key].pendding_inputs.push(frame);
            coder_map[ex_encoder_key].count_input = coder_map[ex_encoder_key].count_input + 1;
        }
    }
}

async function config_decoder(videodecoder) {

    var selected_mime_codec = await selectCodecStringForVideoDecoder(videodecoder.config.codec_id, videodecoder.config.dec_width, videodecoder.config.dec_height, videodecoder.config.mime_codec);
    if (!selected_mime_codec) {
        sendCmd(CMD_ERROR_DECODER_CONFIG, "error config_decoder pos:1");
        return;
    }
    var selected_method = await selectBestMethodForVideoDecoder(videodecoder.pendding_inputs[0], selected_mime_codec, videodecoder.config.dec_width, videodecoder.config.dec_height, videodecoder.name == ex_decoder_key);
    if (!selected_method) {
        sendCmd(CMD_ERROR_DECODER_CONFIG, "error config_decoder pos:2");
        return;
    }

    try {
        var config = {
            codec: selected_mime_codec
        };

        config.hardwareAcceleration = selected_method;
        const support = await VideoDecoder.isConfigSupported(config);
        if (!support.supported) {
            sendCmd(CMD_ERROR_DECODER_CONFIG, "VideoDecoder.isConfigSupported==false");
            return;
        }
        console.log("decoder_config===", config);
        videodecoder.configure(config);
    } catch (error) {
        console.log("error decoder_config===", error);
        console.error(error);
    }

}

async function create_coder(config, name, is_encoder) {

    var coder;
    if (is_encoder) {
        coder = new VideoEncoder({
            output: (encodedVideoChunk, config) => {
                handleChunk(coder, encodedVideoChunk, config);
            },
            error(e) {
                console.error('hungnote error encoder: ', e);
            },
        });

    } else {
        coder = new VideoDecoder({
            output: (frame) => {
                handleFrame(coder, frame);
            },
            error(e) {
                console.log("error VideoDecoder output===", e);
            },
        });
    }

    coder.is_encoder = is_encoder;
    coder.config = config;
    coder.count_input = 0;
    coder.count_encode = 0;
    coder.count_decode = 0;
    coder.pendding_inputs = [];
    coder.name = name;
    coder_map[name] = coder;

    if (is_encoder) {
        if (config.output_file) {
            var encoder_config = config.output_file.encoder_config
        } else {
            var encoder_config = await selectConfigForVideoEncoder(config.codec_id, config.fps, config.bitrate, config.enc_width, config.enc_height);
        }
        console.log("encoder_config===", encoder_config);
        if (encoder_config) {
            coder.encoder_config = encoder_config;
            coder.configure(encoder_config);
        } else {
            console.log("error create_coder ===");
            sendCmd(CMD_ERROR_ENCODER_CONFIG, "error CMD_ERROR_ENCODER_CONFIG");
        }
    } else {
        coder.init_decoder = false;
    }

}

self.onmessage = async function (intent) {

    var cmd = intent.data.type_cmd;
    if (cmd == 'setup_encoder') {
        self.app_settings = intent.data.app_settings;
        create_coder(intent.data.config, intent.data.worker_name, true);
        postMessage({
            type_cmd: 'worker_ready',
            worker_name: intent.data.worker_name
        });
    } else if (cmd == 'setup_decoder') {
        self.app_settings = intent.data.app_settings;
        create_coder(intent.data.config, intent.data.worker_name, false);
        postMessage({
            type_cmd: 'worker_ready',
            worker_name: intent.data.worker_name
        });

    } else if (cmd == 'request_encode') {
        var coder = coder_map[intent.data.worker_name];
        coder.pendding_inputs.push(new VideoFrame(intent.data.frameData, intent.data.init));
        coder.count_input = coder.count_input + 1;

    } else if (cmd == 'request_decode') {
        var chunk = new EncodedVideoChunk({
            type: intent.data.flag == 1 ? "key" : "delta",
            data: intent.data.pktData,
            timestamp: Number(intent.data.pts),
            duration: Number(intent.data.duration),
        });
        var coder = coder_map[intent.data.worker_name];
        coder.pendding_inputs.push(chunk);
        coder.count_input = coder.count_input + 1;
    } else if (cmd == 'flush') {
        coder_map[intent.data.worker_name].request_flush = 1;
    } else if (cmd == 'check_ready') {
        postMessage({
            type_cmd: 'worker_ready'
        });
    } else if (cmd == 'pull') {
        var coder = coder_map[intent.data.worker_name];
        if (!coder) {
            postMessage({
                type_cmd: 'pull'
            });
        }

        if (coder.count_input - Math.max(coder.count_decode, coder.count_encode) < 30) {
            postMessage({
                type_cmd: 'pull'
            });
        } else {
            setTimeout(() => {
                onmessage(intent)
            }, 2);
        }
    }
}

/**
 * Tìm codec string nhanh nhất cho VideoEncoder
 * @param {string} format - 'h264', 'h265', 'av01', 'vp9'
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @param {number} fps - Frame rate (optional)
 * @param {number} bitrate - Target bitrate (optional)
 * @returns {Promise<string|null>} - Fastest codec string hoặc null nếu không hỗ trợ
 */
async function findFastestCodecStringForVideoEncoder(format, width, height, fps = 30, bitrate = 0) {
    const speedOptimizedCodecs = {
        h264: [
            // Baseline profile - fastest encoding
            'avc1.42001E', // Baseline, Level 3.0
            'avc1.42001F', // Baseline, Level 3.1
            'avc1.420020', // Baseline, Level 3.2
            // Main profile - balanced
            'avc1.4D001E', // Main, Level 3.0
            'avc1.4D001F', // Main, Level 3.1
            'avc1.4D0020', // Main, Level 3.2
            // High profile - fallback
            'avc1.64001E', // High, Level 3.0
            'avc1.64001F', // High, Level 3.1
            'avc1.640020'  // High, Level 3.2
        ],

        h265: [
            // Main profile - fastest for H.265
            'hev1.1.6.L93.B0',  // Main, Level 3.1
            'hev1.1.6.L123.B0', // Main, Level 4.0
            'hev1.1.6.L153.B0', // Main, Level 5.0
            // Main 10 profile - fallback
            'hev1.2.4.L93.B0',  // Main 10, Level 3.1
            'hev1.2.4.L123.B0', // Main 10, Level 4.0
        ],

        av01: [
            // Main profile với level thấp - fastest
            'av01.0.01M.08',    // Level 3.0 - fastest
            'av01.0.04M.08',    // Level 4.0 - balanced
            'av01.0.05M.08',    // Level 5.0 - high res
            'av01.0.08M.08',    // Level 5.1 - 4K
            // High profile - fallback
            'av01.0.01H.08',    // High, Level 3.0
            'av01.0.04H.08',    // High, Level 4.0
        ],

        vp9: [
            // Profile 0 - fastest VP9 encoding
            'vp09.00.10.08',    // Profile 0, Level 1
            'vp09.00.20.08',    // Profile 0, Level 2
            'vp09.00.30.08',    // Profile 0, Level 3
            'vp09.00.40.08',    // Profile 0, Level 4
            'vp09.00.50.08',    // Profile 0, Level 5
        ]
    };

    const codecList = speedOptimizedCodecs[format];
    if (!codecList) {
        console.warn(`Unsupported format: ${format}`);
        return null;
    }

    const baseConfig = {
        width: width,
        height: height,
        framerate: fps,
        hardwareAcceleration: getOptimalHardwareAcceleration(format),
        latencyMode: getOptimalLatencyMode(format)
    };

    if (bitrate > 0) {
        baseConfig.bitrate = bitrate;
    }

    // Test từng codec theo thứ tự ưu tiên tốc độ
    for (const codec of codecList) {
        try {
            const config = { ...baseConfig, codec };
            const support = await VideoEncoder.isConfigSupported(config);

            if (support.supported) {
                console.log(`✅ Found fastest codec for ${format}: ${codec}`);
                return codec;
            }
        } catch (error) {
            console.warn(`❌ Codec ${codec} test failed:`, error.message);
        }
    }

    console.warn(`⚠️ No supported codec found for ${format}`);
    return null;
}