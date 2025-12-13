importScripts("common-utils.js");
importScripts("coder-config-utils.js");



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
                            const targetCoder = coder;
                            targetCoder.flush().then(() => {
                                targetCoder.close();
                                postMessage({ type_cmd: CMD_BEE_FLUSH });
                            });
                        } else if (!coder.is_encoder && coder.name != ex_decoder_key) {
                            coder.request_flush = 2;
                            const targetCoder = coder;
                            targetCoder.flush().then(() => {
                                targetCoder.close();
                                if (coder_map[ex_encoder_key]) {
                                    coder_map[ex_encoder_key].request_flush = 1;
                                } else {
                                    postMessage({ type_cmd: CMD_BEE_FLUSH });
                                }
                            });
                        } else if (coder.name == ex_encoder_key) {

                            coder.request_flush = 2;
                            const targetCoder = coder;
                            targetCoder.flush().then(() => {
                                targetCoder.close();
                                coder_map[ex_decoder_key].request_flush = 1;
                            });

                        } else if (coder.name == ex_decoder_key) {
                            coder.request_flush = 2;
                            const targetCoder = coder;
                            targetCoder.flush().then(() => {
                                targetCoder.close();
                                postMessage({ type_cmd: CMD_BEE_FLUSH });
                            });
                        }
                    }

                    continue;
                }

                if (coder.state != 'configured') {
                    // if (!coder.is_encoder && !coder.init_decoder && coder.pendding_inputs.length > 0) {
                    //     coder.init_decoder = true;
                    //     config_decoder(coder, coder.pendding_inputs[0]);
                    // }
                    if (coder.is_setup == false) {
                        coder.is_setup = true;
                        config_coder(coder, coder.pendding_inputs[0]);
                    }
                    continue;
                }
                const max_queue = 2;
                var queue_size = coder.is_encoder ? coder.encodeQueueSize : coder.decodeQueueSize;
                if (queue_size > max_queue) {
                    continue;
                }

                if (coder.is_encoder) {
                    const fps = coder.config.framerate_den > 0 ? coder.config.framerate_num / coder.config.framerate_den : 24;
                    const gopSize = Math.min(fps * 2, is_safari == true ? 24 : 30);
                    //safari gop-szie 5-15, note: can xem lai voi safari
                    var out_duration = coder.count_output_chunk_current / fps;
                    var is_keyframe = coder.count_encode % gopSize == 0;


                    if (is_keyframe && coder.settings?.target_size && coder.name !== ex_encoder_key
                        && out_duration >= Math.max(1, coder.settings.duration >= 100 ? 5 : 2)) {

                        var out_duration_total = coder.count_output / fps;
                        var bitrate_current = 8 * coder.count_output_length_current / out_duration;

                        var bitrate_output_total = 8 * coder.count_output_length_total / out_duration_total;
                        var bitrate_target = coder.config.bit_rate;
                        var bitrate_ratio = bitrate_current / coder.current_config.bitrate;

                        if (bitrate_output_total < 0.9 * bitrate_target || bitrate_output_total > 1.1 * bitrate_target) {
                            var new_bitrate = bitrate_target - (bitrate_output_total - bitrate_target) * out_duration_total / out_duration;
                            new_bitrate = new_bitrate / bitrate_ratio;
                            new_bitrate = Math.max(bitrate_target / 8, Math.min(new_bitrate, bitrate_target * 8)); //min 100kbps
                            coder.current_config.bitrate = new_bitrate & ~0;
                            await coder.flush();
                            if (!is_safari) {
                                coder.reset();
                            }

                            coder.configure(coder.current_config);
                        }

                        coder.count_output_chunk_current = 0;
                        coder.count_output_length_current = 0;
                    }


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
function handleChunk(coder, chunk, config) {

    if (coder.name == ex_encoder_key) {
        if (!coder_map[ex_decoder_key]) {
            create_coder({ codec_id: 27, dec_width: coder.config.enc_width, dec_height: coder.config.enc_height }, ex_decoder_key, false);
        }
        var decoder = coder_map[ex_decoder_key];
        decoder.pendding_inputs.push(chunk);
        decoder.count_input = decoder.count_input + 1;
    } else {
        coder.count_output_length_total += chunk.byteLength;
        coder.count_output_length_current += chunk.byteLength;
        coder.count_output_chunk_current += 1;
        coder.count_output = coder.count_output + 1;
        const buffer = new ArrayBuffer(chunk.byteLength);
        const uint8View = new Uint8Array(buffer);
        chunk.copyTo(uint8View);
        postMessage({
            type_cmd: 'new_video_chunk',
            chunk: {
                type: chunk.type,
                timestamp: chunk.timestamp,
                duration: chunk.duration,
                byteLength: chunk.byteLength,
                data: uint8View
            }
        }, [buffer]);
    }
}



var postFrameCounter = 0;
function postFrame(frame) {
    const buffer = new Uint8Array(frame.allocationSize());
    frame.copyTo(buffer);
    const VIDEO_FORMAT_BYTES_PER_PIXEL = {
        'I420': 1.5,    // YUV 4:2:0 - Y(1) + U(0.25) + V(0.25) = 1.5 bytes/pixel
        'NV12': 1.5,    // YUV 4:2:0 - Y(1) + UV interleaved(0.5) = 1.5 bytes/pixel
        'NV21': 1.5,    // YUV 4:2:0 - Y(1) + VU interleaved(0.5) = 1.5 bytes/pixel
        'RGBA': 4,      // Red(1) + Green(1) + Blue(1) + Alpha(1) = 4 bytes/pixel
        'RGBX': 4,      // Red(1) + Green(1) + Blue(1) + X(1) = 4 bytes/pixel
        'BGRA': 4,      // Blue(1) + Green(1) + Red(1) + Alpha(1) = 4 bytes/pixel
        'BGRX': 4       // Blue(1) + Green(1) + Red(1) + X(1) = 4 bytes/pixel
    };

    var w = frame.displayWidth;
    var h = frame.displayHeight;
    if (VIDEO_FORMAT_BYTES_PER_PIXEL[frame.format]) {
        h = Math.floor(buffer.length / (w * VIDEO_FORMAT_BYTES_PER_PIXEL[frame.format]));
    }

    postMessage({
        type_cmd: CMD_NEW_FRAME,
        pts: frame.timestamp,
        width: w,
        height: h,
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

async function config_coder(coder, sample) {
    console.log("config_coder===", JSON.stringify(coder.config));
    try {
        if (coder.is_encoder) {
            // debugger;
            //async function findBestVideoEncoderConfig3(codecId, width, height, fps = 25, bitrate = 0, sampleFrame = null) {
            var config = await findBestVideoEncoderConfigWithRealTest(coder.config.codec_id, coder.config.enc_width, coder.config.enc_height, coder.config.framerate_den > 0
                ? coder.config.framerate_num / coder.config.framerate_den : 30, coder.config.bit_rate > 0 ? coder.config.bit_rate : 0, sample);
            coder.configure(config.config);
            coder.current_config = config.config;


            console.log("encoder config===", JSON.stringify(config.config));
        } else {
            var config = await findBestVideoDecoderConfig(coder.config.codec_id, sample, coder.config.dec_width, coder.config.dec_height);
            coder.configure(config.config);
        }

    } catch (error) {
        console.log("error coder_config===", error);
        // console.error(error);
        const mainBroadcastChannel = new BroadcastChannel("app_channel");
        mainBroadcastChannel.postMessage({
            type_cmd: CMD_BEE_ERROR_CONFIG_CODER,
            msg: error.toString(),
            is_encoder: coder.is_encoder,
            name: coder.name
        });

    }

}

async function create_coder(config, name, is_encoder) {

    var coder;
    var coder;
    if (is_encoder) {
        coder = new VideoEncoder({
            output: (encodedVideoChunk, config) => {
                handleChunk(coder, encodedVideoChunk, config);
            },
            error(e) {
                console.error('hungnote error encoder==================: ', e);
            },
        });

    } else {
        coder = new VideoDecoder({
            output: (frame) => {
                coder.count_output = coder.count_output + 1;
                handleFrame(coder, frame);
            },
            error(e) {
                console.error('hungnote error decoder: ', e);
            },
        });
    }

    coder.is_encoder = is_encoder;
    coder.config = config;
    coder.count_input = 0;
    coder.count_output = 0;
    coder.count_encode = 0;
    coder.count_decode = 0;
    coder.pendding_inputs = [];
    coder.name = name;
    coder_map[name] = coder;
    coder.is_setup = false;
    if (is_encoder) {
        coder.settings = self.settings;
        coder.count_output_length_total = 0;
        coder.count_output_length_current = 0;
        coder.count_output_chunk_current = 0;
    }
}

self.onmessage = async function (intent) {

    var cmd = intent.data.type_cmd;
    if (cmd == 'setup_encoder') {
        self.settings = intent.data.settings;
        create_coder(intent.data.config, intent.data.worker_name, true);
        postMessage({
            type_cmd: 'worker_ready',
            worker_name: intent.data.worker_name
        });
    } else if (cmd == 'setup_decoder') {
        console.log('setup_decoder called===', intent.data.worker_name, intent.data.config);
        self.app_settings = intent.data.app_settings;
        create_coder(intent.data.config, intent.data.worker_name, false);
        postMessage({
            type_cmd: 'worker_ready',
            worker_name: intent.data.worker_name
        });

    } else if (cmd == 'request_encode') {
        var coder = coder_map[intent.data.worker_name];
        if (intent.data.init.duration == 0) {
            intent.data.init.duration = 1;
        }
        coder.pendding_inputs.push(new VideoFrame(intent.data.frameData, intent.data.init));
        coder.count_input = coder.count_input + 1;

    } else if (cmd == 'request_decode') {

        let pts = Number(intent.data.pts);
        let duration = Number(intent.data.duration);
        if (!Number.isFinite(pts) || Math.abs(pts) >= 9e18) {
            if (typeof lastPts == 'undefined') {
                lastPts = 0;
                lastDuration = 0;
            }
            pts = lastPts + lastDuration;
            lastPts = pts;
            lastDuration = duration;

        }

        var chunk = new EncodedVideoChunk({
            type: intent.data.flag == 1 ? "key" : "delta",
            data: intent.data.pktData,
            timestamp: pts,
            duration: duration,
        });
        var coder = coder_map[intent.data.worker_name];
        coder.pendding_inputs.push(chunk);
        coder.count_input = coder.count_input + 1;

    } else if (cmd == CMD_BEE_FLUSH) {
        coder_map[intent.data.worker_name].request_flush = 1;
    } else if (cmd == 'check_ready') {
        postMessage({
            type_cmd: 'worker_ready'
        });
    } else if (cmd == CMD_BEE_PULL_DATA) {
        var coder = coder_map[intent.data.worker_name];
        if (!coder) {
            await new Promise(r => setTimeout(r, 20));
        }
        postMessage({
            type_cmd: CMD_BEE_PULL_DATA
        });
        // if (coder.count_input - Math.max(coder.count_decode, coder.count_encode) < 30) {
        //     postMessage({
        //         type_cmd: 'pull'
        //     });
        // } else {
        //     setTimeout(() => {
        //         onmessage(intent)
        //     }, 2);
        // }
    }
}