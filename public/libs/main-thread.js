importScripts(self.location.origin + "/libs/app_settings.js");//không có ?v=...
//khai báo
const MAX_DELAY_CODEC = 30;
var CONSOLE_ENABLE = 0;

var requestManager = {};
var flag_addr = 0;
var isEncoderVerified = 0;
var ffmpegModule = null;
var sleep_flags = [];
function setVariable() {
    requestManager = {};
    logcat = [];
    inputs = [];
    outputs = [];
    count_flush = 0;
    worker_pool = [];
    bufferReaderMap = {}; //{fd-position:data}

    // ✅ Reset thêm các biến FFmpeg state
    lineCode = 0;
    self.scale_width = 0;
    self.scale_height = 0;
    self.cmd_array = [];
    self.command = [];
    self.settings = {};

    // Reset global variables if they exist
    if (typeof currentSpeed !== 'undefined') {
        currentSpeed = 0;
    }

    requestCancel = false;
    decoded_format = null;
    hasError = null;
    sleep_flags = [];
    c=0;
}
setVariable();

function getSleepTime() {
    return 1005;
}

function set_flags(_flag_addr) {
    flag_addr = _flag_addr;
}

function readInputData(stream, buffer, offset, length, position) {

    var filename = stream.node.name;
    if ((filename.indexOf('%') > -1 && isUrl(decodeURIComponent(filename))) || filename.includes('.indb.')) {
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

function add_new_encoder(ptr, length, flag) {
    console.log('add_new_encoder called===================');
    addFlag(flag, 'add_new_encoder');
    var string = new TextDecoder().decode(new Uint8Array(ffmpegModule.HEAPU8.subarray(ptr, ptr + length)));
    var config = JSON.parse(string.replaceAll("`", `"`));
    if (config.encoding_needed == 0) {
        removeFlag(flag);
        return 0;
    }

    if ([27, 173, 226, 167].indexOf(config.codec_id) == -1) {
        removeFlag(flag);
        return 0;
    }
    var codecWorker = add_new_worker(config, true);


    removeFlag(flag);
    return 1;
}

function add_new_decoder(ptr, length, flag) {
    console.log('add_new_decoder called===================', flag);
    addFlag(flag, 'add_new_decoder');
    var string = new TextDecoder().decode(new Uint8Array(ffmpegModule.HEAPU8.subarray(ptr, ptr + length)));
    var config = JSON.parse(string.replaceAll("`", `"`));

    if (self.settings.videodecoder_enabled === false) {
        removeFlag(flag);
        return 0;
    }

    if ([27, 173, 226, 167].indexOf(config.codec_id) == -1) {
        removeFlag(flag);
        return 0;
    }

    add_new_worker(config, false);
    removeFlag(flag);

    return 1;
}

function cancelConvert() {
    console.log('Conversion cancelled by user.===============================');
    ffmpegModule.HEAPU8[flag_addr + 1] = 1;
}

async function freeMemory() {

    // Đợi tất cả worker cũ hoàn tất flush (nếu có)
    while (true) {
        for (let worker of worker_pool) {
            if (worker.flush_state !== 2) {
                await sleep(50);
                continue;
            }
        }
        break;
    }

    // Gửi lệnh flush + terminate cho các worker chưa hoàn tất
    for (let worker of worker_pool) {
        if (worker.flush_state !== 2) {
            count_flush++;
            worker.postMessage({
                type_cmd: CMD_BEE_CLOSE_CODER,
            });
        }
    }

    // Đợi tất cả worker phản hồi flush hoàn tất
    while (true) {
        for (let worker of worker_pool) {
            if (worker.closed !== true) {
                await sleep(50);
                continue;
            }
        }
        break;
    }

    // Terminate tất cả worker còn sót (an toàn hơn chỉ gán [] đơn thuần)
    worker_pool.forEach(worker => {
        if (worker && typeof worker.terminate === 'function') {
            try {
                worker.terminate();
                worker.onmessage = e => { }
            } catch (e) { }
        }
    });
    worker_pool = [];


    // Xóa file trong FS (nếu module còn sống)
    if (ffmpegModule && ffmpegModule.FS) {
        var file_array = [...inputs, ...outputs];
        for (var i = 0; i < file_array.length; i++) {
            var fPath = file_array[i];
            try {
                ffmpegModule.FS.unlink(fPath);
            } catch (e) { }
        }
    }


    // ============================================================================

    // Reset tất cả biến toàn cục
    setVariable();

    console.log('freeMemory completed - WASM module destroyed and memory released');
}

async function finishTranscode(code) {

    if (ffmpegModule.HEAPU8[flag_addr + 1] == 1) {


        ffmpegModule.HEAPU8[flag_addr + 1] = 0;

        if (hasError !== null) {
            const tmp_hasError = hasError;
            await freeMemory();
            var msg = {
                type_cmd: CMD_BEE_COMPLETE,
                error: tmp_hasError,
            }
            postMessage(msg);

        } else {
            await freeMemory();
            postMessage({
                type_cmd: CMD_BEE_READY,
            });
        }


        return;
    }

    var outputFiles = [];
    var transferable_objects = [];
    for (var i = 0; i < self.outputs.length; i++) {
        var outputPath = self.outputs[i];
        if (outputPath.length < 3) continue;
        if (isUrl(decodeURIComponent(outputPath))) {
            continue;
        }

        try {
            var fileData = ffmpegModule.FS.readFile(outputPath);
            transferable_objects.push(fileData.buffer);
            outputFiles.push({
                name: outputPath,
                ...(outputPath.includes('.indb.') == false ? { data: ffmpegModule.FS.readFile(outputPath) } : {}),
            });
        } catch (e) {
            console.error('Error reading output file outputPath====:', outputPath, e);
        }
    }

    var msg = {
        type_cmd: CMD_BEE_COMPLETE,
        sessionId: self.sessionId,
        outputFiles: outputFiles,
        decoded_format: decoded_format,
        logcat: logcat
    }

    await freeMemory();
    postMessage(msg, transferable_objects);

}

function flush_coder(file_index, index, is_encoder, flag) {
    console.log('flush_coder called with file_index:', file_index, 'index:', index, 'is_encoder:', is_encoder);
    var worker_name = get_name_for_worker(file_index, index, is_encoder);
    var worker = get_worker_by_name(worker_name);
    if (worker[CMD_BEE_FLUSH] !== true) {
        worker.flush_state = 1; //=1=>>yêu cầu flush nhưng chưa xong
        worker[CMD_BEE_FLUSH] = true;
        addFlag(flag, 'flush_coder');
        worker.flag = flag;
        worker.postMessage({
            type_cmd: CMD_BEE_FLUSH,
            worker_name: worker_name
        });
    }
}

function pull_data_coder(file_index, index, is_encoder, flag) {

    var worker_name = get_name_for_worker(file_index, index, is_encoder);
    var worker = get_worker_by_name(worker_name);
    addFlag(flag, 'pull_data_coder');
    worker.flag = flag;
    worker.postMessage({
        type_cmd: CMD_BEE_PULL_DATA,
        worker_name: worker_name
    });
}

self.get_new_pkt = function (file_index, stream_index, pkt_buffer, pts_pkt, duration_pkt, flag_pkt, size_pkt) {
    if (requestCancel == true) {
        return 541478725;
    }

    var worker_name = get_name_for_worker(file_index, stream_index, 1);
    var worker = get_worker_by_name(worker_name);
    var count_output = worker.count_output;
    var count_input = worker.count_input;
    var result = 0;
    if (worker.output.length > 0) {

        var { type, timestamp, duration, byteLength, data } = worker.output.shift();
        ffmpegModule.HEAPU8.set(data, pkt_buffer);
        if (type == 'key' && isEncoderVerified === 0) {
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
    } else {
        if (worker.flush_state == 1) {
            result = 102;
        } else if (worker.flush_state == 2 || requestCancel == true) {
            result = 541478725;
        } else if (count_input - count_output >= MAX_DELAY_CODEC) {
            result = 102;
        } else {
            result = 0;
        }
    }

    return result;
}

self.get_new_frame = function (file_index, stream_index, frame_buffer, format_frame, size_frame, decoded_width, decoded_height, pts_frame, flag_frame, duration_frame) {
    if (requestCancel == true) {
        return 541478725;
    }

    var worker_name = get_name_for_worker(file_index, stream_index, 0);
    var worker = get_worker_by_name(worker_name);


    var count_output = worker.count_output;
    var count_input = worker.count_input;
    var result = 0;

    if (worker.output.length > 0) {
        var intent = worker.output.shift();
        ffmpegModule.HEAPU8.set(intent.buffer, frame_buffer);
        ffmpegModule.HEAPU8[format_frame] = intent.format;
        if (decoded_format == null) decoded_format = intent.format;
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
        } else if (worker.flush_state == 2 || requestCancel == true) {
            result = 541478725;
        } else if (count_input - count_output >= MAX_DELAY_CODEC) {
            result = 102;
        } else {
            result = 0;
        }
    }
    return result;
}

self.request_decode_packet = function (file_index, stream_index, data, size, pts, flag, duration) {

    if (requestCancel == true) {
        return;
    }

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

var c=0;
self.request_encode_frame = function (file_index, index, data, frame_size, format, width, height, pts, pkt_duration) {
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

self.run_command = function (cmd_array) {
    console.log('Running FFmpeg command000:', cmd_array);
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
    var result = ffmpegModule.callMain(self.cmd_array);
}


self.onmessage = async function (intent) {
    if (!self.LIB_URLs) {
        self.LIB_URLs = intent.data.LIB_URLs;
        importScripts(self.LIB_URLs.COMMON_UTILS_URL);
        importScripts(self.LIB_URLs.FFMPEG_BEE_LIB_URL);
        importScripts(self.LIB_URLs.INDEXED_DB_API_URL);

        fileStorageDB = new IndexedDBFileStorage();
        await fileStorageDB.init();
        console.log('Worker initialized with LIB_URLs and IndexedDB ready.');
    }


    if (intent.data.type_cmd === CMD_BEE_CANCEL_CONVERT) {
        requestCancel = true;
        cancelConvert();
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
    self.browser_settings = intent.data.browser_settings || {};
    self.command = command;

    // đối với st thì giải phóng và tạo ffmpeg mới sau mỗi lần run, mt thì tái sử dụng.
    if (ffmpegModule != null && IS_SHARED_ARRAY_BUFFER_SUPPORTED == false) {
        isEncoderVerified = 0;
        ffmpegModule = null
    }


    if (!ffmpegModule) {
        console.log('Creating FFmpeg Module...>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
        isEncoderVerified = 0;
        ffmpegModule = await createFFmpegModule();
    }


    run_command(command);
}
threadingEnabled = true;
async function createFFmpegModule(wasm_url, ffmpeg_url) {
    // debugger;
    lineCode = 0;
    const module = await createFFmpeg({

        ENV: { ASYNCIFY: '1' },           // Signal để WASM biết
        ASYNCIFY_STACK_SIZE: 524288,       // Cấu hình memory,524288
        ASYNCIFY_IMPORTS: ['emscripten_sleep'], // Khai báo async functions

        print: (text) => {
            // logger.push(text);
            CONSOLE_ENABLE && console.error(text + '\nlineCode:' + lineCode, '|time===', Date.now());
            lineCode++;

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
        locateFile: e => e.endsWith(".wasm") ? self.LIB_URLs.WASM_BEE_LIB_URL : e,
        mainScriptUrlOrBlob: self.LIB_URLs.FFMPEG_BEE_LIB_URL,

    });


    return module;
}

function get_resolution_output_encoder(code_id, width, height) {
    // debugger;
    if (self.scale_width * self.scale_height) {
        return self.scale_width * 10000 + self.scale_height;
    } else {
        return 0;
    }
}

//
//========================= functions helper ==============================================================================//


function get_worker_by_name(name) {
    for (var i = 0; i < worker_pool.length; i++) {
        if (worker_pool[i].name == name) return worker_pool[i];
    }
}

function add_new_worker(config, is_encoder) {
    var name = get_name_for_worker(config.file_index, config.stream_index, is_encoder);
    var codecWorker = new Worker(self.LIB_URLs.ENCODE_DECODE_WORKER_URL, { name: name });
    codecWorker.config = config;
    codecWorker.name = name;
    codecWorker.output = [];
    codecWorker.flush_state = 0;//=0=>>không có gì || =1 yêu cầu flush nhưng chưa complete || =2, flush đã complete
    codecWorker.is_ready = 0;
    codecWorker.count_input = 0;
    codecWorker.count_output = 0;
    codecWorker.pull_state = 0;

    codecWorker.onmessage = function (intent) {
        var worker = intent.target;
        if (intent.data.type_cmd == 'worker_ready') {
            intent.target.is_ready = 1;
            ffmpegModule.HEAPU8[flag_addr] = 0;
        } else if (intent.data.type_cmd == 'new_video_chunk') {

            worker.output.push(intent.data.chunk);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.type_cmd == 'new_frame') {
            worker.output.push(intent.data);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.type_cmd == CMD_BEE_PULL_DATA) {
            if (worker.flag) {
                removeFlag(worker.flag);
                worker.flag = null;
            } else {
                throw new Error('Worker pull data but no flag set 1');
            }
        } else if (intent.data.type_cmd == CMD_BEE_FLUSH) {
            // debugger
            intent.target.flush_state = 2;
            intent.target.terminate();
            intent.target.onmessage = e => { }
            if (worker.flag) {
                removeFlag(worker.flag);
                worker.flag = null;
            } else {
                throw new Error('Worker pull data but no flag set 2');
            }

        } else if (intent.data.type_cmd == CMD_BEE_CLOSE_CODER) {
            worker.closed = true;
        } else if (intent.data.type_cmd == 'get_file_info') {
            ffmpegModule.callMain(self.array_cmd);
        } else if (intent.data.type_cmd == CMD_BEE_ERROR_CONFIG_CODER) {
            var is_encoder = intent.data.is_encoder;
            hasError = is_encoder ? 'encoder_error' : 'decoder_error';
            requestCancel = true;
            cancelConvert();
        }
    }
    worker_pool.push(codecWorker);
    codecWorker.postMessage({
        type_cmd: is_encoder ? 'setup_encoder' : 'setup_decoder',
        config: config,
        settings: self.settings,
        browser_settings: self.browser_settings,
        worker_name: codecWorker.name,
        LIB_URLs: self.LIB_URLs
    });
    codecWorker.onerror = function (error) {
        console.error('Error in worker', codecWorker.name, error);
    }

    return codecWorker;
}

function getLengthInput(filename, length) {

    if (filename.indexOf('%') > -1 && isUrl(decodeURIComponent(filename))) {
        length = getUrlLength(decodeURIComponent(filename));
    }
    if ((filename.indexOf('.indb.') > -1)) {
        return 1024 * 1024 * 1024 * 99;
    }
    return length;
}

timeToWrite = 0;

async function fileEvent(inputJson) {

    inputJson = JSON.parse(inputJson);
    addFlag(inputJson.flag, inputJson.event);


    var filename = inputJson.filename;

    if (inputJson.event == 'file_open') {
        if (filename.indexOf(':') > -1) {
            removeFlag(inputJson.flag);
            return;
        }

        if (inputs.indexOf(filename) > -1) {
            ffmpegModule.FS.writeFile(filename, new Uint8Array(1));
            removeFlag(inputJson.flag);
        } else if (filename.includes('.indb.')) {
            if (outputs.indexOf(filename) === -1) outputs.push(filename);
            var fileID = await fileStorageDB.findFileByName(filename);
            if (fileID) {
                await fileStorageDB.deleteFile(fileID.id);
            }
            removeFlag(inputJson.flag);
        } else {
            if (outputs.indexOf(filename) === -1) outputs.push(filename);
            removeFlag(inputJson.flag);
        }

    } else if (inputJson.event == 'file_read') {

        if (filename.includes('.indb.')) {

            var fileID = await fileStorageDB.findFileByName(filename);
            if (fileID) {
                var data = await fileStorageDB.readData(fileID.id, inputJson.pos, inputJson.size);
                bufferReaderMap[inputJson.fd + '-' + inputJson.pos] = new Uint8Array(data);
            } else {
                bufferReaderMap[inputJson.fd + '-' + inputJson.pos] = new Uint8Array(0);
            }
            removeFlag(inputJson.flag);
            return;
        } else if (filename.indexOf('%') > -1 && isUrl(decodeURIComponent(filename))) {

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
                //có cần set response = null ở đây ko nhỉ để giải phóng memory ko nhỉ
                response = null;
                requestManager[url] = Date.now();

                removeFlag(inputJson.flag);
            });
        } else {
            removeFlag(inputJson.flag);
        }

    } else if (inputJson.event == 'file_close') {
        removeFlag(inputJson.flag);
    } else if (inputJson.event == 'file_check') {
        removeFlag(inputJson.flag);
    } else if (inputJson.event == 'file_write') {

        if (filename.indexOf(':') > -1) {
            ffmpegModule.HEAPU8.set(int32ToArray(inputJson.size), 0);
            removeFlag(inputJson.flag);
            return;
        }


        if (inputJson.encrypt == 1) {
            console.log('Decrypting data for file:', filename);
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

        if (filename.includes('.indb.')) {
            var fileID = await fileStorageDB.findFileByName(filename);
            if (fileID == null) {
                var stringID = await fileStorageDB.createFile(filename);
                if (stringID) {
                    fileID = await fileStorageDB.findFileByName(filename);
                }
            }
            var file_data = new Uint8Array(ffmpegModule.HEAPU8.subarray(inputJson.buf, inputJson.buf + inputJson.size));

            await fileStorageDB.writeData(fileID.id, inputJson.pos, file_data);
            ffmpegModule.HEAPU8.set(int32ToArray(inputJson.size), inputJson.new_ret);
            removeFlag(inputJson.flag);
            return;
        }
        removeFlag(inputJson.flag);
        return;
    } else {
        removeFlag(inputJson.flag);
    }
}

function addFlag(flag, label = '') {
    // console.log('addFlag called with flag:', flag, 'label:', label);
    sleep_flags.push(flag);

}

function removeFlag(flag) {
    //console.log('removeFlag called with flag:', flag);
    sleep_flags = sleep_flags.filter(f => f != flag);
    ffmpegModule.HEAPU8[flag] = 0;
}