importScripts(self.location.origin + "/libs/app_settings.js");//không có ?v=...

var requestCancel = false;
var coder = null;

async function fix_format_null(frame) {

    const bitmap = await createImageBitmap(frame);
    const outputFrame = new VideoFrame(bitmap, {
        timestamp: frame.timestamp,
        alpha: "discard"//rgba == >> rgbx
    });
    frame.close();
    bitmap.close();
    return outputFrame;
}


function safeCloseResource(resource) {
    if (resource && typeof resource.close === 'function') {
        try {
            resource.close();
        } catch (err) {
            // swallow close errors to avoid crashing worker
        }
    }
}

function drainPendingInputs(coder) {
    if (!coder || !Array.isArray(coder.pendding_inputs) || coder.pendding_inputs.length === 0) {
        return;
    }

    while (coder.pendding_inputs.length > 0) {
        const input = coder.pendding_inputs.shift();
        safeCloseResource(input);
    }
}

async function closeCoderResources(coder) {
    if (!coder) {
        return;
    }

    // ✅ Flush queue trước khi close để xử lý hết pending tasks
    if (coder.state === 'configured') {
        try {
            await coder.flush();
        } catch (err) {
            // flush error, continue to drain
        }
    }

    // ✅ Drain tất cả pending inputs
    drainPendingInputs(coder);

    // ✅ Close coder
    if (coder.state !== 'closed') {
        try {
            coder.close();
        } catch (err) {
            // suppress close errors
        }
    }
}

(
    async function input_looper() {
        while (true) {
            //   console.log('input_looper tick...');
            if (requestCancel) {
                break;
            }

            if (coder == null) {
                await new Promise(r => setTimeout(r, 10));
                continue;
            }

            //====11
            if (coder.pendding_inputs.length == 0) {
                //console.log('No pending inputs for coder:', coder.name);
                if (coder.request_flush == 1 && coder.state == 'configured') {

                    coder.request_flush = 2;
                    const targetCoder = coder;
                    targetCoder.flush().then(async () => {
                        targetCoder.close();

                        while (typeof sendQueue !== 'undefined' && sendQueue.length > 0 && !requestCancel) {
                            await new Promise(r => setTimeout(r, 5));
                            continue;
                        }

                        console.log(coder.name + ' flushed and closed');
                        postMessage({ type_cmd: CMD_BEE_FLUSH });
                    });
                }
                await new Promise(r => setTimeout(r, 1));
                continue;
            }

            if (coder.state != 'configured') {

                if (coder.is_setup == false) {
                    coder.is_setup = true;
                    config_coder(coder, coder.pendding_inputs[0]);
                }
                await new Promise(r => setTimeout(r, 1));
                continue;
            }
            const max_queue = 2;
            var queue_size = coder.is_encoder ? coder.encodeQueueSize : coder.decodeQueueSize;
            if (queue_size > max_queue) {
                await new Promise(r => setTimeout(r, 1));
                continue;
            }

            if (coder.is_encoder) {
                const fps = coder.config.framerate_den > 0 ? coder.config.framerate_num / coder.config.framerate_den : 24;
                const gopSize = Math.min(fps * 1, is_safari == true ? 24 : 24);
                //safari gop-szie 5-15, note: can xem lai voi safari
                var is_keyframe = coder.count_encode % gopSize == 0;

                //-----


                // var is_keyframe = coder.count_encode % gopSize == 0;



                if (is_keyframe && coder.settings?.target_size && coder.count_output_keyframe_segment >= 4) {
                    // debugger;
                    await coder.flush();
                    if (!is_safari) {
                        coder.reset();
                    }
                    var out_duration = coder.count_output_chunk_segment / fps;
                    var out_duration_total = coder.count_output / fps;
                    var bitrate_current = 8 * coder.count_output_length_segment / out_duration;

                    var bitrate_output_total = 8 * coder.count_output_length_total / out_duration_total;
                    var bitrate_target = coder.config.bit_rate;
                    var bitrate_ratio = bitrate_current / coder.current_config.bitrate;

                    var new_bitrate = bitrate_target - (bitrate_output_total - bitrate_target) * out_duration_total / out_duration;
                    new_bitrate = new_bitrate / bitrate_ratio;
                    new_bitrate = Math.max(bitrate_target / 8, Math.min(new_bitrate, bitrate_target * 8)); //min 100kbps
                    coder.current_config.bitrate = Math.max(new_bitrate & ~0, 10000);


                    coder.configure(coder.current_config);
                    coder.count_output_chunk_segment = 0;
                    coder.count_output_length_segment = 0;
                    coder.count_output_keyframe_segment = 0;
                }



                //-----
                var frame = coder.pendding_inputs.shift();

                const formats = ['I420', 'NV12', 'NV21', 'RGBA', 'RGBX', 'BGRA', 'BGRX'];
                if (!formats.includes(frame.format)) {
                    //trong function fix_format_null đã close frame rồi.
                    frame = await fix_format_null(frame);
                }
                var encodeOptions = {};

                encodeOptions.keyFrame = is_keyframe;
                if (coder.settings && coder.settings.quantizer) {
                    debugger;
                    if (coder.settings.format_name === 'av1' || coder.settings.format_name === 'vp9') {
                        encodeOptions[coder.settings.format_name] = { quantizer: coder.settings.quantizer };
                    }
                }

                if (self.settings.format_name == 'av1' && frame.format != 'RGBX') {
                    frame = await fix_format_null(frame);
                }

                coder.encode(frame, encodeOptions);
                coder.count_encode = coder.count_encode + 1;
                frame.close();
                continue;
            } else {
                //  debugger;
                var chunk = coder.pendding_inputs.shift();
                // console.log('Decoding chunk with timestamp:', chunk.timestamp, 'and byteLength:', chunk.byteLength);
                coder.decode(chunk);
                coder.count_decode = coder.count_decode + 1;

                continue;
            }
        }
    }
)();
var timestamp = 0;
function handleChunk(coder, chunk, config) {
    coder.count_output = coder.count_output + 1;

    coder.count_output_length_total += chunk.byteLength;
    coder.count_output_length_segment += chunk.byteLength;
    coder.count_output_chunk_segment += 1;

    if (chunk.type == 'key') {
        coder.count_output_keyframe_segment += 1;
    }


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
}

function handleFrame(frame) {

    if (typeof sendQueue == 'undefined') {
        sendQueue = [];
        sendFrame = async function () {
            while (1) {
                if (requestCancel) {
                    //close tất cả những frame còn trong sendQueue
                    for (var i = 0; i < sendQueue.length; i++) {
                        var f = sendQueue[i];
                        f.close();
                    }
                    sendQueue = [];
                    break;
                }
                if (sendQueue.length == 0) {
                    await new Promise(r => setTimeout(r, 1));
                    continue;
                }
                var frame = sendQueue.shift();
                const formats = ['I420', 'NV12', 'NV21', 'RGBA', 'RGBX'];
                if (!formats.includes(frame.format)) {
                    frame = await fix_format_null(frame);
                }
                await postFrame(frame);
            }
        }
        sendFrame();
    }

    sendQueue.push(frame);
}



async function config_coder(coder, sample) {
    try {
        if (coder.is_encoder) {

            var config = await findVideoEncoderConfig(self.browser_settings, coder.config.codec_id, coder.config.enc_width, coder.config.enc_height, coder.config.framerate_den > 0
                ? coder.config.framerate_num / coder.config.framerate_den : 30, coder.config.bit_rate > 0 ? coder.config.bit_rate : 0, sample);

            if (!config) {
                console.log("error không tìm thấy config encoder===", JSON.stringify(coder.config));
                error_coder(coder);
                return;
            }

            if (coder.settings && coder.settings.quantizer) {
                debugger;
                config.bitrateMode = "quantizer";
                config.latencyMode = "quality";
            }

            console.log("encoder config 000===", JSON.stringify(config));
            coder.configure(config);
            coder.current_config = config;
        } else {

            var config = await findBestVideoDecoderConfig(coder.config.codec_id, sample, coder.config.dec_width, coder.config.dec_height);
            if (config) {
                console.log("decoder config 000===", JSON.stringify(config.config));
                coder.configure(config.config);
            } else {
                console.log("error không tìm thấy config decoder===", JSON.stringify(coder.config));
                coder.config_error = true;
                error_coder(coder);
                // postMessage({
                //     type_cmd: CMD_BEE_ERROR_CONFIG_CODER,
                //     is_encoder: coder.is_encoder,
                //     name: coder.name
                // });
            }

        }

    } catch (error) {
        console.log("error coder_config===", error);

        // ✅ Close sample frame if it's a VideoFrame
        if (sample && typeof sample.close === 'function') {
            try {
                sample.close();
            } catch (closeErr) {
                // suppress close errors
            }
        }

        error_coder(coder);

    }

}

async function create_coder(config, name, is_encoder) {

    if (is_encoder) {
        coder = new VideoEncoder({
            output: (encodedVideoChunk, config) => {
                handleChunk(coder, encodedVideoChunk, config);
            },
            error(e) {
                console.error('hungnote error encoder==================: ', e);
                error_coder(coder);
            },
        });

    } else {
        coder = new VideoDecoder({
            output: (frame) => {
                coder.count_output = coder.count_output + 1;
                handleFrame(frame);
            },
            error(e) {
                console.error('hungnote error decoder==================: ', e);
                error_coder(coder);
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
    coder.is_setup = false;
    if (is_encoder) {
        coder.settings = self.settings;

        coder.count_output_length_total = 0;
        coder.count_output_length_segment = 0;
        coder.count_output_chunk_segment = 0;
        coder.count_output_keyframe_segment = 0;

    }
}

function error_coder(coder) {
    requestCancel = true;
    postMessage({
        type_cmd: CMD_BEE_ERROR_CONFIG_CODER,
        is_encoder: coder.is_encoder,
        name: coder.name
    });
}

self.onmessage = async function (intent) {

    var cmd = intent.data.type_cmd;
    if (cmd == 'setup_encoder') {
        self.LIB_URLs = intent.data.LIB_URLs;
        importScripts(self.LIB_URLs.COMMON_UTILS_URL);
        importScripts(self.LIB_URLs.CODEC_HELPER_URL);
        self.settings = intent.data.settings;
        self.browser_settings = intent.data.browser_settings;
        create_coder(intent.data.config, intent.data.worker_name, true);
        postMessage({
            type_cmd: 'worker_ready',
            worker_name: intent.data.worker_name
        });
    } else if (cmd == 'setup_decoder') {
        self.LIB_URLs = intent.data.LIB_URLs;
        importScripts(self.LIB_URLs.COMMON_UTILS_URL);
        importScripts(self.LIB_URLs.CODEC_HELPER_URL);
        self.app_settings = intent.data.app_settings;
        create_coder(intent.data.config, intent.data.worker_name, false);
        postMessage({
            type_cmd: 'worker_ready',
            worker_name: intent.data.worker_name
        });

    } else if (cmd == 'request_encode') {
        if (intent.data.init.duration == 0) {
            intent.data.init.duration = 1;
        }

        var frame = new VideoFrame(intent.data.frameData, intent.data.init);
        coder.pendding_inputs.push(frame);
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
            type: intent.data.flag == 1 || intent.data.flag == 5 ? "key" : "delta",
            data: intent.data.pktData,
            timestamp: pts,
            duration: duration,
        });
        coder.pendding_inputs.push(chunk);
        coder.count_input = coder.count_input + 1;

    } else if (cmd == CMD_BEE_FLUSH) {
        if (coder.config_error == true) {
            await closeCoderResources(coder);
            postMessage({ type_cmd: CMD_BEE_FLUSH });
            return;
        }
        if (coder.count_input == 0) {
            //không có dữ liệu để encode/decode.
            postMessage({ type_cmd: CMD_BEE_FLUSH });
            return;
        }

        if (coder.state == 'closed') {
            postMessage({ type_cmd: CMD_BEE_FLUSH });
            return;
        }
        coder.request_flush = 1;


    } else if (cmd == CMD_BEE_CLOSE_CODER) {
        requestCancel = true;
        if (coder) {
            await closeCoderResources(coder);
        }
        postMessage({ type_cmd: CMD_BEE_CLOSE_CODER });

    } else if (cmd == 'check_ready') {
        postMessage({
            type_cmd: 'worker_ready'
        });
    } else if (cmd == CMD_BEE_PULL_DATA) {
        if (!coder) {
            await new Promise(r => setTimeout(r, 20));
        }
        postMessage({
            type_cmd: CMD_BEE_PULL_DATA
        });
    }
}
