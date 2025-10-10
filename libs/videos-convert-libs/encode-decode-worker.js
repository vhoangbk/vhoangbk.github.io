importScripts("/libs/videos-convert-libs/constant.js");
importScripts(CONVERT_UTILS_URL);
importScripts(CODEC_HELPER_URL);


var coder_map = {}; //{name:(videodecoder|videoenco der)}
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
                    if (coder.is_encoder && coder.request_flush == 1 && coder.name != ex_encoder_key) {
                        coder.request_flush = 2;
                        await coder.flush();
                        coder.close();
                        postMessage({ cmd: 'flushed' });
                    } else if (!coder.is_encoder && coder.request_flush == 1 && coder.name != ex_decoder_key) {

                        coder.request_flush = 2;
                        coder.flushing = true;
                        await coder.flush();
                        coder.close();
                        if (coder_map[ex_encoder_key]) {
                            await coder_map[ex_encoder_key].flush();
                            coder_map[ex_encoder_key].close();
                        } else {
                            postMessage({ cmd: 'flushed' });
                        }

                        if (coder_map[ex_decoder_key]) {
                            await coder_map[ex_decoder_key].flush();
                            coder_map[ex_decoder_key].close();
                            postMessage({ cmd: 'flushed' });
                        } else {
                            postMessage({ cmd: 'flushed' });
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
                    var is_keyframe = coder.count_encode % 50 == 0;
                    
                    var frame = coder.pendding_inputs.shift();
                    if (!frame.format) {
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
            cmd: 'new_video_chunk',
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
    //   bitmap.close();
    return outputFrame;
}


function postFrame(frame) {
    const buffer = new Uint8Array(frame.allocationSize());
    frame.copyTo(buffer);
    postMessage({
        cmd: CMD_NEW_FRAME,
        pts: frame.timestamp,
        width: frame.displayWidth,
        height: frame.displayHeight,
        format: get_code_format_from_string(frame.format),
        duration: frame.duration,
        buffer: buffer
    }, [buffer.buffer]);
    frame.close();
}


function handleFrame(coder, frame) {

    if (coder.name == ex_decoder_key) {
        postFrame(frame);
    } else {

        var is_ok_format = frame.format == 'I420' || frame.format == 'NV12';
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

    var selected_mime_codec = await find_mime_codec_for_decoder(videodecoder.config.codec_id, videodecoder.config.dec_width, videodecoder.config.dec_height, videodecoder.config.mime_codec);
    if (!selected_mime_codec) {
        sendCmd(CMD_ERROR_DECODER_CONFIG, "error config_decoder pos:1");
        return;
    }
    var selected_method = await get_videodecoder_method(videodecoder.pendding_inputs[0], selected_mime_codec, videodecoder.config.dec_width, videodecoder.config.dec_height, videodecoder.name == ex_decoder_key);
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
                console.log('hungnote error encoder: ', e.message);
            },
        });

    } else {
        coder = new VideoDecoder({
            output: (frame) => {
                handleFrame(coder, frame);
            },
            error(e) {
                console.log('hungnote error decoder: ', e.message);
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
        if(config.output_file){
            var encoder_config = config.output_file.encoder_config
        }else{
            var encoder_config = await find_encoder_config(config.codec_id, config.fps, config.bitrate, config.enc_width, config.enc_height);
        }
        
        if (encoder_config) {
            console.log("encoder_config===", JSON.stringify(encoder_config));
            coder.encoder_config = encoder_config;
            coder.configure(encoder_config);
        } else {
            console.log("CMD_ERROR_ENCODER_CONFIG===", JSON.stringify(encoder_config));
            sendCmd(CMD_ERROR_ENCODER_CONFIG, "error CMD_ERROR_ENCODER_CONFIG");
        }
    } else {
        coder.init_decoder = false;
    }

}

self.onmessage = async function (intent) {

    var cmd = intent.data.cmd;

    if (cmd == 'setup_encoder') {
        self.app_settings = intent.data.app_settings;
        create_coder(intent.data.config, intent.data.worker_name, true);
        postMessage({
            cmd: 'worker_ready',
            worker_name: intent.data.worker_name
        });
    } else if (cmd == 'setup_decoder') {
        self.app_settings = intent.data.app_settings;
        create_coder(intent.data.config, intent.data.worker_name, false);
        postMessage({
            cmd: 'worker_ready',
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
        console.log('onmessage :flush123');
    } else if (cmd == 'check_ready') {
        postMessage({
            cmd: 'worker_ready'
        });
    } else if (cmd == 'pull') {
        postMessage({
            cmd: 'pull'
        });
    }
}