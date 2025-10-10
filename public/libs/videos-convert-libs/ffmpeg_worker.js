importScripts("/libs/videos-convert-libs/constant.js");
importScripts(CONVERT_UTILS_URL);
importScripts(FFMPEG_UTILS_URL);


var is_check = 0;
var count_read_input = 0;

var worker_pool = [];
var output_value = [];

var above_max = 30;
var is_firefox = false;
var current_cmd = '';
var enable_videodecoder = true;
self.input_files_map = {};
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


this.readInputData = function (stream, buffer, offset, length, position) {

    var filename = stream.node.name;
    if (position == 0) {
        length = Math.min(length, 1024 * 128);
    } else {
        length = Math.min(length, 1024 * 1204 * 3);
    }
    if (self.input_files_map[filename]) {
        var file = self.input_files_map[filename];
        const reader = new FileReaderSync();
        var buf = new Uint8Array(reader.readAsArrayBuffer(file.slice(position, position + length)));
        size = buf.length;
        buffer.set(buf, offset);
        return size;
    } else if (filename.indexOf('blob%3Ahttp') == 0 || filename.indexOf('http%3A') == 0 || filename.indexOf('https%3A') == 0) {
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
this.pausePerform = function (is_last) {


    self.interval = setInterval(function () {

        var is_all_finish = true;
        for (var i = 0; i < worker_pool.length; i++) {
            if (worker_pool[i].is_ready == 0) {
                is_all_finish = false;
                break;
            }

            if (is_last == 1) {
                if (worker_pool[i].flush_state == 0) {
                    console.log('yeu cau flush:', worker_pool[i].name);
                    worker_pool[i].flush_state = 1;
                    worker_pool[i].postMessage({
                        cmd: 'flush',
                        worker_name: worker_pool[i].name
                    });
                }
            } else {
                if (worker_pool[i].pull_state == 0) {
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

        } else {
            if (is_last) {
                if (typeof last_time123 == 'undefined') {
                    last_time123 = Date.now();
                }

                if (Date.now() - last_time123 > 3000) {
                    // debugger;
                }

            }
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
            if (typeof last_update_progress === 'undefined') {
                last_update_progress = {
                    last_time: 0,
                    start_update: 0,
                    percentage: 0,
                    timeLeft: 99999999
                };
            }
            if (Date.now() - last_update_progress.last_time > 2000 && self.output_file.output_duration > 0) {
                if (last_update_progress.start_update == 0) {
                    last_update_progress.start_update = Date.now();
                }
                const percentage = dec(100 * (worker.count_output * worker.config.framerate_den / worker.config.framerate_num) / self.output_file.output_duration);
                var used_time = Date.now() - last_update_progress.last_time;
                var speed = 1000 * (percentage - last_update_progress.percentage) / (used_time);
                var timeLeft = speed > 0 ? (100 - percentage) / speed : 0;
                if (percentage > 5 || Date.now() - last_update_progress.start_update > 10000) {
                    timeLeft = Math.min(timeLeft, last_update_progress.timeLeft);
                    last_update_progress.timeLeft = timeLeft;
                } else {
                    timeLeft = 0;
                }

                last_update_progress.last_time = Date.now();
                last_update_progress.percentage = percentage;

                postMessage({
                    cmd: CMD_UPDATE_PROGRESS,
                    percentage: percentage > 99 ? 99 : percentage,
                    timeLeft: timeLeft
                });
            }
        } else if (intent.data.cmd == 'new_frame') {
            //     console.log('onmessage:new_frame');
            var worker = intent.target;
            worker.padding_length = intent.data.padding_length;
            worker.output.push(intent.data);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.cmd == 'flushed') {
            console.log('onmessage:flushed:', intent.target);
            intent.target.flush_state = 2;
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

            var res = postDataSync(SDK_URL, array2);
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

self.writeOutputData = function (stream, buffer, offset, length, position, canOwn) {

    if (length <= 1) {
        return -1;
    }

    return -1;
}

self.getLengthInput = function (name, length) {

    if (self.input_files_map[name]) {
        return self.input_files_map[name].size;
    }

    if (name.indexOf('blob%3Ahttp') == 0 || name.indexOf('http%3A') == 0 || name.indexOf('https%3A') == 0) {
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

    self.ffmpegModule = await createFFmpegModule(self.wasm_url);

    for (var i = 0; i < array_cmd.length; i++) {
        if (array_cmd[i] == '-i') {
            var new_inputName;
            var input = array_cmd[i + 1];
            if (input instanceof File) {
                new_inputName = input.name;
                self.input_files_map[input.name] = input;
            } else {
                new_inputName = encodeURIComponent(input);
            }

            array_cmd[i + 1] = new_inputName;
            self.ffmpegModule.FS.writeFile(new_inputName, new Uint8Array(1)); //AVFormatContext @ 0x2068340] Opening 'input_0___.mp4' for reading
            i++;
        } else {
            array_cmd[i] = '' + array_cmd[i];
        }
    }

    self.ffmpegModule.callMain(self.array_cmd);
}

self.onmessage = async function (intent) {

    current_cmd = intent.data.cmd;
    self.wasm_url = intent.data.wasm_url;
    if (intent.data.input_files) {
        self.input_files_map = intent.data.input_files;
    }

    if (intent.data.app_settings) {
        self.app_settings = intent.data.app_settings;
    }

    if (current_cmd == CMD_PERFORM_CONVERT || current_cmd == CMD_PERFORM_MERGE) {
        output_value = []; // Initialize output_value for conversion commands
        self.output_file = intent.data.value.output_file;

        if (intent.data.value.disable_videodecoder) {
            enable_videodecoder = false;
        }
        process_ffmpeg(intent.data.value.cmd_component);
    } else if (current_cmd == CMD_GET_FILE_INFO) {
        output_value = [];
        process_ffmpeg(intent.data.value);
    }
}

async function createFFmpegModule(wasm_url) {
    lineCode = 0;

    return await createFFmpeg
        ({
            print: (text) => console.log(text, Date.now()),
            printErr: (text) => {

                if (current_cmd === CMD_GET_FILE_INFO) {
                    output_value.push(text);
                }

                if (lineCode < 1000 ) {
                   //  console.error(text + '\nlineCode:' + lineCode, '|time===', Date.now());
                }
                lineCode++;
            },

            onExit: (code) => {

            },
            locateFile: e => e.endsWith(".wasm") ? wasm_url : e,
        });

}

function new_event(event_name, event_value) {
    //console.log('new_event called:', event_name, current_cmd);
    if (event_name == 'close-stream') {

        if (event_value.node.contents) {
            var is_ouput = event_value.node.contents.byteLength > 1 && event_value.shared.position > 0;
            //console.log('is_output:', is_ouput, 'byteLength:', event_value.node.contents.byteLength, 'position:', event_value.shared.position);
            if (is_ouput) {
                const output_data = ffmpegModule.FS.readFile(event_value.node.name);
                console.log('output_data length:', output_data.byteLength, 'filename:', event_value.node.name);

                if (current_cmd === CMD_GET_FILE_INFO) {
                    const binaryString = String.fromCharCode.apply(null, output_data);
                    const base64String = btoa(binaryString);
                    thumbnail = `data:image/jpeg;base64,${base64String}`;
                } else {
                    const blob = new Blob([output_data], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    console.log('Adding to output_value:', event_value.node.name, url);
                    output_value.push({
                        name: event_value.node.name,
                        blob_url: url,
                        length: output_data.byteLength
                    });
                }
            }
        }
    }
}

self.completeFfmpeg = function () {

    var post = {
        cmd: current_cmd,
        value: output_value
    }
    if (current_cmd === CMD_GET_FILE_INFO && typeof thumbnail !== 'undefined') {
        post.thumbnail = thumbnail;
    }
    postMessage(post);


    // if (current_cmd == CMD_PERFORM_CONVERT && (output_value.length > 1||self.array_cmd.indexOf('libx265') > -1)) {
    //     var cmd_component = [];


    //     if (self.array_cmd.indexOf('libx265') > -1) {
    //         cmd_component.push('-r');
    //         cmd_component.push(''+self.output_file.output_fps);
    //     }

    //     for (var i = 0; i < output_value.length; i++) {
    //         cmd_component.push('-i');
    //         cmd_component.push(output_value[i].blob_url);
    //     }
    //     cmd_component.push('-c');
    //     cmd_component.push('copy');

    //     if (self.array_cmd.indexOf('libx265') > -1) {
    //         cmd_component.push('-tag:v');
    //         cmd_component.push('hvc1');
    //     }

    //     if (self.array_cmd.indexOf('libvpx-vp9') > -1) {
    //         cmd_component.push('complete-output.webm');
    //     } else {
    //         cmd_component.push('complete-output.mp4');
    //     }
    //     current_cmd = CMD_PERFORM_MERGE;
    //     output_value = [];
    //     process_ffmpeg(cmd_component);

    // } else if (current_cmd == CMD_PERFORM_MERGE) {
    //     var cmd_array = ['-loglevel', 'debug', '-i', output_value[0].blob_url, '-vframes', '1', '-vf', 'scale=160:-1', 'complete-thumbnail.jpg'];
    //     current_cmd = CMD_GET_FILE_INFO;
    //     output_value = [];
    //     process_ffmpeg(cmd_array);
    // } else {

    //     var post = {
    //         cmd: current_cmd,
    //         value: output_value
    //     }
    //     if (current_cmd === CMD_GET_FILE_INFO && typeof thumbnail !== 'undefined') {
    //         post.thumbnail = thumbnail;
    //     }

    //     if (self.array_cmd.indexOf('complete-thumbnail.jpg') > -1) {
    //         post.output_url = self.array_cmd[self.array_cmd.indexOf('-i') + 1];
    //         post.cmd = CMD_PERFORM_CONVERT;
    //     }

    //     postMessage(post);

    // }

}