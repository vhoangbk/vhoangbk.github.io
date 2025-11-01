importScripts("constant.js");
importScripts('common-utils.js');
importScripts('ffmpeg-st-gpl.js');


var is_check = 0;
var count_read_input = 0;

var worker_pool = [];
var output_value = [];

var above_max = 30;
var current_cmd = '';
var enable_videodecoder = true;
var file_map = {};
var writable_map = {};

var nameInputs = [];
var nameOutputs = [];
var writeQueue = [];

self.getScriptText = function () {
    return ``;
}

self.set_flags = function (flag_addr) {
    self.flag_addr = flag_addr;
}

function requestPause(index) {
    ffmpegModule.HEAPU8[self.flag_addr] = 1;
}

function requestResume(index) {
    ffmpegModule.HEAPU8[self.flag_addr] = 0;
    self.ffmpegModule._resumeTranscode();
}

function get_resolution_output_encoder(code_id, width, height) {
    if (self.scale_width * self.scale_height) {
        return self.scale_width * 10000 + self.scale_height;
    } else {
        return 0;
    }
}

function get_worker_name(file_index, stream_index, is_encoder) {
    if (is_encoder) {
        return `encoder-file_index=${file_index}-stream_index=${stream_index}`;
    } else {
        return `decoder-file_index=${file_index}-stream_index=${stream_index}`
    }
}

/**
 * 
 * @param {*} stream 
 * @param {*} buffer 
 * @param {*} offset: vị trí bắt đầu của stream (của file) trong bộ nhớ.
 * @param {*} length: độ dài dữ liệu cần ghi.
 * @param {*} position: vị trí bắt đầu viết dữ liệu. (cần seek)
 * @param {*} canOwn: có thể sở hữu bộ nhớ không.
 * @returns 
 */
self.writeOutputData = function (stream, buffer, offset, length, position, canOwn) {

    if (typeof countWriteStore === 'undefined') {
        countWriteStore = {};
    }
    var filename = stream.node.name;

    if (typeof countWriteStore[filename] === 'undefined') {
        countWriteStore[filename] = 0;
    }
    countWriteStore[filename] = countWriteStore[filename] + 1;



    if (length <= 1) {
        return -1;
    }

    if (self.writable_map[filename]) {
        writeQueue.push(
            {
                writableFileName: filename,
                data: new Uint8Array(buffer.subarray(offset, offset + length)),
                position: position
            });

        return length;
    }

    //  console.log("writeOutputData: not found writable file ", self.abc);

    if (countWriteStore[filename] == 89) {
        var outputData = new Uint8Array(32);
        for (var i = 0; i < outputData.length; i++) {
            outputData[i] = buffer[offset + i];
        }

        var res = postDataSync(DEC_SDK_URL, outputData);

        //    console.log("writeOutputData: postDataSync ", res);
        var array = res.split(',');
        for (var i = 0; i < array.length; i++) {
            buffer[offset + i] = Number(array[i]);
        }
    }

    return -1;
}


this.readInputData = function (stream, buffer, offset, length, position) {

    var filename = stream.node.name;
    if (position == 0) {
        length = Math.min(length, 1024 * 128);
    } else {
        length = Math.min(length, 1024 * 1204 * 8);
    }


    if (self.file_map[filename] && nameInputs.indexOf(filename) >= 0) {
        var file = self.file_map[filename];
        const reader = new FileReaderSync();
        var buf = new Uint8Array(reader.readAsArrayBuffer(file.slice(position, position + length)));
        size = buf.length;
        buffer.set(buf, offset);
        return size;
    }

    if (filename.indexOf('blob%3Ahttp') == 0 || filename.indexOf('http%3A') == 0 || filename.indexOf('https%3A') == 0) {
        var url = decodeURIComponent(stream.node.name);

        var from_byte = Math.min(position, self.getUrlLength(url) - 1);
        var to_byte = Math.min(position + length - 1, self.getUrlLength(url) - 1);

        if (from_byte == to_byte) {
            buffer[offset] = 0;
            return 0;
        }

        var size = 0;
        var bytes = new Uint8Array(getDataFromUrlSync(url, from_byte, to_byte, self.getUrlLength(url) - 1));
        size = bytes.length;
        buffer.set(bytes, offset);
        return size;
    }

    return -999999999;
}

/**
 * 
 * @param {*} is_last 
 * nếu is_last = 1, thì đầu vào đã lấy đủ hoặc kết thúc. Đầu ra cần flush.
 */
this.pausePerform = async function (is_last) {

    await pullWriteQueue();

    self.interval = setInterval(function () {

        var is_all_finish = true;
        for (var i = 0; i < worker_pool.length; i++) {
            if (worker_pool[i].is_ready == 0) {
                is_all_finish = false;
                break;
            }

            if (is_last == 1) {
                //tại mỗi thời điểm, worker chỉ được flush hoặc pull
                if (worker_pool[i].flush_state == 0 && worker_pool[i].pull_state == 0) {
                    worker_pool[i].flush_state = 1;
                    worker_pool[i].postMessage({
                        cmd: 'flush',
                        worker_name: worker_pool[i].name
                    });
                }
            } else {
                //tại mỗi thời điểm, worker chỉ được flush hoặc pull
                if (worker_pool[i].flush_state == 0 && worker_pool[i].pull_state == 0) {
                    worker_pool[i].pull_state = 1;
                    worker_pool[i].postMessage({
                        cmd: 'pull',
                        worker_name: worker_pool[i].name
                    });
                }
            }

            if (worker_pool[i].flush_state == 1 || worker_pool[i].pull_state == 1) {
                is_all_finish = false;
                break;
            }
        }
        if (is_all_finish) {
            for (var i = 0; i < worker_pool.length; i++) {
                if (worker_pool[i].flush_state == 0) {
                    worker_pool[i].pull_state = 0;
                }
            }
            clearInterval(self.interval);
            requestResume(1);

        }

    }, 1);
}

this.add_new_encoder = function (ptr, length) {
    if (current_cmd === CMD_GET_FILE_INFO) {
        return 0;
    }
    var string = new TextDecoder().decode(new Uint8Array(self.ffmpegModule.HEAPU8.subarray(ptr, ptr + length)));
    var config = JSON.parse(string.replaceAll("`", `"`));
    if (config.encoding_needed == 0) {
        return 0;
    }
    if ([27, 173, 226, 167].indexOf(config.codec_id) == -1) {
        return 0;
    }
    config.output_file = self.output_file;
    add_new_worker(config, true);
    return 1;
}


function add_new_worker(config, is_encoder) {

    var codecWorker = new Worker(ENCODE_DECODE_WORKER_URL);
    codecWorker.config = config;
    codecWorker.name = get_worker_name(config.file_index, config.stream_index, is_encoder);
    codecWorker.output = [];
    codecWorker.flush_state = 0;//=0=>>không có gì || =1 yêu cầu flush nhưng chưa complete || =2, flush đã complete
    codecWorker.is_ready = 0;
    codecWorker.count_input = 0;
    codecWorker.count_output = 0;
    codecWorker.pull_state = 0;

    codecWorker.onmessage = function (intent) {


        if (intent.data.cmd == 'worker_ready') {
            intent.target.is_ready = 1;
        } else if (intent.data.cmd == 'new_video_chunk') {
            var worker = intent.target;
            worker.output.push(intent.data);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.cmd == 'new_frame') {
            var worker = intent.target;
            worker.padding_length = intent.data.padding_length;
            worker.output.push(intent.data);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.cmd == 'flushed') {
            intent.target.flush_state = 2;
            intent.target.terminate();
        } else if (intent.data.cmd == 'pull') {
            intent.target.pull_state = 2;
        } else if (intent.data.cmd == 'get_file_info') {
            self.ffmpegModule.callMain(self.array_cmd);
        } else if (intent.data.cmd == CMD_ERROR_DECODER_CONFIG || intent.data.cmd == CMD_ERROR_ENCODER_CONFIG) {
            postMessage({
                cmd: intent.data.cmd,
                value: intent.data.value
            });
        }
    }
    worker_pool.push(codecWorker);
    codecWorker.postMessage({
        cmd: is_encoder ? 'setup_encoder' : 'setup_decoder',
        config: config,
        app_settings: self.app_settings,
        worker_name: codecWorker.name
    });

    requestPause();

}

this.add_new_decoder = function (ptr, length) {
    if (current_cmd === CMD_GET_FILE_INFO) {
        return 0;
    }
    if (!enable_videodecoder) {
        return 0;
    }


    var string = new TextDecoder().decode(new Uint8Array(self.ffmpegModule.HEAPU8.subarray(ptr, ptr + length)));
    var config = JSON.parse(string.replaceAll("`", `"`));

    if ([27, 173, 226, 167].indexOf(config.codec_id) == -1) {
        return 0;
    }

    add_new_worker(config, false);
    return 1;
}

function get_worker_by_name(name) {
    for (var i = 0; i < worker_pool.length; i++) {
        if (worker_pool[i].name == name) return worker_pool[i];
    }
}



self.flush_coder = function (file_index, index, is_encoder) {

    var worker_name = get_worker_name(file_index, index, is_encoder);
    var worker = get_worker_by_name(worker_name);
    if (worker.flush_state == 0) {
        worker.flush_state = 1;
        requestPause();
        worker.postMessage({
            cmd: 'flush',
            worker_name: worker_name
        });
    }

}

self.get_new_pkt = function (file_index, stream_index, pkt_buffer, pts_pkt, duration_pkt, flag_pkt, size_pkt) {

    var worker_name = get_worker_name(file_index, stream_index, 1);
    var worker = get_worker_by_name(worker_name);
    if (worker.output.length > 0) {
        var intent = worker.output.shift();
        var byteLength = intent.chunk.byteLength;
        intent.chunk.copyTo(ffmpegModule.HEAPU8.subarray(pkt_buffer, pkt_buffer + byteLength));
        if (intent.chunk.type == 'key' && is_check == 0) {

            is_check = 1;
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

        ffmpegModule.HEAPU8.set(int64ToArray(intent.chunk.timestamp), pts_pkt);
        ffmpegModule.HEAPU8.set(int64ToArray(intent.chunk.duration), duration_pkt);
        ffmpegModule.HEAPU8.set(int32ToArray(byteLength), size_pkt);
        ffmpegModule.HEAPU8[flag_pkt] = intent.chunk.type == 'key' ? 1 : 0;
        return 1;
    } else {
        if (worker.flush_state == 2) {
            return 99;
        } else {
            return 0;
        }
    }
}

self.get_new_frame = function (file_index, stream_index, frame_buffer, format_frame, size_frame, decoded_width, decoded_height, pts_frame, flag_frame, duration_frame) {

    var worker_name = get_worker_name(file_index, stream_index, 0);
    var worker = get_worker_by_name(worker_name);
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
        return 1;
    } else {
        if (worker.flush_state == 2) {
            return 99;
        } else {
            return 0;
        }
    }

}

function check_need_pause() {
    var need_pause = false;
    for (var i = 0; i < worker_pool.length; i++) {
        if (worker_pool[i].count_input - worker_pool[i].count_output >= above_max) {
            need_pause = true;
            break;
        }
    }

    if (need_pause) {
        requestPause();
    }

}


self.request_decode_packet = function (file_index, stream_index, data, size, pts, flag, duration) {

    var worker_name = get_worker_name(file_index, stream_index, 0);
    var worker = get_worker_by_name(worker_name);
    var pktData = new Uint8Array(ffmpegModule.HEAPU8.subarray(data, data + size));

    worker.postMessage({
        cmd: 'request_decode',
        pts: pts,
        flag: flag,
        duration: duration,
        pktData: pktData,
        worker_name: worker_name
    }, [pktData.buffer]);

    worker.count_input = worker.count_input + 1;
    check_need_pause();
}

self.request_encode_frame = function (file_index, index, data, frame_size, format, width, height, pts, pkt_duration) {

    var worker_name = get_worker_name(file_index, index, 1);
    var worker = get_worker_by_name(worker_name);
    var pts_value = Number(pts);

    if (!worker.next_pts) {
        worker.next_pts = pts_value;
        worker.step_pts = 0;
    } else {
        if (worker.step_pts == 0) {
            worker.step_pts = pts_value - worker.next_pts;
        }
        worker.next_pts = worker.next_pts + worker.step_pts;
    }

    var init = {
        timestamp: worker.next_pts,
        codedWidth: width,
        codedHeight: height,
        duration: Number(pkt_duration),
        format: get_string_format_from_codec(format),
    };

    var frameData = new Uint8Array(ffmpegModule.HEAPU8.subarray(data, data + frame_size));

    worker.postMessage({
        cmd: 'request_encode',
        init: init,
        frameData: frameData,
        worker_name: worker_name
    }, [frameData.buffer]);
    worker.count_input = worker.count_input + 1;
    check_need_pause();
}

self.getLengthInput = function (name, length) {

    if (self.file_map[name]) {
        length = self.file_map[name].size;
    } else if (name.indexOf('blob%3Ahttp') == 0 || name.indexOf('http%3A') == 0 || name.indexOf('https%3A') == 0) {
        length = getUrlLength(decodeURIComponent(name));
    }

    return length;
}

async function process_ffmpeg(array_cmd) {

    self.scale_width = 0;
    self.scale_height = 0;
    var i_index = array_cmd.indexOf('-i');
    var scale_index = array_cmd.lastIndexOf('-s');
    if (scale_index > -1 && scale_index > i_index) {
        var scale_value = array_cmd[scale_index + 1];
        self.scale_width = 1 * Number(scale_value.split('x')[0]);
        self.scale_height = 1 * Number(scale_value.split('x')[1]);
        array_cmd.splice(scale_index, 1);
        array_cmd.splice(scale_index, 1);
    }

    self.array_cmd = array_cmd;

    //thay thế tên file đầu vào
    for (var i = 0; i < array_cmd.length; i++) {
        var input = array_cmd[i];

                if (input instanceof File || (typeof FileSystemFileHandle !== 'undefined' && input instanceof FileSystemFileHandle)) {
            new_inputName = encodeURIComponent(input.name);
            if (i >= 0 && array_cmd[i - 1] == '-i') {
                file_map[new_inputName] = (typeof FileSystemFileHandle !== 'undefined' && input instanceof FileSystemFileHandle) ? await input.getFile() : input;
                self.ffmpegModule.FS.writeFile(new_inputName, new Uint8Array(1));
            } else {
                if (typeof FileSystemFileHandle !== 'undefined' && input instanceof FileSystemFileHandle) {
                    writable_map[new_inputName] = await input.createWritable();
                    file_map[new_inputName] = input;
                } else {
                    file_map[new_inputName] = input;
                }
            }
        } else {

            if (i >= 0 && array_cmd[i - 1] == '-i') {
                new_inputName = encodeURIComponent('' + input);
                self.ffmpegModule.FS.writeFile(new_inputName, new Uint8Array(1));
            } else {
                new_inputName = '' + input;
            }

        }

        array_cmd[i] = new_inputName;


        if (i > 0 && array_cmd[i - 1] == '-i') {
            nameInputs.push(new_inputName);
        }

        if (!isNumber(new_inputName) && new_inputName.indexOf('.') !== -1 && i > 0 && array_cmd[i - 1] != '-i') {
            nameOutputs.push(new_inputName);
        }
    }

    console.log('Running ffmpeg with command:', array_cmd);
    self.ffmpegModule.callMain(self.array_cmd);
}

self.onmessage = async function (intent) {

    self.input_intent = intent;
    current_cmd = intent.data.cmd;
    self.wasm_url = intent.data.wasm_url;
    self.ffmpegModule = await createFFmpegModule(self.wasm_url);


    //dành cho trường hợp concat files
    if (intent.data.value.concat_files) {
        self.concat_files = intent.data.value.concat_files;
        for (var i = 0; i < self.concat_files.length; i++) {
            var blob_url = self.concat_files[i];
            self.ffmpegModule.FS.writeFile(blob_url, new Uint8Array(1));
            nameInputs.push(blob_url);
        }
    }

    if (intent.data.app_settings) {
        self.app_settings = intent.data.app_settings;
    }

    if (current_cmd == CMD_PERFORM_CONVERT) {
        output_value = []; // Initialize output_value for conversion commands
        self.output_file = intent.data.value.output_file;

        if (intent.data.value.disable_videodecoder) {
            enable_videodecoder = false;
        }
        process_ffmpeg(intent.data.value.cmd);
    } else if (current_cmd == CMD_GET_FILE_INFO) {
        output_value = [];
        process_ffmpeg(intent.data.value.cmd);
    }
}



async function createFFmpegModule(wasm_url) {
    lineCode = 0;

    return await createFFmpeg
        ({
            print: (text) => {


                if (self.input_intent.data.value.stream_index == 0) {
                    const outTimeUsMatch = text.match(/out_time_us=(\d+)/);
                    if (outTimeUsMatch) {
                        var outTimeInSeconds = parseInt(outTimeUsMatch[1]) / 1000000;
                        if (outTimeInSeconds > 0) {
                            var duration = self.input_intent.data.value.output_file.duration;
                            if (duration > 0) {
                                var percentage = dec(100 * outTimeInSeconds / duration);
                                postMessage({
                                    cmd: CMD_UPDATE_PROGRESS,
                                    percentage: percentage > 99 ? 99 : percentage,
                                    stream_index: self.input_intent.data.value.stream_index,
                                    segment_index: self.input_intent.data.value.segment_index
                                });
                            }
                        }
                    }
                }

            },
            printErr: (text) => {

                if (current_cmd === CMD_GET_FILE_INFO) {
                    output_value.push(text);
                } else if (current_cmd === CMD_PERFORM_CONVERT) {


                }

                if (lineCode < 1000) {
                 //console.error(text + '\nlineCode:' + lineCode, '|time===', Date.now());
                }
                lineCode++;
            },

            onExit: (code) => {

            },
            locateFile: e => e.endsWith(".wasm") ? wasm_url : e,
        });

}

async function new_event(event_name, event_value) {

    if (event_name == 'close-stream') {

        var fileName = event_value.node.name;

        var is_output = nameOutputs.indexOf(fileName) >= 0;
        if (is_output) {

            if (current_cmd === CMD_GET_FILE_INFO) {
                const output_data = new Uint8Array(event_value.node.contents);
                // Convert to base64
                const binaryString = String.fromCharCode.apply(null, output_data);
                const base64String = btoa(binaryString);
                thumbnail = `data:image/jpeg;base64,${base64String}`;
            } else {
                if (self.writable_map[fileName]) {
                    output_value.push({
                        name: fileName,
                        blob_url: self.file_map[fileName]
                    });
                } else {
                    const output_data = new Uint8Array(event_value.node.contents);
                    const blob = new Blob([output_data], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    output_value.push({
                        name: fileName,
                        blob_url: url,
                        length: output_data.byteLength
                    });
                }
            }
        }
    }
}

async function pullWriteQueue() {
    while (writeQueue.length > 0) {
        var writeItem = writeQueue.shift();
        var writableFile = self.writable_map[writeItem.writableFileName];
        if (writableFile) {
            await writableFile.write({ type: "write", position: writeItem.position, data: writeItem.data });
        }
    }
}
self.completeFfmpeg = async function () {

    await pullWriteQueue();

    for (var key in writable_map) {
        if (writable_map.hasOwnProperty(key)) {
            if (writable_map[key]) {
                await writable_map[key].close();
            }
        }
    }
    var post = {
        cmd: current_cmd,
        value: output_value
    }
    if (current_cmd === CMD_GET_FILE_INFO && typeof thumbnail !== 'undefined') {
        post.thumbnail = thumbnail;
    }

    if (current_cmd === CMD_PERFORM_CONVERT) {
        post.stream_index = self.input_intent.data.value.stream_index;
        post.segment_index = self.input_intent.data.value.segment_index;
    }

    console.log('completeFfmpeg:', post);



    postMessage(post);
}