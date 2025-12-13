const USE_FILE_INPUT = false;
const ENC_SDK_URL = 'https://www.convertsdk.com/enc';
const DEC_SDK_URL = 'https://www.convertsdk.com/dec';
//const IS_SHARED_ARRAY_BUFFER_SUPPORTED = typeof SharedArrayBuffer === 'undefined' ? false : true;
const IS_SHARED_ARRAY_BUFFER_SUPPORTED = false;
const WASM_BEE_LIB_URL = IS_SHARED_ARRAY_BUFFER_SUPPORTED ? 'libs/ffmpeg-wasm/ffmpeg-mt-gpl.wasm?v=1763370859963' : 'libs/ffmpeg-wasm/ffmpeg-st-gpl.wasm?v=1763370614149';
const FFMPEG_BEE_LIB_URL = IS_SHARED_ARRAY_BUFFER_SUPPORTED ? 'libs/ffmpeg-wasm/ffmpeg-mt-gpl.js?v=1763370860320' : 'libs/ffmpeg-wasm/ffmpeg-st-gpl.js?v=1763370614617';
const userAgent = navigator.userAgent.toLowerCase();
const IS_MOBILE_APP = /beeconvertapp/i.test(userAgent);
const MAIN_THREAD_URL = 'libs/main-thread.js';
const CONVERT_UTILS_URL = 'libs/common-utils.js';
const CODEC_HELPER_URL = 'libs/coder-config-utils.js';
const ENCODE_DECODE_WORKER_URL = 'coder-thread.js';


const CMD_BEE_UPDATE_PROGRESS = 'cmd-bee-update-progress';
const CMD_BEE_ERROR = 'cmd-bee-error';
const CMD_BEE_ERROR_CONFIG_CODER = 'cmd-bee-error-config-coder';

const CMD_BEE_TRY_AGAIN = 'cmd-bee-try-again';
const CMD_BEE_COMPLETE = 'cmd-bee-complete';
const CMD_BEE_CALL_MAIN = 'cmd-bee-call-main';
const CMD_BEE_CALL_MAIN_RESPONSE = 'cmd-bee-call-main-response';
const CMD_BEE_GET_INFO = 'cmd-bee-get-info';
const CMD_BEE_CONVERT = 'cmd-bee-convert';
const CMD_NEW_FRAME = 'new_frame';
const CMD_BEE_WRITE_FILE = 'cmd-bee-write-file';



const CODEC_MAP = {
	"I420": { "value": 0, "bpp": 12 }, "I420A": { "value": 33, "bpp": 20 }, "I422": { "value": 4, "bpp": 16 }, "I422A": { "value": 78, "bpp": 24 },
	"I444": { "value": 5, "bpp": 24 }, "I444A": { "value": 79, "bpp": 32 }, "NV12": { "value": 23, "bpp": 12 },
	"RGBA": { "value": 26, "bpp": 32 }, "RGBX": { "value": 119, "bpp": 32 }, "BGRA": { "value": 28, "bpp": 32 }, "BGRX": { "value": 121, "bpp": 32 }
};

function getFilenameAndMimeTypeFromUrl(url) {
	try {
		const urlObj = new URL(url, window.location.origin);
		const pathname = urlObj.pathname;
		const filename = pathname.substring(pathname.lastIndexOf('/') + 1) || 'file';
		const ext = filename.split('.').pop().toLowerCase();
		const mimeMap = {
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'png': 'image/png',
			'gif': 'image/gif',
			'webp': 'image/webp',
			'mp4': 'video/mp4',
			'mkv': 'video/x-matroska',
			'webm': 'video/webm',
			'mp3': 'audio/mpeg',
			'wav': 'audio/wav',
			'ogg': 'audio/ogg',
			'pdf': 'application/pdf',
		};
		const mimeType = mimeMap[ext] || 'application/octet-stream';
		return { filename, mimeType };
	} catch (e) {
		return { filename: 'file', mimeType: 'application/octet-stream' };
	}
}

// Chuyển url thành File, tự động lấy filename và mimeType từ url
async function urlToFile(url) {
	const { filename, mimeType } = getFilenameAndMimeTypeFromUrl(url);
	const response = await fetch(url);
	const blob = await response.blob();
	return new File([blob], filename, { type: mimeType || blob.type });
}

function get_string_format_from_codec(codec_format) {
	for (var key in CODEC_MAP) {
		if (CODEC_MAP[key].value == codec_format) {
			return key;
		}
	}
	return "UNKNOWN";
}

function get_code_format_from_string(string_format) {
	for (var key in CODEC_MAP) {
		if (key == string_format) {
			return CODEC_MAP[key].value;
		}
	}
}

async function loadWasmLib() {
	return getBlobUrl(WASM_LIB_URL);
}

function postDataSync(url, data) {
	var xhr = new XMLHttpRequest;
	xhr.open("POST", url, false);
	xhr.setRequestHeader('Content-Type', 'application/octet-stream');
	xhr.send(data);
	if (xhr.status == 200 || xhr.status == 206) {
		return xhr.response;
	}
}

function getDataFromUrl(url, from, to, onCompleteFn) {

	if (from > to)
		throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
	var xhr = new XMLHttpRequest;
	xhr.onreadystatechange = function () {
		if (this.readyState == 4) {
			if (this.status == 200 || this.status == 206) {
				if (onCompleteFn) {
					const headers = this.getAllResponseHeaders();
					onCompleteFn(this.response)
				}
			}
		}
	};
	xhr.open("GET", url, true);
	xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
	xhr.responseType = 'arraybuffer';
	xhr.send(null);
}

function dec(fl, d = 2) {
	var p = Math.pow(10, d);
	return Math.round(fl * p) / p;
}



function sendCmd(cmd, value) {
	postMessage({
		type_cmd: cmd,
		value: value
	});
}


// ============================================
// GET operations (Read), chỉ dành cho mobile app
// ============================================

function getFileDataSync(filename, position, length) {
	var xhr = new XMLHttpRequest();
	var url = "/api/file-operation?filename=" + encodeURIComponent(filename);

	if (position !== undefined) {
		url += "&position=" + position;
	}
	if (length !== undefined) {
		url += "&length=" + length;
	}

	xhr.open("GET", url, false);
	xhr.responseType = 'arraybuffer';
	xhr.send(null);

	if (xhr.status == 200 || xhr.status == 206) {
		return xhr.response;
	}
}

function getFileSizeSync(filename) {
	var xhr = new XMLHttpRequest();
	var url = "/api/file-operation?filename=" + encodeURIComponent(filename) + "&sizeOnly=true";

	xhr.open("GET", url, false);
	xhr.send(null);

	if (xhr.status == 200) {
		var result = JSON.parse(xhr.responseText);
		return result.fileSize;
	}
}

/**
 * So sánh filename với pattern kiểu output-loop-video-%03d.mp4, %01d, %4d, %d...
 * @param {string} filename - Tên file thực tế, ví dụ: output-loop-video-001.mp4
 * @param {string} pattern - Pattern, ví dụ: output-loop-video-%03d.mp4
 * @returns {boolean} true nếu khớp, false nếu không
 */
function matchFilenamePattern(filename, pattern) {
	// Hỗ trợ %Nd, %0Nd, %d
	// Tìm tất cả %...d trong pattern
	let regexStr = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// Thay thế từng %...d
	regexStr = regexStr.replace(/%0?(\d*)d/g, (full, pad) => {
		if (pad && pad.length > 0) {
			// %03d, %4d, %01d...
			return `\\d{${parseInt(pad, 10)}}`;
		} else {
			// %d
			return `\\d+`;
		}
	});
	const regex = new RegExp(`^${regexStr}$`);
	return regex.test(filename);
}

// Chuyển đổi text thành File
function textToFile(text, filename = 'file.txt', mimeType = 'text/plain') {
	return new File([text], filename, { type: mimeType });
}

function incrementFilename(filename) {
	return filename.replace(/(.*?)(\d+)(\.[^.]+)$/, (match, prefix, number, extension) => {
		const incrementedNumber = String(parseInt(number, 10) + 1).padStart(number.length, '0');
		return `${prefix}${incrementedNumber}${extension}`;
	});
}

async function postDataToServer(data, position, fileName) {
	try {
		// Tạo binary data mẫu
		const formData = new FormData();
		formData.append('filename', fileName);
		formData.append('position', position);
		if (data === null) {
			formData.append('action', 'delete');
		} else {
			formData.append('action', data.length > 0 ? 'write' : 'complete');
			formData.append('data', new Blob([data]), fileName);
		}

		const response = await fetch('/upload-stream', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			console.log('====>>> File saved successfully to server:', fileName);
		} else {
			console.error('====>>> Failed to save file to server:', fileName);
		}
		const json = await response.json();

		console.log('File saved response:', json);
		return json;
	} catch (error) {
		console.error('Error saving file to server:', error);
	}
}

function getStringTime() {

	const now = new Date();
	//thêm ngày-tháng-năm nếu cần
	const dd = now.getDate().toString().padStart(2, '0');
	const mm = (now.getMonth() + 1).toString().padStart(2, '0');
	const yyyy = now.getFullYear().toString().slice(-4);// chỉ lấy 2 số cuối: .toString().slice(-2);

	const hh = now.getHours().toString().padStart(2, '0');
	const min = now.getMinutes().toString().padStart(2, '0');
	const ss = now.getSeconds().toString().padStart(2, '0');
	//const dateStr = `${dd}d-${mm}m-${yy}y--${hh}h-${min}m-${ss}s`;

	const dateStr = `${hh}.${min}.${ss}-${dd}.${mm}.${yyyy}`;

	return dateStr;
}


function getFileInfoFromString(ffmpegOutput) {
	const info = {
		filename: '',
		size: 0, /** bytes */
		displaySize: '0 MB',
		duration: 0,
		bitrateTotal: 0,
		width: 0,
		height: 0,
		fps: 0,
		videoBitRate: 0,
		audioBitRate: 0,
		videoCodec: '',
		audioCodec: '',
		streams: []
	};
	// Lấy filename
	const filenameMatch = ffmpegOutput.match(/from '([^']+)'/);
	if (filenameMatch) {
		info.filename = filenameMatch[1];
	}
	// Lấy duration và bitrate
	const durationMatch = ffmpegOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+),.*bitrate: (\d+) kb\/s/);
	if (durationMatch) {
		const hours = parseInt(durationMatch[1], 10);
		const minutes = parseInt(durationMatch[2], 10);
		const seconds = parseFloat(durationMatch[3]);
		info.duration = hours * 3600 + minutes * 60 + seconds;
		info.bitrateTotal = parseInt(durationMatch[4], 10);
		info.size = info.duration * info.bitrateTotal * 1024 / 8; // bytes
		if (info.size >= 1024 * 1024 * 1024) {
			info.displaySize = `${(info.size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
		} else if (info.size >= 1024 * 1024) {
			info.displaySize = `${(info.size / (1024 * 1024)).toFixed(2)} MB`;
		} else {
			info.displaySize = `${(info.size / 1024).toFixed(2)} KB`;
		}
	}
	// Tìm tất cả các stream
	const streamRegex = /Stream #(\d+:\d+)[^:]*: (Video|Audio): ([^,]+),([^\n]*)/g;
	let match;
	while ((match = streamRegex.exec(ffmpegOutput)) !== null) {
		const streamInfo = {
			index: match[1],
			type: match[2],
			codec_name: (match[3].match(/[a-zA-Z0-9]+/g) ? match[3].match(/[a-zA-Z0-9]+/g)[0].toLowerCase() : match[3].split(' ')[0].toLowerCase())
		};
		if (streamInfo.codec_name == 'hevc') streamInfo.codec_name = 'h265';

		const attributes = match[4].split(',');
		attributes.forEach(attr => {
			attr = attr.trim();

			if (streamInfo.codec_name == 'mjpeg' || streamInfo.codec_name == 'png' || streamInfo.codec_name == 'gif' || streamInfo.codec_name == 'webp') {
				streamInfo.type = 'Image';
			}


			// Bitrate cho từng stream
			const bitrateMatch = attr.match(/(\d+) kb\/s/);
			if (bitrateMatch) {
				streamInfo.bitrate = parseInt(bitrateMatch[1], 10);
			}
			if (streamInfo.type === 'Video') {
				info.videoCodec = streamInfo.codec_name || '';
				info.videoBitRate = streamInfo.bitrate || 0;
				const sizeMatch = attr.match(/(\d+)x(\d+)/);
				if (sizeMatch) {
					streamInfo.width = parseInt(sizeMatch[1], 10);
					streamInfo.height = parseInt(sizeMatch[2], 10);
					const displayMatrixMatch = ffmpegOutput.match(/displaymatrix: rotation of ([\-\d\.]+) degrees/);
					if (displayMatrixMatch) {
						streamInfo.displaymatrix = parseInt(displayMatrixMatch[1]);
						if (Math.abs(streamInfo.displaymatrix) === 90 || Math.abs(streamInfo.displaymatrix) === 270) {
							// Đổi chiều width và height nếu xoay 90 hoặc 270 độ
							const temp = streamInfo.width;
							streamInfo.width = streamInfo.height;
							streamInfo.height = temp;
						}
					}

					info.width = streamInfo.width;
					info.height = streamInfo.height;
				}
				const fpsMatch = attr.match(/(\d+(?:\.\d+)?) fps/);
				if (fpsMatch) {
					streamInfo.fps = parseFloat(fpsMatch[1]);
					info.fps = streamInfo.fps;
				}


				streamInfo.video_stream_index = info.streams.length;
			} else if (streamInfo.type === 'Audio') {
				info.audioCodec = streamInfo.codec_name || '';
				info.audioBitRate = streamInfo.bitrate || 0;
				const hzMatch = attr.match(/(\d+) Hz/);
				if (hzMatch) {
					streamInfo.hz = parseInt(hzMatch[1], 10);
				}
				if (attr.includes('stereo')) {
					streamInfo.channels = 2;
				} else if (attr.includes('mono')) {
					streamInfo.channels = 1;
				}
				streamInfo.audio_stream_index = info.streams.length;
			}
		});
		info.streams.push(streamInfo);
	}
	return info;
}

function int32ToArray(i) {
	return Uint8Array.of(
		(i & 0x000000ff) >> 0,
		(i & 0x0000ff00) >> 8,
		(i & 0x00ff0000) >> 16,
		(i & 0xff000000) >> 24
	);
}

function arrayToInt32(buff) {
	var view = new DataView(buff.buffer, 0);
	return view.getInt32(0, true);
}

//number>=0
function int64ToArray(number) {
	const lenOfBytes = 8;
	const byteArray = new Uint8Array(lenOfBytes);
	for (let index = 0; index < byteArray.length; index++) {
		const byte = number & 0xff;
		byteArray[index] = byte;
		number = (number - byte) / 256;
	}
	return byteArray;
}

function arrayToInt64(byteArray) {
	let result = 0;
	for (let i = byteArray.length - 1; i >= 0; i--) {
		result = (result * 256) + byteArray[i];
	}

	return result;
}

//================ function utils=====================
function get_input_output_from_cmd_array(cmd_array) {
	const inputs = [];
	const outputs = [];

	// Flags có argument (cần skip argument)
	const flagsWithArgs = new Set([
		'-i', '-c:v', '-c:a', '-b:v', '-b:a', '-r', '-s',
		'-vf', '-af', '-ss', '-to', '-t', '-f', '-codec',
		'-acodec', '-vcodec', '-preset', '-crf', '-ac', '-ar', '-seekable',
		'-loglevel', '-stats_period', '-progress', '-bsf:v', '-bsf:a',
		'-aspect', '-codec:v', '-codec:a', '-filter:v', '-filter:a',
		'-movflags', '-frag_duration', '-min_frag_duration'
	]);

	// Flags không có argument
	const flagsWithoutArgs = new Set([
		'-y', '-n', '-an', '-vn', '-sn', '-dn', '-', '-nostats',
		'-vsync', '-hide_banner', '-stats'
	]);

	let i = 0;
	let lastWasInput = false;

	while (i < cmd_array.length) {
		const arg = cmd_array[i];

		// Xử lý -i (input)
		if (arg === '-i') {
			if (i + 1 < cmd_array.length) {
				inputs.push(cmd_array[i + 1]);
				i += 2;
				lastWasInput = true;
				continue;
			}
		}

		// Xử lý flags với argument
		if (flagsWithArgs.has(arg)) {
			i += 2; // Skip flag và argument
			lastWasInput = false;
			continue;
		}

		// Xử lý flags không có argument
		if (flagsWithoutArgs.has(arg)) {
			i += 1;
			lastWasInput = false;
			continue;
		}

		// Xử lý flags khác (bắt đầu bằng -)
		if (arg.startsWith('-')) {
			// Giả sử flag này có argument (hoặc có thể không có)
			// Kiểm tra element tiếp theo có phải flag không
			if (i + 1 < cmd_array.length && !cmd_array[i + 1].startsWith('-')) {
				i += 2;
			} else {
				i += 1;
			}
			lastWasInput = false;
			continue;
		}

		// Nếu không phải flag
		// - Nếu vừa parse input: bỏ qua (đã được xử lý ở -i)
		// - Nếu không phải input: là output
		if (!lastWasInput) {
			outputs.push(arg);
		}
		lastWasInput = false;
		i++;
	}

	return { inputs, outputs };
}

//check string là filename hợp lệ ví dụ: "output.mp4", "video.avi"...

function is_valid_filename(str) {
	if (typeof str !== 'string') return false;
	if (str.length === 0) return false;
	if (str.startsWith('-')) return false;  // Tránh nhầm với flag
	// Kiểm tra không có ký tự đặc biệt không hợp lệ trong tên file
	const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/;
	if (invalidChars.test(str)) {
		return false;
	}
	return true;
}

// Check string is URL (http, https, or blob)
function isUrl(str) {
	return typeof str === 'string' && /^(https?|blob):/i.test(str);
}

async function getBlobUrl(url) {
	if (typeof blobUrlMap === 'undefined') {
		blobUrlMap = {};
	}
	if (blobUrlMap[url]) {
		return blobUrlMap[url];
	}

	let response = await fetch(url);
	let blob = await response.blob();
	blobUrlMap[url] = URL.createObjectURL(blob);
	return blobUrlMap[url];
}

function getUrlLength(originalUrl) {


	if (typeof urlLengthStore === 'undefined') {
		urlLengthStore = {};
	}

	if (urlLengthStore[originalUrl]) {
		return urlLengthStore[originalUrl];
	}

	var method = originalUrl.indexOf('http') == 0 ? "HEAD" : "GET";
	var xhr = new XMLHttpRequest;
	var length = -1;
	xhr.open(method, originalUrl, false);
	if (method === 'GET') {
		xhr.setRequestHeader("Range", "bytes=" + 0 + "-" + 1);
	}
  try {
    xhr.send(null);
  } catch (e) {
    const mainBroadcastChannel = new BroadcastChannel("app_channel");
    mainBroadcastChannel.postMessage({
      type_cmd: CMD_BEE_ERROR,
      msg: 'An error occurred, please try again',
    });
  }

	if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) {
    const mainBroadcastChannel = new BroadcastChannel("app_channel");
    mainBroadcastChannel.postMessage({
      type_cmd: CMD_BEE_ERROR,
      msg: 'An error occurred, please try again',
    });
    throw new Error("Couldn't load " + originalUrl + ". Status: " + xhr.status);
  }

	if (method === 'GET') {
		length = Number(xhr.getAllResponseHeaders().match(/\/(\d+)/i)[1]);
	} else {
		length = Number(xhr.getResponseHeader("Content-length"));
	}
	urlLengthStore[originalUrl] = length;
	return length;
}

/**
 * Chọn bitrate cho video dựa vào codec, width, height và chất lượng
 * @param {string} codec - 'av1', 'vp9', 'h264', 'h265'
 * @param {number} width
 * @param {number} height
 * @param {string} quality - 'low', 'medium', 'high'
 * @returns {number} bitrate (bps)
 */
function selectBitrateByCodec(codec, width, height, quality = 'medium') {
	codec = (codec || '').toLowerCase();
	quality = (quality || 'medium').toLowerCase();
	// Bảng bitrate cơ bản theo codec và độ phân giải (kbps)
	const baseBitrateTable = {
		h264: [
			{ maxWidth: 640, maxHeight: 480, bitrate: 1000 },
			{ maxWidth: 1280, maxHeight: 720, bitrate: 2500 },
			{ maxWidth: 1920, maxHeight: 1080, bitrate: 5000 },
			{ maxWidth: 2560, maxHeight: 1440, bitrate: 8000 },
			{ maxWidth: 3840, maxHeight: 2160, bitrate: 14000 }
		],
		h265: [
			{ maxWidth: 640, maxHeight: 480, bitrate: 700 },
			{ maxWidth: 1280, maxHeight: 720, bitrate: 1800 },
			{ maxWidth: 1920, maxHeight: 1080, bitrate: 3500 },
			{ maxWidth: 2560, maxHeight: 1440, bitrate: 6000 },
			{ maxWidth: 3840, maxHeight: 2160, bitrate: 10000 }
		],
		vp9: [
			{ maxWidth: 640, maxHeight: 480, bitrate: 800 },
			{ maxWidth: 1280, maxHeight: 720, bitrate: 2000 },
			{ maxWidth: 1920, maxHeight: 1080, bitrate: 4000 },
			{ maxWidth: 2560, maxHeight: 1440, bitrate: 7000 },
			{ maxWidth: 3840, maxHeight: 2160, bitrate: 12000 }
		],
		av1: [
			{ maxWidth: 640, maxHeight: 480, bitrate: 600 },
			{ maxWidth: 1280, maxHeight: 720, bitrate: 1500 },
			{ maxWidth: 1920, maxHeight: 1080, bitrate: 3000 },
			{ maxWidth: 2560, maxHeight: 1440, bitrate: 5000 },
			{ maxWidth: 3840, maxHeight: 2160, bitrate: 9000 }
		]
	};
	// Hệ số chất lượng
	const qualityFactor = {
		low: 0.6,
		medium: 1,
		high: 1.5
	};
	let bitrate = 1000; // default
	const table = baseBitrateTable[codec] || baseBitrateTable['h264'];
	for (const row of table) {
		if (width <= row.maxWidth && height <= row.maxHeight) {
			bitrate = row.bitrate;
			break;
		}
	}
	return 1024 * Math.round(bitrate * (qualityFactor[quality] || 1)); // trả về bps
}

function get_name_for_worker(file_index, stream_index, is_encoder) {
	if (is_encoder) {
		return `encoder-file_index=${file_index}-stream_index=${stream_index}`;
	} else {
		return `decoder-file_index=${file_index}-stream_index=${stream_index}`
	}
}

/**
 * // Example usage inside worker
 * const res = await callMain('getValue', {name:'...'  });
 * console.log(res); // 'ok'
 * @param {*} fn 
 * @param {*} payload 
 * @returns 
 */
function callMain(fn, payload, transferableObjects) {


	return new Promise((resolve, reject) => {
		const id = Date.now();

		const listener = ({ data }) => {
			console.log('callMain listener data>>>>>>>>>>>>>>>:', data);
			if (data.type_cmd !== CMD_BEE_CALL_MAIN_RESPONSE || data.id !== id) return;
			self.removeEventListener('message', listener);
			data.error ? reject(new Error(data.error)) : resolve(data);
		};

		self.addEventListener('message', listener);


		console.log('callMain=====================', id, payload);
		self.postMessage({ type_cmd: CMD_BEE_CALL_MAIN, id, fn, payload }, transferableObjects);
	});
}

function removeExtension(filename) {
	const lastDotIndex = filename.lastIndexOf('.');
	return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
}

async function convertUserOptionsToCommand(userOptions) {

	function calculateOutputDimensions(iw, ih, targetW, targetH) {
		if (iw === targetW && ih === targetH) return { ow: iw, oh: ih };
		const ratio = targetW / targetH;
		const ow1 = iw, oh1 = iw / ratio;
		const ow2 = ih * ratio, oh2 = ih;
		let ow = oh1 >= ih ? ow1 : ow2;
		let oh = oh1 >= ih ? oh1 : oh2;
		ow = Math.ceil(ow) + (Math.ceil(ow) % 2);
		oh = Math.ceil(oh) + (Math.ceil(oh) % 2);
		return { ow, oh };
	}

	var fileInfo = await getFileInfo(userOptions.input_url);
	var getStartTime = () => userOptions.trim?.startTime ?? -1;
	var getEndTime = () => userOptions.trim?.endTime ?? -1;
	const libNameMap = { h264: 'libx264', h265: 'libx265', av1: 'libaom-av1', vp9: 'libvpx-vp9' };

	var getVF = () => {
		const filters = [];

		// Crop filter (nếu có)
		if (userOptions.crop) {
			filters.push(`crop=${userOptions.crop.width}:${userOptions.crop.height}:${userOptions.crop.x}:${userOptions.crop.y}`);
		}

		//nếu không có tuỳ chọn target_size
		if (!userOptions.target_size) {
			var { iw, ih } = { iw: userOptions.crop?.width || fileInfo.width, ih: userOptions.crop?.height || fileInfo.height };
			var { ow, oh } = calculateOutputDimensions(iw, ih, (userOptions.resolution?.width || userOptions.crop?.width || fileInfo.width),

				(userOptions.resolution?.height || userOptions.crop?.height || fileInfo.height));
			if (ow != iw || oh != ih)
				filters.push(`pad=${ow}:${oh}:${(ow - iw) / 2}:${(oh - ih) / 2}:black`);
		}


		// Flip filters
		if (userOptions.vflip) filters.push('vflip');
		if (userOptions.hflip) filters.push('hflip');
		return filters.join(',');
	};
	var outputDuration = (getEndTime() > 0 ? getEndTime() : fileInfo.duration) - (getStartTime() >= 0 ? getStartTime() : 0);
	userOptions.fps = userOptions.fps || fileInfo.fps;
	if (userOptions.target_size) {
		// Tính toán bitrate dựa trên kích thước mục tiêu (MB)
		const targetSizeBytes = userOptions.target_size * 1024 * 1024; // Chuyển MB sang bytes
		// const audioBitrate = 128 * 1024; // Giả sử bitrate audio là 128 kbps
		const bitrateTotalNew = (targetSizeBytes * 8) / outputDuration; // Bitrate video = (Tổng bitrate - Bitrate audio)
		if (fileInfo.audioBitRate * 1024 >= 0.3 * bitrateTotalNew) {
			var oldAudioBitrate = fileInfo.audioBitRate;
			fileInfo.audioBitRate = Math.floor(0.3 * bitrateTotalNew / 1024);
			fileInfo.bitrateTotal += (fileInfo.audioBitRate - oldAudioBitrate);
		}
		var remainingBitrate = fileInfo.bitrateTotal - fileInfo.videoBitRate; // - audioBitrate;
		var videoBitRateNew = Math.max(bitrateTotalNew - remainingBitrate * 1024, 10);
		
		var targetConfig = findOptimalConfigForBitrate(videoBitRateNew, userOptions.format_name, userOptions.crop?.width || fileInfo.width, userOptions.crop?.height || fileInfo.height, fileInfo.fps);
		userOptions.fps = targetConfig.fps;
		userOptions.resolution = { width: targetConfig.width, height: targetConfig.height };
		userOptions.videoBitrate = 0.85 * videoBitRateNew;
	}

	var cmd_array = ['-loglevel', 'info', '-stats_period', 2, '-progress', '-', '-nostats'];
	var startTime = getStartTime();
	var endTime = getEndTime();

	startTime > 0 && cmd_array.push('-ss', startTime);
	endTime > 0 && cmd_array.push('-to', endTime);
	cmd_array.push('-r', fileInfo.fps);
	cmd_array.push('-i', userOptions.input_url);



	startTime > 0 && cmd_array.push('-ss', startTime);
	endTime > 0 && cmd_array.push('-to', endTime);
	cmd_array.push('-r', fileInfo.fps);
	cmd_array.push('-i', userOptions.input_url);

	cmd_array.push('-map', '1:v:0', '-map', '0:a?', '-map', '0:s?');
	cmd_array.push('-map_metadata', '-1'); // Remove all metadata streams
	cmd_array.push('-map_chapters', '-1'); // Remove chapters
	cmd_array.push('-dn');               // Disable data streams
	cmd_array.push('-c:v', libNameMap[userOptions.format_name] || 'libx264');

	getVF().length > 0 && cmd_array.push('-vf', getVF());

	if (userOptions.volume_level != 1) {
		cmd_array.push('-af', `volume=${userOptions.volume_level}`);
	}


	var outputWidth = userOptions.resolution?.width || userOptions.crop?.width || fileInfo.width;
	var outputHeight = userOptions.resolution?.height || userOptions.crop?.height || fileInfo.height;
	if (userOptions.videoBitrate) {
		cmd_array.push('-b:v', dec(userOptions.videoBitrate, 0));
	} else if (userOptions.quality) {
		cmd_array.push('-b:v', selectBitrateByCodec(userOptions.format_name, outputWidth, outputHeight, userOptions.quality.toLowerCase()));
	}
	var needReencode = false;
	needReencode = needReencode || (userOptions.format_name && userOptions.format_name !== fileInfo.videoCodec);
	needReencode = needReencode || (userOptions.fps != -1 && userOptions.fps !== fileInfo.fps);
	needReencode = needReencode || (getVF().length > 0);
	needReencode = needReencode || (fileInfo.width !== outputWidth || fileInfo.height !== outputHeight);
	needReencode = needReencode || (userOptions.quality != null);

	if (needReencode) {
		cmd_array.push('-r', userOptions.fps > 0 ? userOptions.fps : fileInfo.fps);
		cmd_array.push('-vsync', '2'); //always
		if (fileInfo.audioBitRate > 0) {
			cmd_array.push('-b:a', 1024 * fileInfo.audioBitRate);
		}
	} else {
		['h265', 'h264'].includes(userOptions.format_name) && cmd_array.push('-bsf:v', userOptions.format_name === 'h265' ? 'hevc_mp4toannexb' : 'h264_mp4toannexb');
		cmd_array[cmd_array.indexOf('-c:v') + 1] = 'copy'; userOptions.volume_level == 1 && (cmd_array[cmd_array.indexOf('-c:v')] = '-c');
	}

	if (userOptions.format_name === 'h265') {
		cmd_array.push('-tag:v');
		cmd_array.push('hvc1');
	} else if (userOptions.format_name === 'h264') {
		cmd_array.push('-tag:v');
		cmd_array.push('avc1');
	}

	// ← VPS/SPS/PPS mỗi keyframe
	if (needReencode) {
		if (userOptions.format_name == 'h265') {
			cmd_array.push('-preset', 'ultrafast');
		}
		cmd_array.push('-s', `${outputWidth}x${outputHeight}`);
	}

	var filename = fileInfo.name || 'converted_video';
	filename = removeExtension(filename) + '-' + getStringTime() + (userOptions.format_name == 'vp9' ? '.webm' : '.mp4');
	cmd_array.push(filename);

	return { command: cmd_array, settings: { width: outputWidth, height: outputHeight, duration: outputDuration, fps: userOptions.fps, target_size: userOptions.target_size, output_filename: filename, input_filename: fileInfo.name, input_size: fileInfo.size } };
}



function validateObj(obj) {
	const formatNames = ["h264", "h265", "vp9", "av1"];
	const qualities = ["Low", "Medium", "High"];

	// debugger;

	if (!(obj.input_url instanceof File) && !(typeof FileSystemFileHandle !== 'undefined' && obj.input_url instanceof FileSystemFileHandle) && typeof obj.input_url !== 'string' && !(obj.input_url instanceof String)) return 'đầu input_url không hợp lệ';
	if (!formatNames.includes(obj.format_name)) return 'đầu format_name không hợp lệ';
	if (obj.trim !== undefined) {
		if (typeof obj.trim !== 'object' || typeof obj.trim.startTime !== 'number' || typeof obj.trim.endTime !== 'number') return 'đầu trim không hợp lệ';
		if (obj.trim.startTime < 0 || obj.trim.endTime <= obj.trim.startTime) return 'đầu trim không hợp lệ';
	}

	if (obj.crop !== undefined) {
		if (typeof obj.crop !== 'object' || typeof obj.crop.width !== 'number' || typeof obj.crop.height !== 'number' || typeof obj.crop.x !== 'number' || typeof obj.crop.y !== 'number') return 'đầu crop không hợp lệ';
		if (obj.crop.width % 2 !== 0 || obj.crop.height % 2 !== 0) return 'đầu crop không hợp lệ';
	}

	if (obj.target_size !== undefined) {
		if (typeof obj.target_size !== 'number' || obj.target_size < 1 || obj.target_size > 1000) return 'đầu target_size không hợp lệ';
	}

	if (obj.resolution !== undefined) {
		if (typeof obj.resolution !== 'object' || typeof obj.resolution.width !== 'number' || typeof obj.resolution.height !== 'number') return 'đầu resolution không hợp lệ';
		if (obj.resolution.width % 2 !== 0 || obj.resolution.height % 2 !== 0) return 'đầu resolution không hợp lệ';
	}

	//cho phép các biến  hflip, vflip, volume_level, fps, quality có thể là undefined
	if (obj.hflip === undefined) obj.hflip = 0;
	if (obj.vflip === undefined) obj.vflip = 0;
	if (obj.volume_level === undefined) obj.volume_level = 1;
	if (obj.fps === undefined) obj.fps = -1;

	if (obj.hflip !== 0 && obj.hflip !== 1) return 'đầu hflip không hợp lệ';
	if (obj.vflip !== 0 && obj.vflip !== 1) return 'đầu vflip không hợp lệ';
	if (typeof obj.volume_level !== 'number' || obj.volume_level < 0 || obj.volume_level > 3) return 'đầu volume_level không hợp lệ';
	if (obj.fps !== -1 && (typeof obj.fps !== 'number' || obj.fps < 10 || obj.fps > 60)) return 'đầu fps không hợp lệ';

}

function getScaleWidth(device = "DESKTOP") {
	let scaleWidth = 720;
	switch (device) {
		case "MOBILE":
			scaleWidth = 320;
			break;
		case "TABLET":
			scaleWidth = 480;
			break;
		case "DESKTOP":
		default:
			scaleWidth = 720;
			break;
	}
	return scaleWidth;
}