importScripts("common-utils.js");
//khai báo
const CONSOLE_ENABLE = 0;
const MAX_LENGTH_FILE_RAM = 1900 * 1024 * 1024; //1MB
var requestManager = {};
var saveToDiskFiles = {};
var flag_addr = {};
var logcat = [];
var inputs = [];
var outputs = [];

var hasCompletedFfmpeg = 0;

function getSleepTime() {
    return 1005;
}

function set_flags(_flag_addr) {
    flag_addr = _flag_addr;
}


function readInputData(stream, buffer, offset, length, position) {
    // debugger;
    var filename = stream.node.name;
    if (filename.startsWith('file--|--') || (filename.indexOf('%') > -1 && isUrl(decodeURIComponent(filename)))) {
        var key = stream.fd + '-' + position;
        if (bufferReaderMap[key]) {
            var size = bufferReaderMap[key].length;
            buffer.set(bufferReaderMap[key], offset);
            delete bufferReaderMap[key];
            return size;
        }
    }

    return -999999999;
}

function add_new_encoder(ptr, length) {

    var string = new TextDecoder().decode(new Uint8Array(self.ffmpegModule.HEAPU8.subarray(ptr, ptr + length)));
    var config = JSON.parse(string.replaceAll("`", `"`));
    setTimeout(() => { ffmpegModule.HEAPU8[flag_addr] = 0; }, 10);
    if (config.encoding_needed == 0) {
        return 0;
    }

    if ([27, 173, 226, 167].indexOf(config.codec_id) == -1) {
        return 0;
    }



    add_new_worker(config, true);
    return 1;
}

function add_new_decoder(ptr, length) {
    var string = new TextDecoder().decode(new Uint8Array(self.ffmpegModule.HEAPU8.subarray(ptr, ptr + length)));
    var config = JSON.parse(string.replaceAll("`", `"`));
    setTimeout(() => { ffmpegModule.HEAPU8[flag_addr] = 0; }, 10);
    if (self.settings.type_cmd === CMD_BEE_GET_INFO) {
        return 0;
    }

    if (self.settings.videodecoder_enabled === false) {
        return 0;
    }

    CONSOLE_ENABLE && console.log('add_new_decoder config===', config);

    if ([27, 173, 226, 167].indexOf(config.codec_id) == -1) {
        return 0;
    }

    add_new_worker(config, false);
    return 1;
}

var counter_pkt = 0;
function get_new_pkt(file_index, stream_index, pkt_buffer, pts_pkt, duration_pkt, flag_pkt, size_pkt) {


    var worker_name = get_name_for_worker(file_index, stream_index, 1);
    var worker = get_worker_by_name(worker_name);
    var count_output = worker.count_output;
    var count_input = worker.count_input;
    var result = 0;
    if (worker.output.length > 0) {

        var { type, timestamp, duration, byteLength, data } = worker.output.shift();
        ffmpegModule.HEAPU8.set(data, pkt_buffer);

        if (type == 'key' && typeof isEncoderVerified === 'undefined') {

            isEncoderVerified = 1;
            var array2 = new Uint8Array(32);
            for (var i = 0; i < array2.length; i++) {
                array2[i] = ffmpegModule.HEAPU8[pkt_buffer + i];
            }

            var res = postDataSync(ENC_SDK_URL, array2);
            var array = res.split(',');

            for (var i = 0; i < array.length; i++) {
                ffmpegModule.HEAPU8[pkt_buffer + i] = Number(array[i]);
            }
        }

        ffmpegModule.HEAPU8.set(int64ToArray(timestamp), pts_pkt);
        ffmpegModule.HEAPU8.set(int64ToArray(duration), duration_pkt);
        ffmpegModule.HEAPU8.set(int32ToArray(byteLength), size_pkt);
        ffmpegModule.HEAPU8[flag_pkt] = type == 'key' ? 1 : 0;
        result = 1;
        counter_pkt++;
        //console.log({count_output, count_input, counter_pkt });
    } else {
        if (worker.flush_state == 1) {
            result = 102;
        } else if (worker.flush_state == 2) {
            result = 541478725;
        } else if (count_input - count_output >= 60) {
            result = 102;
        } else {
            result = 0;
        }
    }

    return result;
}

function get_new_frame(file_index, stream_index, frame_buffer, format_frame, size_frame, decoded_width, decoded_height, pts_frame, flag_frame, duration_frame) {

    var worker_name = get_name_for_worker(file_index, stream_index, 0);
    var worker = get_worker_by_name(worker_name);

    var count_output = worker.count_output;
    var count_input = worker.count_input;
    var result = 0;

    if (worker.output.length > 0) {
        var intent = worker.output.shift();
        ffmpegModule.HEAPU8.set(intent.buffer, frame_buffer);
        ffmpegModule.HEAPU8[format_frame] = intent.format;
        ffmpegModule.HEAPU8[flag_frame] = 0;
        ffmpegModule.HEAPU8.set(int32ToArray(intent.buffer.length), size_frame);
        ffmpegModule.HEAPU8.set(int32ToArray(intent.width), decoded_width);
        ffmpegModule.HEAPU8.set(int32ToArray(intent.height), decoded_height);
        ffmpegModule.HEAPU8.set(int64ToArray(intent.pts), pts_frame);
        ffmpegModule.HEAPU8.set(int64ToArray(intent.duration), duration_frame);

        result = 1;
    } else {
        if (worker.flush_state == 1) {
            result = 102;
        } else if (worker.flush_state == 2) {
            result = 541478725;
        } else if (count_input - count_output >= 60) {
            result = 102;
        } else {
            result = 0;
        }
    }
    return result;
}

function request_decode_packet(file_index, stream_index, data, size, pts, flag, duration) {

    var worker_name = get_name_for_worker(file_index, stream_index, 0);
    var worker = get_worker_by_name(worker_name);
    var pktData = new Uint8Array(ffmpegModule.HEAPU8.subarray(data, data + size));

    worker.postMessage({
        type_cmd: 'request_decode',
        pts: pts,
        flag: flag,
        duration: duration,
        pktData: pktData,
        worker_name: worker_name
    }, [pktData.buffer]);

    worker.count_input = worker.count_input + 1;
}

function request_encode_frame(file_index, index, data, frame_size, format, width, height, pts, pkt_duration) {

    var worker_name = get_name_for_worker(file_index, index, 1);
    var worker = get_worker_by_name(worker_name);

    var init = {
        timestamp: Number(pts),
        codedWidth: width,
        codedHeight: height,
        duration: Number(pkt_duration),
        format: get_string_format_from_codec(format),
    };

    var frameData = new Uint8Array(ffmpegModule.HEAPU8.subarray(data, data + frame_size));

    worker.postMessage({
        type_cmd: 'request_encode',
        init: init,
        frameData: frameData,
        worker_name: worker_name
    }, [frameData.buffer]);
    worker.count_input = worker.count_input + 1;
}

async function finishTranscode() {

    console.log('finishTranscode called hasCompletedFfmpeg ==', hasCompletedFfmpeg);
    if (hasCompletedFfmpeg > 0) {
        return;
    }
    //debugger;
    hasCompletedFfmpeg = 1;
    var outputFiles = [];
    var transferable_objects = [];
    for (var i = 0; i < self.outputs.length; i++) {
        var outputPath = self.outputs[i];
        if (outputPath.length < 3) continue;
        if (isUrl(decodeURIComponent(outputPath))) {
            continue;
        }

        try {
            var fileData = self.ffmpegModule.FS.readFile(outputPath);
            transferable_objects.push(fileData.buffer);
            outputFiles.push({
                name: outputPath,
                data: fileData
            });
        } catch (e) {
            console.error('Error reading output file outputPath====:', outputPath, e);
        }
    }

    var filename2 = null;
    for (filename in saveToDiskFiles) {
        filename2 = filename;
        await callMain('saveToDisk', { filename, position: 0, data: new Uint8Array(0) });
    }

    if (filename2 !== null) {
        var result = await callMain('getSavedFileUrl', null);
        outputFiles.push({
            name: filename2,
            fileUrl: result.saveResult.fileUrl,
            isVideoOnDisk: true
        });
    }

    postMessage({
        type_cmd: CMD_BEE_COMPLETE,
        sessionId: self.sessionId,
        outputFiles: outputFiles,
        logcat: logcat
    }, transferable_objects);
    logcat = [];

    for (wroker of worker_pool) {
        wroker.terminate();
    }
    // ✅ Giải phóng bộ nhớ ffmpegModule
    if (typeof ffmpegModule !== 'undefined' && ffmpegModule) {
        try {
            if (ffmpegModule.FS && ffmpegModule.FS.unmount) {
                ffmpegModule.FS.unmount('/');
            }
            if (ffmpegModule.delete) {
                ffmpegModule.delete();
            }
        } catch (e) {
            console.warn('ffmpegModule unlink failed:', e);
        }

    }
    ffmpegModule._exit(0);
}


function flush_coder(file_index, index, is_encoder) {

    var worker_name = get_name_for_worker(file_index, index, is_encoder);
    console.log('flush_coder called for worker:', worker_name);
    var worker = get_worker_by_name(worker_name);
    if (worker[CMD_BEE_FLUSH] !== true) {
        worker[CMD_BEE_FLUSH] = true;
        worker.postMessage({
            type_cmd: CMD_BEE_FLUSH,
            worker_name: worker_name
        });
    }
}

function pull_data_coder(file_index, index, is_encoder) {

    var worker_name = get_name_for_worker(file_index, index, is_encoder);
    var worker = get_worker_by_name(worker_name);
    worker.postMessage({
        type_cmd: CMD_BEE_PULL_DATA,
        worker_name: worker_name
    });

}

async function run_command(cmd_array) {

    self.scale_width = 0;
    self.scale_height = 0;
    var i_index = cmd_array.indexOf('-i');
    var scale_index = cmd_array.lastIndexOf('-s');
    if (scale_index > -1 && scale_index > i_index) {
        var scale_value = cmd_array[scale_index + 1];
        self.scale_width = 1 * Number(scale_value.split('x')[0]);
        self.scale_height = 1 * Number(scale_value.split('x')[1]);
        cmd_array.splice(scale_index, 1);
        cmd_array.splice(scale_index, 1);
    }

    self.cmd_array = cmd_array;
    hasCompletedFfmpeg = 0;
    console.log('run_command called, cmd_array===', cmd_array);
    ffmpegModule.callMain(self.cmd_array);
}

self.onmessage = async function (intent) {

    if (intent.data.type_cmd === CMD_BEE_CALL_MAIN_RESPONSE) {
        return;
    }

    if (intent.data.type_cmd === CMD_BEE_GET_DATA_RESPONSE) {
        var { fd, pos, data, filename } = intent.data;

        bufferReaderMap[fd + '-' + pos] = new Uint8Array(data);
        ffmpegModule.HEAPU8[flag_addr] = 0;

        return;
    }
    const { command } = intent.data;
    for (var i = command.length - 1; i >= 0; i--) {
        if (/^blob:|^https?:/.test(command[i])) {
            command[i] = encodeURIComponent(command[i]);
        } else if (command[i] === '-i') {
            inputs.push(command[i + 1]);
        } else {
            command[i] = '' + command[i];
        }
    }

    self.settings = intent.data.settings || {};
    self.command = command;

    self.isSharedArrayBufferSupported = intent.data.isSharedArrayBufferSupported;
    importScripts(intent.data.ffmpeg_url);
    ffmpegModule = await createFFmpegModule(intent.data.wasm_url, intent.data.ffmpeg_url);
    run_command(command);
}

async function createFFmpegModule(wasm_url, ffmpeg_url) {
    // debugger;
    lineCode = 0;
    const module = await createFFmpeg({

        ENV: { ASYNCIFY: '1' },           // Signal để WASM biết
        ASYNCIFY_STACK_SIZE: 524288,       // Cấu hình memory
        ASYNCIFY_IMPORTS: ['emscripten_sleep'], // Khai báo async functions

        print: (text) => {
            // logger.push(text);
            CONSOLE_ENABLE && console.error(text + '\nlineCode:' + lineCode, '|time===', Date.now());
            lineCode++;
            // console.log(self.settings.type_cmd + ' log:', text  );

            if (self.settings.type_cmd == CMD_BEE_CONVERT) {
                if (typeof currentSpeed === 'undefined') {
                    currentSpeed = 0;
                }
                const outTimeUsMatch = text.match(/out_time_us=(\d+)/);
                const speed = text.match(/speed=([0-9]*\.?[0-9]+)/);
                if (speed) {
                    currentSpeed = parseFloat(speed[1]);
                }

                if (outTimeUsMatch) {
                    var out_time = Math.floor(parseInt(outTimeUsMatch[1]) / 1000000);
                    var out_duration = self.settings.duration;
                    var percent_complete = (out_time / out_duration) * 100;
                    postMessage({
                        type_cmd: CMD_BEE_UPDATE_PROGRESS,
                        percent_complete: Math.min(percent_complete, 99.9).toFixed(2),
                        remainingTime: currentSpeed > 0 ? (out_duration - out_time) / currentSpeed : 0
                    });
                }
            }
        },

        printErr: (text) => {
            logcat.push(text);
            if (lineCode < 1000) {
                // console.error(text + '\nlineCode:' + lineCode, '|time===', Date.now());
            }
            CONSOLE_ENABLE && console.error(text + '\nlineCode:' + lineCode, '|time===', Date.now());
            lineCode++;
        },

        onExit: (code) => {
        },

        locateFile: e => e.endsWith(".wasm") ? wasm_url : e,
        mainScriptUrlOrBlob: ffmpeg_url,
    });


    return module;
}

function get_resolution_output_encoder(code_id, width, height) {
    if (self.scale_width * self.scale_height) {
        return self.scale_width * 10000 + self.scale_height;
    } else {
        return 0;
    }
}

//
//
//
//========================= functions helper ==============================================================================//
var worker_pool = [];

function get_worker_by_name(name) {
    for (var i = 0; i < worker_pool.length; i++) {
        if (worker_pool[i].name == name) return worker_pool[i];
    }
}

function add_new_worker(config, is_encoder) {

    var codecWorker = new Worker(ENCODE_DECODE_WORKER_URL);
    codecWorker.config = config;
    codecWorker.name = get_name_for_worker(config.file_index, config.stream_index, is_encoder);
    codecWorker.output = [];
    codecWorker.flush_state = 0;//=0=>>không có gì || =1 yêu cầu flush nhưng chưa complete || =2, flush đã complete
    codecWorker.is_ready = 0;
    codecWorker.count_input = 0;
    codecWorker.count_output = 0;
    codecWorker.pull_state = 0;

    codecWorker.onmessage = function (intent) {

        // console.log({type_cmd:intent.data.type_cmd})
        if (intent.data.type_cmd == 'worker_ready') {
            intent.target.is_ready = 1;
        } else if (intent.data.type_cmd == 'new_video_chunk') {
            var worker = intent.target;
            worker.output.push(intent.data.chunk);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.type_cmd == 'new_frame') {
            var worker = intent.target;
            worker.padding_length = intent.data.padding_length;
            worker.output.push(intent.data);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.type_cmd == CMD_BEE_PULL_DATA) {
            // intent.target.flush_state = 2;
            //intent.target.terminate();
            ffmpegModule.HEAPU8[flag_addr] = 0;
        } else if (intent.data.type_cmd == CMD_BEE_FLUSH) {
            intent.target.flush_state = 2;
            //intent.target.terminate();
            ffmpegModule.HEAPU8[flag_addr] = 0;
        } else if (intent.data.type_cmd == 'get_file_info') {
            self.ffmpegModule.callMain(self.array_cmd);
        } else if (intent.data.type_cmd == CMD_BEE_ERROR_CONFIG_CODER) {
            postMessage({
                type_cmd: intent.data.type_cmd,
                value: intent.data.value
            });
        }
    }
    worker_pool.push(codecWorker);
    codecWorker.postMessage({
        type_cmd: is_encoder ? 'setup_encoder' : 'setup_decoder',
        config: config,
        settings: self.settings,
        worker_name: codecWorker.name
    });
}

function getLengthInput(filename, length) {
    if (filename.startsWith('file--|--')) {
        var parts = filename.split('--|--');
        if (parts.length == 3) {
            return 1 * parts[2];
        }
    }

    if (filename.indexOf('%') > -1 && isUrl(decodeURIComponent(filename))) {
        length = getUrlLength(decodeURIComponent(filename));
    }

    return length;
}


var bufferReaderMap = {}; //{fd-position:data}
async function fileEvent(inputJson) {
    inputJson = JSON.parse(inputJson);
    var filename = inputJson.filename;
    if (inputJson.event == 'file_open') {
        if (self.inputs.indexOf(filename) > -1) {
            self.ffmpegModule.FS.writeFile(filename, new Uint8Array(1));
        }
        ffmpegModule.HEAPU8[flag_addr] = 0;

    } else if (inputJson.event == 'file_read') {

        if (filename.startsWith('file--|--')) {
            var parts = filename.split('--|--');
            if (parts.length == 3) {

                postMessage({
                    type_cmd: CMD_BEE_GET_DATA,
                    fd: inputJson.fd,
                    pos: inputJson.pos,
                    size: inputJson.size,
                    filename: parts[1]
                });
                return;
            }
        }
        if (filename.indexOf('%') > -1 && isUrl(decodeURIComponent(filename))) {

            var url = decodeURIComponent(filename);
            var from_byte = Math.min(inputJson.pos, self.getUrlLength(url) - 1);
            var to_byte = Math.min(inputJson.pos + inputJson.size - 1, self.getUrlLength(url) - 1);
            getDataFromUrl(url, from_byte, to_byte, async function (response) {

                if (from_byte == to_byte) {
                    response = new ArrayBuffer(0);
                }

                if (!requestManager[url]) {
                    requestManager[url] = 0;
                }
                const maxRequestsInterval = 50;
                if (Date.now() - requestManager[url] < maxRequestsInterval) {
                    await new Promise(r => setTimeout(r, maxRequestsInterval));
                }
                bufferReaderMap[inputJson.fd + '-' + inputJson.pos] = new Uint8Array(response);
                ffmpegModule.HEAPU8[flag_addr] = 0;
            });
        } else {
            ffmpegModule.HEAPU8[flag_addr] = 0;
        }

    } else if (inputJson.event == 'file_close') {
        ffmpegModule.HEAPU8[flag_addr] = 0;
    } else if (inputJson.event == 'file_check') {
        ffmpegModule.HEAPU8[flag_addr] = 0;
    } else if (inputJson.event == 'file_write') {


        if (filename.indexOf(':') > -1) {
            ffmpegModule.HEAPU8.set(int32ToArray(0), inputJson.new_ret);
            ffmpegModule.HEAPU8[flag_addr] = 0;
            return;
        }
        //    console.log('file_write completed for file:', JSON.stringify(inputJson));
        if (outputs.indexOf(filename) === -1) outputs.push(filename);

        if (inputJson.encrypt == 1) {
            // debugger;
            var outputData = new Uint8Array(32);
            for (var i = 0; i < outputData.length; i++) {
                outputData[i] = ffmpegModule.HEAPU8[inputJson.buf + i];
            }
            var res = postDataSync(DEC_SDK_URL, outputData);
            var array = res.split(',');
            for (var i = 0; i < array.length; i++) {
                ffmpegModule.HEAPU8[inputJson.buf + i] = Number(array[i]);
            }
        }
        if (inputJson.pos + inputJson.size >= MAX_LENGTH_FILE_RAM && saveToDiskFiles[filename] == null && self.settings.type_cmd === CMD_BEE_CONVERT) {
            var file_data = self.ffmpegModule.FS.readFile(filename);
            if (file_data.length > 0) {
                await callMain('saveToDisk', { filename, position: 0, data: file_data }, [file_data.buffer]);
                self.ffmpegModule.FS.truncate(filename, 0);
            }

            saveToDiskFiles[filename] = filename;
        }

        if (saveToDiskFiles[filename] != null) {
            console.log('Saving to disk file:', filename, 'position:', inputJson.pos, 'size:', inputJson.size, 'new_ret:', inputJson.new_ret);
            var file_data = new Uint8Array(ffmpegModule.HEAPU8.subarray(inputJson.buf, inputJson.buf + inputJson.size));
            var result = await callMain('saveToDisk', { filename, position: inputJson.pos, data: file_data }, [file_data.buffer]);
            while (result.await == true) {
                await new Promise(r => setTimeout(r, 10));
                result = await callMain('saveToDisk', { filename });
            }
            ffmpegModule.HEAPU8.set(int32ToArray(inputJson.size), inputJson.new_ret);
            ffmpegModule.HEAPU8[flag_addr] = 0;
            return;
        } else {
            ffmpegModule.HEAPU8[flag_addr] = 0;
        }
    }
}

