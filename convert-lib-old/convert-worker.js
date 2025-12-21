importScripts("constant.js");
importScripts("main-function.js");
importScripts("convert-worker-wasm.js");
importScripts(CONVERT_UTILS_URL);

//.    input
//           |
//           v
// +--------------------------+
// |  Stream Converter        |
// |        (Video)           |
// +--------------------------+
//           |
//           v
// +--------------------------+
// |      Stream Merger       |-----> output
// +--------------------------+
//           ^
//           |
// +--------------------------+
// |  Stream Converter        |
// |        (Audio)           |
// +--------------------------+
//           ^
//           |
//           input

var is_check = 0;
var count_read_input = 0;

var worker_pool = [];
var output_value = [];

var above_max = 30;
var current_type_cmd = '';
var enable_videodecoder = true;
var file_map = {};

var nameInputs = [];
var nameOutputs = [];

var count_sent_segments = 0;
const MAX_SENT_SEGMENTS = 10;
const MIN_SEGMENTS = 3;
var waitingForPullCompleted = false; // Stream Converter đợi tín hiệu phản hồi từ Stream Merger.
var isStartedCallMain = false;
var segmentDataStore = {};
var isAllStreamCompleted = false; // tất cả các stream(video và audio) đã hoàn thành.
var waitingForNewSegment = false; //Stream Merger đang chờ dữ liệu mới từ các Stream Converter
var waitingForSaveData = false; // đợi dữ liệu được upload lên server hoặc lưu xong

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

        if (intent.data.type_cmd == 'worker_ready') {
            intent.target.is_ready = 1;
        } else if (intent.data.type_cmd == 'new_video_chunk') {
            var worker = intent.target;
            worker.output.push(intent.data);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.type_cmd == 'new_frame') {
            var worker = intent.target;
            worker.padding_length = intent.data.padding_length;
            worker.output.push(intent.data);
            worker.count_output = worker.count_output + 1;
            worker.count_feed = intent.data.count_feed;
        } else if (intent.data.type_cmd == 'flushed') {
            intent.target.flush_state = 2;
            intent.target.terminate();
        } else if (intent.data.type_cmd == 'pull') {
            intent.target.pull_state = 2;
        } else if (intent.data.type_cmd == 'get_file_info') {
            self.ffmpegModule.callMain(self.array_cmd);
        } else if (intent.data.type_cmd == CMD_ERROR_DECODER_CONFIG || intent.data.type_cmd == CMD_ERROR_ENCODER_CONFIG) {
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
        app_settings: self.app_settings,
        worker_name: codecWorker.name
    });

    requestPause();

}

function get_worker_by_name(name) {
    for (var i = 0; i < worker_pool.length; i++) {
        if (worker_pool[i].name == name) return worker_pool[i];
    }
}

function getLengthInput(name, length) {

    if (self.file_map[name]) {
        length = self.file_map[name].size;
    } else if (name.indexOf('blob%3Ahttp') == 0 || name.indexOf('http%3A') == 0 || name.indexOf('https%3A') == 0) {
        length = getUrlLength(decodeURIComponent(name));
    }

    return length;
}

async function process_ffmpeg(array_cmd) {
    console.log('process_ffmpeg called with command:', array_cmd);
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
        if (input == '-i') {
            var nextInput = array_cmd[i + 1];
            if (typeof nextInput !== 'string') {
                continue;
            }
            if (nextInput instanceof File) {
                array_cmd[i + 1] = encodeURIComponent(nextInput.name);
                file_map[array_cmd[i + 1]] = nextInput;
            } else {
                if (nextInput.indexOf('blob:') == 0 || nextInput.indexOf('http:') == 0 || nextInput.indexOf('https:') == 0) {
                    array_cmd[i + 1] = encodeURIComponent(nextInput);
                } else {
                    array_cmd[i + 1] = '' + nextInput;
                }
            }
            i = i + 1;
        } else {
            array_cmd[i] = '' + input;
            if (array_cmd[i].indexOf('blob:') == 0 || array_cmd[i].indexOf('http:') == 0 || array_cmd[i].indexOf('https:') == 0) {
                array_cmd[i] = encodeURIComponent(array_cmd[i]);
            }
        }

        if (i > 0 && array_cmd[i - 1] == '-i') {
            nameInputs.push(array_cmd[i]);
        }

        if (!isNumber(array_cmd[i]) && array_cmd[i].indexOf('.') !== -1 && i > 0 && array_cmd[i - 1] != '-i') {
            nameOutputs.push(array_cmd[i]);
        }
    }

    console.log('Running ffmpeg with command:', array_cmd);
    if (current_type_cmd == CMD_PERFORM_MERGE_STREAM) {

    } else {
        self.ffmpegModule.callMain(self.array_cmd);
    }

}

self.onmessage = async function (intent) {

    if (intent.data.type_cmd == CMD_REQUEST_RESUME) {
        waitingForPullCompleted = false;
        count_sent_segments = 0;
        return;
    }

    if (intent.data.type_cmd == CMD_NOTIFY_MEMORY_UPLOAD) {
        waitingForSaveData = intent.data.hasWarningMemoryUpload;
        return;
    }
    self.input_intent = intent;
    current_type_cmd = intent.data.type_cmd;
    self.wasm_url = intent.data.wasm_url;
    self.ffmpeg_url = intent.data.ffmpeg_url;
    self.isSharedArrayBufferSupported = intent.data.isSharedArrayBufferSupported;
    importScripts(self.ffmpeg_url);
    self.ffmpegModule = await createFFmpegModule(self.wasm_url, self.ffmpeg_url);


    if (intent.data.app_settings) {
        self.app_settings = intent.data.app_settings;
    }

    if (current_type_cmd == CMD_PERFORM_CONVERT) {
        output_value = [];
        self.output_file = intent.data.data_cmd.output_file;
        var convertThreads = intent.data.data_cmd.convertThreads;



        var successCallback = async function (intent) {

            var targetWorker = intent.target;

            if (intent.data.type_cmd == CMD_PERFORM_CONVERT) {




            } else if (intent.data.type_cmd == CMD_UPDATE_PROGRESS) {
                postMessage({
                    type_cmd: CMD_UPDATE_PROGRESS,
                    out_time: intent.data.out_time
                });

            } else if (intent.data.type_cmd == CMD_NEW_SEGMENT_DATA) {


                // var segmentData = intent.data.data_cmd;
                if (intent.data.is_complete) {
                    segmentDataStore[intent.data.type_segment].is_complete = true;
                    checkWhenNewSegmentData();
                } else if (intent.data.is_pulled) {
                    while (waitingForSaveData) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    targetWorker.postMessage({
                        type_cmd: CMD_REQUEST_RESUME
                    });
                    segmentDataStore[intent.data.type_segment].is_pulled = true;
                    checkWhenNewSegmentData();
                } else {
                    segmentDataStore[intent.data.type_segment].segmentData.push(intent.data.data);
                    segmentDataStore[intent.data.type_segment].count_received_segments += 1;
                }

            }
        }

        if ((videoThread = convertThreads.find(thread => thread.type_segment === 'convert-video-segment')) !== undefined) {
            segmentDataStore[videoThread.type_segment] = {
                segmentData: [],
                is_complete: false,
                is_pulled: false,
                count_received_segments: 0
            }

            executeCommand(CMD_PERFORM_CONVERT_STREAM, videoThread, successCallback);
        }

        if ((audioThread = convertThreads.find(thread => thread.type_segment === 'convert-audio-segment')) !== undefined) {
            segmentDataStore[audioThread.type_segment] = {
                segmentData: [],
                is_complete: false,
                is_pulled: false,
                count_received_segments: 0
            }

            executeCommand(CMD_PERFORM_CONVERT_STREAM, audioThread, successCallback);
        }

        if ((mergeThread = convertThreads.find(thread => thread.type_segment === 'merge-audio-video-segment')) !== undefined) {

            var new_intent = {
                data: {
                    type_cmd: CMD_PERFORM_MERGE_STREAM,
                    data_cmd: mergeThread,
                    app_settings: self.app_settings,
                    wasm_url: self.wasm_url,
                    ffmpeg_url: self.ffmpeg_url,
                    isSharedArrayBufferSupported: isSharedArrayBufferSupported
                }
            };
            self.onmessage(new_intent);
        }



        //process_ffmpeg(intent.data.value.type_cmd);
    } else if (current_type_cmd == CMD_PERFORM_CONVERT_STREAM) {
        self.type_segment = intent.data.data_cmd.type_segment;
        process_ffmpeg(intent.data.data_cmd.array_cmd);
    } else if (current_type_cmd == CMD_GET_FILE_INFO) {
        output_value = [];
        process_ffmpeg(intent.data.data_cmd.array_cmd);
    } else if (current_type_cmd == CMD_PERFORM_MERGE_STREAM) {
        process_ffmpeg(intent.data.data_cmd.array_cmd);
    }
}

function checkWhenNewSegmentData() {
    var all_segments = Object.keys(segmentDataStore);
    if (all_segments.length === 0) {
        return;
    }

    var count_pass = 0;
    //trong trường hợp tất cả worker đều đã hoàn thành, thì luôn chạy tiếp
    for (var key in segmentDataStore) {
        if (segmentDataStore[key].is_complete == true) {
            count_pass++;
        }
    }

    if (count_pass == all_segments.length) {
        isAllStreamCompleted = true;
        if (isStartedCallMain == false) {
            isStartedCallMain = true;
            self.ffmpegModule.callMain(self.array_cmd);
        } else {
            waitingForNewSegment = false;
            requestResume(2);
        }
        return;
    }


    count_pass = 0;
    for (var key in segmentDataStore) {
        if ((segmentDataStore[key].is_complete == true) || (segmentDataStore[key].is_pulled == true || segmentDataStore[key].segmentData.length >= MIN_SEGMENTS)) {
            count_pass++;
        }
    }

    if (count_pass == all_segments.length) {
        for (var key in segmentDataStore) {
            segmentDataStore[key].is_pulled = false;
        }

        if (isStartedCallMain == false) {
            isStartedCallMain = true;
            self.ffmpegModule.callMain(self.array_cmd);
        } else {
            waitingForNewSegment = false;
            requestResume(2);
        }
        return;
    }

}

async function createFFmpegModule(wasm_url, ffmpeg_url) {
    lineCode = 0;

    return await createFFmpeg
        ({
            print: (text) => {
                if (self.type_segment == 'convert-video-segment') {
                    const outTimeUsMatch = text.match(/out_time_us=(\d+)/);
                    if(typeof outTimeUsMatchOld == 'undefined') {
                        outTimeUsMatchOld = 0;
                    }

                    if (outTimeUsMatch) {

                        var outTimeInSeconds = Math.floor(parseInt(outTimeUsMatch[1]) / 1000000);
                        if(outTimeUsMatchOld >= outTimeInSeconds) {
                            return;
                        }
                        outTimeUsMatchOld = outTimeInSeconds;
                        postMessage({
                            type_cmd: CMD_UPDATE_PROGRESS,
                            out_time: outTimeInSeconds
                        });
                    }
                }
            },
            printErr: (text) => {

                if (current_type_cmd === CMD_GET_FILE_INFO) {
                    output_value.push(text);
                } else if (current_type_cmd === CMD_PERFORM_CONVERT) {


                }

                if (lineCode < 1000) {

                }

               // console.error(text + '\nlineCode:' + lineCode, '|time===', Date.now());
                //   
                lineCode++;
            },

            onExit: (code) => {

            },
            locateFile: e => e.endsWith(".wasm") ? wasm_url : e,
            mainScriptUrlOrBlob: ffmpeg_url,
        });

}

/**
 * 
 * @param {*} path 
 * @param {*} flags 
 *        flags = 557633 Mở file để ghi, tạo mới nếu chưa có, ghi nối vào cuối file, hỗ trợ file lớn.
 *.       flags = 557056 Mở file thường, hỗ trợ file lớn, không có quyền ghi/đọc đặc biệt==>>có thể dùng để kiểm tra file có tồn tại hay không
 *        flags = 577    Mở file để đọc
 * @param {*} mode 
 */
function openPath(path, flags, mode) {
    const filename = path.split('/').pop();

    if (flags == 557056 && mode == 0) {
        const exists = self.ffmpegModule.FS.analyzePath(path).exists;
        if (!exists) {

            if (filename.indexOf('video-segment-') == 0 || filename.indexOf('audio-segment-') == 0) {
                var type_segment = filename.indexOf('video-segment-') == 0 ? 'convert-video-segment' : 'convert-audio-segment';
                if (segmentDataStore[type_segment] && segmentDataStore[type_segment].segmentData.length > 0) {
                    var segment_data = segmentDataStore[type_segment].segmentData.shift();
                    self.ffmpegModule.FS.writeFile(path, new Uint8Array(segment_data));
                    return;
                }
            } else {
                self.ffmpegModule.FS.writeFile(path, new Uint8Array(1));
            }
        }
    }

    if (flags == 577) {
        if (filename.indexOf('video-segment-') == 0 || filename.indexOf('audio-segment-') == 0) {
            var type_segment = filename.indexOf('video-segment-') == 0 ? 'convert-video-segment' : 'convert-audio-segment';

            if (segmentDataStore[type_segment].segmentData.length < MIN_SEGMENTS && isAllStreamCompleted == false) {
                waitingForNewSegment = true;
                requestPause();
            }
        }
    }

}

async function close_stream(stream) {
    var fileName = stream.node.name;

    if (current_type_cmd === CMD_GET_FILE_INFO && fileName.indexOf('thumbnail.jpg') >= 0) {
        const output_data = new Uint8Array(stream.node.contents);
        const binaryString = String.fromCharCode.apply(null, output_data);
        const base64String = btoa(binaryString);
        thumbnail = `data:image/jpeg;base64,${base64String}`;
        return;
    }


    if (current_type_cmd === CMD_PERFORM_CONVERT_STREAM && (fileName.indexOf('video-segment-') == 0 || fileName.indexOf('audio-segment-') == 0)) {
        const segment_data = new Uint8Array(stream.node.contents);
        postMessage({
            type_cmd: CMD_NEW_SEGMENT_DATA,
            type_segment: self.type_segment,
            filename: fileName,
            data: segment_data
        }, [segment_data.buffer]);
        self.ffmpegModule.FS.unlink(fileName);
        count_sent_segments++;
        if (count_sent_segments >= MAX_SENT_SEGMENTS) {
            postMessage({
                type_cmd: CMD_NEW_SEGMENT_DATA,
                type_segment: self.type_segment,
                is_pulled: true
            });
            waitingForPullCompleted = true;
            requestPause();
        }
        return;
    }

}

