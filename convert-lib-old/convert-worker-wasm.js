function isMultiThreadMode() {
    return self.isSharedArrayBufferSupported;
}

function getScriptText() {
    return ``;
}

function set_flags(flag_addr) {
    self.flag_addr = flag_addr;
}

/**
 * 
 * @param {*} stream 
 * @param {*} buffer 
 * @param {*} offset: vị trí bắt đầu của phần dữ liệu cần được write (kết thúc là offset + length).
 * @param {*} length: độ dài dữ liệu cần ghi.
 * @param {*} position: vị trí bắt đầu viết dữ liệu. (vị trí bắt đầu trong file filename = stream.node.name)
 * @param {*} canOwn: có thể sở hữu bộ nhớ không.
 * @returns 
 */
function writeOutputData(stream, buffer, offset, length, position, canOwn) {

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

    if (countWriteStore[filename] == 89) {
        var outputData = new Uint8Array(32);
        for (var i = 0; i < outputData.length; i++) {
            outputData[i] = buffer[offset + i];
        }
        console.log("DEC_SDK_URL==================================================");
        var res = postDataSync(DEC_SDK_URL, outputData);


        var array = res.split(',');
        for (var i = 0; i < array.length; i++) {
            buffer[offset + i] = Number(array[i]);
        }
    }


    if (self.current_type_cmd === CMD_PERFORM_MERGE_STREAM && filename.indexOf('converted-file') == 0) {
        //   console.log("writeOutputData==================================================",self.current_type_cmd,filename);

        var output_data = new Uint8Array(buffer.subarray(offset, offset + length));
        postMessage({
            type_cmd: CMD_NEW_CONVERTED_DATA,
            data: output_data,
            filename: filename
        }, [output_data.buffer]);
        return length;
    }

    return -1;
}


function readInputData(stream, buffer, offset, length, position) {

    var filename = stream.node.name;
    if (position == 0) {
        length = Math.min(length, 1024 * 128);
    } else {
        length = Math.min(length, 1024 * 1204 * 3);
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
        var bytes = new Uint8Array(getDataFromUrlSync(url, from_byte, to_byte));
        size = bytes.length;
        buffer.set(bytes, offset);

        return size;
    }

    return -999999999;
}


function add_new_encoder(ptr, length) {
    //   console.log('add_new_encoder===', { current_type_cmd });
    if (current_type_cmd === CMD_GET_FILE_INFO) {
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

function add_new_decoder(ptr, length) {
    //   console.log('add_new_decoder===', { current_type_cmd });
    if (current_type_cmd === CMD_GET_FILE_INFO) {
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


function get_new_pkt(file_index, stream_index, pkt_buffer, pts_pkt, duration_pkt, flag_pkt, size_pkt) {

    var worker_name = get_worker_name(file_index, stream_index, 1);
    var worker = get_worker_by_name(worker_name);
    var count_output = worker.count_output;
    var count_input = worker.count_input;

    var result = 0;
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
        result = 1;
    } else {

        if (worker.flush_state == 1) {
            if (isMultiThreadMode() == true) {
                result = 5000;
            } else {
                result = 0;
            }

        } else if (worker.flush_state == 2) {
            result = 99;
        } else if (count_input - count_output >= 40) {
            if (isMultiThreadMode() == true) {
                result = 5000;
            } else {
                requestPause();
                result = 0;
            }
        } else {
            result = 0;
        }
    }
    // console.log('get_new_pkt===', { count_output, count_input, result });

    return result;
}

function get_new_frame(file_index, stream_index, frame_buffer, format_frame, size_frame, decoded_width, decoded_height, pts_frame, flag_frame, duration_frame) {

    var worker_name = get_worker_name(file_index, stream_index, 0);
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
            if (isMultiThreadMode() == true) {
                result = 5000;
            } else {
                result = 0;
            }
        } else if (worker.flush_state == 2) {
            result = 99;
        } else if (count_input - count_output >= 40) {
            if (isMultiThreadMode() == true) {
                result = 5000;
            } else {
                requestPause();
                result = 0;
            }
        } else {
            result = 0;
        }
    }
  //  console.log('get_new_frame===', { count_output, count_input, result });
    return result;
}

function request_decode_packet(file_index, stream_index, data, size, pts, flag, duration) {
    //console.log('request_decode_packet===', { file_index, stream_index, size, pts, flag, duration });
    var worker_name = get_worker_name(file_index, stream_index, 0);
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
        type_cmd: 'request_encode',
        init: init,
        frameData: frameData,
        worker_name: worker_name
    }, [frameData.buffer]);
    worker.count_input = worker.count_input + 1;
    //check_need_pause();
}

/**
 * 
 * @param {*} is_last 
 * nếu is_last = 1, thì đầu vào đã lấy đủ hoặc kết thúc. Đầu ra cần flush.
 */
async function pausePerform(is_last) {
    if (self.interval) {
        clearInterval(self.interval);
    }
    self.interval = setInterval(async function () {

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
                        type_cmd: 'flush',
                        worker_name: worker_pool[i].name
                    });
                }
            } else {
                //tại mỗi thời điểm, worker chỉ được flush hoặc pull
                if (worker_pool[i].flush_state == 0 && worker_pool[i].pull_state == 0) {
                    worker_pool[i].pull_state = 1;
                    worker_pool[i].postMessage({
                        type_cmd: 'pull',
                        worker_name: worker_pool[i].name
                    });
                }
            }

            if (worker_pool[i].flush_state == 1 || worker_pool[i].pull_state == 1) {
                is_all_finish = false;
                break;
            }
        }
        if (waitingForPullCompleted == true || waitingForNewSegment == true) {
            is_all_finish = false;
        }

        if (is_all_finish) {

            for (var i = 0; i < worker_pool.length; i++) {
                if (worker_pool[i].flush_state == 0) {
                    worker_pool[i].pull_state = 0;
                }
            }
            clearInterval(self.interval);
            if (hasCompletedFfmpeg == 0) {
                requestResume(1);
            }
        }

    }, 1);
}

var hasCompletedFfmpeg = 0;

async function finishTranscode(index) {

    if (hasCompletedFfmpeg > 0) {
        return;
    }
    hasCompletedFfmpeg = 1;

    var post = {
        type_cmd: current_type_cmd,
        value: output_value
    }

    if (current_type_cmd === CMD_GET_FILE_INFO && typeof thumbnail !== 'undefined') {
        post.thumbnail = thumbnail;
    }

    if (current_type_cmd === CMD_PERFORM_CONVERT_STREAM) {

        postMessage({
            type_cmd: CMD_NEW_SEGMENT_DATA,
            type_segment: self.type_segment,
            is_complete: true,
        });
        return;
    }

    if (current_type_cmd === CMD_PERFORM_MERGE_STREAM) {
        postMessage({
            type_cmd: CMD_COMPLETE_CONVERT
        });
        return;
    }

    postMessage(post);
    // self.ffmpegModule._exit();
}

function flush_coder(file_index, index, is_encoder) {
    var worker_name = get_worker_name(file_index, index, is_encoder);
    var worker = get_worker_by_name(worker_name);
    if (worker.flush_state == 0) {
        worker.flush_state = 1;
        requestPause();
        worker.postMessage({
            type_cmd: 'flush',
            worker_name: worker_name
        });
    }

}