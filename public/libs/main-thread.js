importScripts("app_settings.js");//không có ?v=...
importScripts(COMMON_UTILS_URL);

//khai báo
const MAX_DELAY_CODEC = 60;
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

async function finishTranscode() {

    console.log('finishTranscode called hasCompletedFfmpeg ==', hasCompletedFfmpeg);
    if (hasCompletedFfmpeg > 0) {
        return;
    }
    //debugger;
    hasCompletedFfmpeg = 1;
    var outputFiles = [];
    var transferable_objects = [];
    if (self.outputs.length === 0) {
        const mainBroadcastChannel = new BroadcastChannel("app_channel");
        mainBroadcastChannel.postMessage({
            type_cmd: CMD_BEE_ERROR,
            msg: 'An error occurred, please try again (102)',
        });
        return
    }
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
self.run_command = function (cmd_array) {
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
 
    ffmpegModule.ccall('runcode', null, ['string'], [code_txt]);
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

const code_txt = `hZv5VsWRRvbpIwNGLVlAABgAglX9nFrA1A0d2mssy5SAuUWQT0C9VV6kDRENwlJgIJydZxgBpouFCA2l9I0U5N10dmt0mJg31URxmBZFX0CZsW9xSBgR9Bul2VK5yWSw5VyVVg9AEByAZ9VdsdlIg2CJldDzCzlogGNbRVpAuAY5XICAYRgY0VlbdWDFSoXxv2BNmmgkFVNIC1JkXnsRfIns7JXR29NIbxivWZcQVWy9VBSKHoWb93gRDAsvzcZZ3p2AR5EJGAmozmjZVUG0glsA3H9nvAmgyZkAD2mVnkmcgd9m72CVP1dQbzI2iTmlmNVSsZVRKWBoJ3mOyVIVbWozNvGlGmEoS2KlKBgZZV5vsmi5KJ9iIZKI3beBdAyT5ygRdiboJKClSdGBWYYILuz03RI5lWCuK9mvm9YfI2aALocp0wZZuWdVd9lvpAghKW4B9cdhGFAjZWZwoTgI0IIGWWPpLwGZKJAZZGIK0hIv3A0aGCOBXFKg0imcCxgAACXcXd59mcA0uIIIHFFATSYsDrfyykA0bGgIg9cgCy0uhKIRKFJKSFKWyCdAbDXI2nmdaZASKTMI5i2Nv2IslZsgUBS9dYmgGmgjpAVXG0yNOARIlWghWmW5nwyIiCl15PsXluYKsbJBXCAyBNEbRzXtmm5EuYZyCal0mfXL1RAIb=yg9IZA1ddZm2gn=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`;