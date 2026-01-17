
const CODEC_MAP = {
	"I420": { "value": 0, "bpp": 12 }, "I420A": { "value": 33, "bpp": 20 }, "I422": { "value": 4, "bpp": 16 }, "I422A": { "value": 78, "bpp": 24 },
	"I444": { "value": 5, "bpp": 24 }, "I444A": { "value": 79, "bpp": 32 }, "NV12": { "value": 23, "bpp": 12 },
	"RGBA": { "value": 26, "bpp": 32 }, "RGBX": { "value": 119, "bpp": 32 }, "BGRA": { "value": 28, "bpp": 32 }, "BGRX": { "value": 121, "bpp": 32 }
};

/**
 * ✅ Get quantizer value based on codec and quality level
 * @param {string} codec - Codec name (avc/h264/hevc/h265/vp9/vp09/av1/av01)
 * @param {string} quality - Quality level (low/medium/high/ultra)
 * @returns {number} Quantizer value (CRF for H.264/H.265, CQ for VP9/AV1)
 */
function getQuantizerForQuality(codec, quality) {
	const map = {
		avc: { ultra: 18, high: 23, medium: 28, low: 33 },
		hevc: { ultra: 20, high: 25, medium: 30, low: 35 },
		vp9: { ultra: 10, high: 20, medium: 30, low: 40 },
		av1: { ultra: 12, high: 23, medium: 32, low: 42 }
	};

	const c = codec.toLowerCase().replace(/h264|h\.264/, 'avc').replace(/h265|h\.265/, 'hevc').replace(/vp09/, 'vp9').replace(/av01/, 'av1');
	const q = quality.toLowerCase();

	return map[c]?.[q] ?? map[c]?.medium ?? 28;
}

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
			body: formData,
			headers: {
				// ✅ Keep-alive headers
				'Connection': 'keep-alive',
				'Keep-Alive': 'timeout=60, max=100'
			},
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

	//const dateStr = `${hh}.${min}.${ss}-${dd}.${mm}.${yyyy}`;
	const dateStr = `${dd}-${mm}-${yyyy}_${hh}h${min}m${ss}s`;

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
				//Stream #0:1[0x2](eng): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)
				// Stream #0:1[0x2](eng): Audio: ac3 (ac-3 / 0x332D6361), 48000 Hz, 5.1(side), fltp, 320 kb/s (default)
				info.audioCodec = streamInfo.codec_name || '';
				info.audioBitRate = streamInfo.bitrate || 0;
				const hzMatch = attr.match(/(\d+) Hz/);
				if (hzMatch) {
					streamInfo.hz = parseInt(hzMatch[1], 10);
				}
				//debugger;
				// ✅ Fix: Parse audio channels correctly
				if (attr.includes('stereo')) {
					streamInfo.channels = 2;
				} else if (attr.includes('mono')) {
					streamInfo.channels = 1;
				} else if (attr.includes('5.1')) {
					streamInfo.channels = 6; // 5.1 = 6 channels (FL, FR, FC, LFE, BL, BR)
				} else if (attr.includes('7.1')) {
					streamInfo.channels = 8; // 7.1 = 8 channels
				} else if (attr.includes('quad')) {
					streamInfo.channels = 4; // Quadraphonic
				} else if (attr.includes('3.0')) {
					streamInfo.channels = 3; // Left, Right, Center
				} else if (attr.includes('2.1')) {
					streamInfo.channels = 3; // Stereo + LFE
				}
				//  else {
				//     // ✅ Fallback: Parse from channel layout patterns
				//     const channelMatch = attr.match(/(\d+)(?:\.\d+)?\s*(?:channels?|ch)/i);
				//     if (channelMatch) {
				//         streamInfo.channels = parseInt(channelMatch[1], 10);
				//     } else {
				//         // ✅ Default to stereo if not detected
				//         streamInfo.channels = 2;
				//     }
				// }

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
		if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) {
			throw new Error("Couldn't load " + originalUrl + ". Status: " + xhr.status);
		}
	} catch (e) {
		const mainBroadcastChannel = new BroadcastChannel("app_channel");
		mainBroadcastChannel.postMessage({
			type_cmd: CMD_BEE_ERROR,
			msg: 'An error occurred, please try again (101)',
		});
	}



	if (method === 'GET') {
		length = Number(xhr.getAllResponseHeaders().match(/\/(\d+)/i)[1]);
	} else {
		length = Number(xhr.getResponseHeader("Content-length"));
	}
	urlLengthStore[originalUrl] = length;
	return length;
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
			if (data.type_cmd !== CMD_BEE_CALL_MAIN_RESPONSE || data.id !== id) return;
			self.removeEventListener('message', listener);
			data.error ? reject(new Error(data.error)) : resolve(data);
		};

		self.addEventListener('message', listener);


		self.postMessage({ type_cmd: CMD_BEE_CALL_MAIN, id, fn, payload }, transferableObjects);
	});
}

function removeExtension(filename) {
	const lastDotIndex = filename.lastIndexOf('.');
	return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
}

function validateObj(obj) {
	const formatNames = ["h264", "h265", "vp9", "av1"];
	const qualities = ["Low", "Medium", "High"];

	// debugger;

	if (!(obj.input_url instanceof File) && !(typeof FileSystemFileHandle !== 'undefined' && obj.input_url instanceof FileSystemFileHandle) && typeof obj.input_url !== 'string' && !(obj.input_url instanceof String)) return 'input_url is invalid';
	if (!formatNames.includes(obj.format_name)) return 'format is invalid';
	if (obj.trim !== undefined) {
		if (typeof obj.trim !== 'object' || typeof obj.trim.startTime !== 'number' || typeof obj.trim.endTime !== 'number') return 'trim is invalid';
		if (obj.trim.startTime < 0 || obj.trim.endTime <= obj.trim.startTime) return 'trim is invalid';
	}

	if (obj.crop !== undefined) {
		if (typeof obj.crop !== 'object' || typeof obj.crop.width !== 'number' || typeof obj.crop.height !== 'number' || typeof obj.crop.x !== 'number' || typeof obj.crop.y !== 'number') return 'crop is invalid';
		if (obj.crop.width % 2 !== 0 || obj.crop.height % 2 !== 0) return 'crop is invalid';
	}

	if (obj.target_size !== undefined) {
		if (typeof obj.target_size !== 'number' || obj.target_size < 1 || obj.target_size > 1900) return 'target is invalid';
	}

	if (obj.resolution !== undefined) {
		if (typeof obj.resolution !== 'object' || typeof obj.resolution.width !== 'number' || typeof obj.resolution.height !== 'number') return 'resolution is invalid';
		// if (obj.resolution.width % 2 !== 0 || obj.resolution.height % 2 !== 0) return 'resolution is invalid';
	}

	//cho phép các biến  hflip, vflip, volume_level, fps, quality có thể là undefined
	if (obj.hflip === undefined) obj.hflip = 0;
	if (obj.vflip === undefined) obj.vflip = 0;
	if (obj.volume_level === undefined) obj.volume_level = 1;
	if (obj.fps === undefined) obj.fps = -1;

	if (obj.hflip !== 0 && obj.hflip !== 1) return 'hflip is invalid';
	if (obj.vflip !== 0 && obj.vflip !== 1) return 'vflip is invalid';
	if (typeof obj.volume_level !== 'number' || obj.volume_level < 0 || obj.volume_level > 3) return 'volume is invalid';
	if (obj.fps !== -1 && (typeof obj.fps !== 'number' || obj.fps < 10 || obj.fps > 60)) return 'fps is invalid';

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
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
function isSafari() {
	const ua = navigator.userAgent;
	const isSafari = /Safari/.test(ua)
		&& !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPR|Opera|SamsungBrowser/.test(ua);

	const isIOS = /iPhone|iPad|iPod/.test(navigator.platform)
		|| (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

	// ✅ Check if we're in worker context
	const isWorker = typeof window === 'undefined';
	let isWKWebView = false;

	if (!isWorker) {
		// Main thread: check window.webkit
		isWKWebView = window.webkit?.messageHandlers !== undefined;
	} else {
		// Worker context: fallback to platform detection
		// WKWebView usually runs on iOS, so assume true for iOS
		isWKWebView = isIOS;
	}

	return isSafari || (isIOS && isWKWebView);
}
var is_safari = isSafari();

async function convertUserOptionsToCommand(userOptions) {

	userOptions = JSON.parse(JSON.stringify(userOptions || {}));
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
	fileInfo = JSON.parse(JSON.stringify(fileInfo || {}));//copy
	var getStartTime = () => userOptions.trim?.startTime ?? -1;
	var getEndTime = () => userOptions.trim?.endTime ?? -1;
	var outputDuration = (getEndTime() > 0 ? getEndTime() : fileInfo.duration) - (getStartTime() >= 0 ? getStartTime() : 0);
	var settings = {};
	const libNameMap = { h264: 'libx264', h265: 'libx265', av1: 'libaom-av1', vp9: 'libvpx-vp9' };

	var getVideoFilters = () => {
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

		if (userOptions.vflip) filters.push('vflip');
		if (userOptions.hflip) filters.push('hflip');
		return filters.join(',');
	};

	userOptions.fps = userOptions.fps || fileInfo.fps;
	if (userOptions.target_size) {
		//debugger;
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
		var maxBitrate = findMaxBitrate(3840, 2160, 30, userOptions.format_name);
		videoBitRateNew = Math.min(videoBitRateNew, maxBitrate);
		var targetConfig = await findBestVideoEncoderConfigForTargetSize(userOptions.format_name, userOptions.crop?.width || fileInfo.width, userOptions.crop?.height || fileInfo.height, 0.9 *videoBitRateNew, 24, true);

		if (!targetConfig || !targetConfig.width || !targetConfig.height) {
			console.error('❌ Failed to find suitable encoder config for target size conversion');
			return { command: null, settings: null };
		}
		userOptions.fps = targetConfig.framerate;
		userOptions.resolution = { width: targetConfig.width, height: targetConfig.height };
		userOptions.videoBitrate = (0.9 * videoBitRateNew) & ~0; // Giảm 10% để có khoảng trống cho audio và biến động bitrate		
		userOptions.videoBitrate = Math.max(10000, Math.min(userOptions.videoBitrate, targetConfig.max_bitrate || videoBitRateNew));
	}

	var control_cmd_array = ['-fflags', '+genpts', '-avoid_negative_ts', '1', '-loglevel', 'info', '-stats_period', 2, '-progress', '-', '-nostats'];
	var input_cmd_array = [];
	var video_cmd_array = [];
	var audio_cmd_array = [];
	var output_cmd_array = [];

	//var cmd_array = [].concat(header_array, input_cmd_array);
	//----input_cmd_array------------------------------------------------------------------------------------------
	getStartTime() > 0 && input_cmd_array.push('-ss', getStartTime());
	getEndTime() > 0 && input_cmd_array.push('-to', getEndTime());
	input_cmd_array.push('-r', fileInfo.fps);
	input_cmd_array.push('-i', userOptions.input_url);

	//----video_cmd_array------------------------------------------------------------------------------------------	
	var videoFilters = getVideoFilters();


	if (videoFilters.length > 0) {
		video_cmd_array.push('-filter_complex', `[0:v]${videoFilters}[outv]`, '-map', '[outv]');
	}

	var outputWidth = userOptions.resolution?.width || userOptions.crop?.width || fileInfo.width;
	var outputHeight = userOptions.resolution?.height || userOptions.crop?.height || fileInfo.height;

	var needReencode = false;
	needReencode = needReencode || (userOptions.format_name && userOptions.format_name !== fileInfo.videoCodec);
	needReencode = needReencode || (userOptions.fps != -1 && userOptions.fps !== fileInfo.fps);
	needReencode = needReencode || (getVideoFilters().length > 0);
	needReencode = needReencode || (fileInfo.width !== outputWidth || fileInfo.height !== outputHeight);
	needReencode = needReencode || (userOptions.quality != null);

	video_cmd_array.push('-c:v', needReencode == true ? libNameMap[userOptions.format_name] || 'libx264' : 'copy');

	if (needReencode && !userOptions.target_size) {
		var outputConfig = await findBestVideoEncoderConfigForTargetSize(userOptions.format_name, outputWidth, outputHeight, 0, userOptions.fps > 0 ? userOptions.fps : fileInfo.fps);

		if (outputConfig && outputConfig.width && outputConfig.height) {
			outputWidth = outputConfig.width;
			outputHeight = outputConfig.height;
		} else {
			// ✅ Nếu không tìm thấy config, kiểm tra lại với resolution gốc
			console.warn(`⚠️ Could not find optimal encoder config, checking support for original resolution: ${outputWidth}x${outputHeight}`);
			const isSupported = await isVideoEncoderConfigSupported(userOptions.format_name, outputWidth, outputHeight, userOptions.fps > 0 ? userOptions.fps : fileInfo.fps, 0);
			if (!isSupported) {
				console.error(`❌ Codec ${userOptions.format_name} is not supported at resolution ${outputWidth}x${outputHeight}@${userOptions.fps > 0 ? userOptions.fps : fileInfo.fps}fps`);
				return { command: null, settings: null };
			}
		}
	}

	
	if (needReencode) {
		if (userOptions.target_size) {
			video_cmd_array.push('-b:v', userOptions.videoBitrate);
		}else{
			video_cmd_array.push('-b:v', selectBitrateByCodec(userOptions.format_name, outputWidth, outputHeight, userOptions.quality || 'medium', userOptions.fps > 0 ? userOptions.fps : fileInfo.fps));
		}
	}
	if (needReencode) {
		const targetFps = userOptions.fps > 0 ? userOptions.fps : fileInfo.fps;
		video_cmd_array.push('-r', targetFps);
		video_cmd_array.push('-vsync', '2');
		// video_cmd_array.push('-copyts');
	} else {
		// không cần dùng -bsf:v nữa (tested 10/01/26)
		// ['h265', 'h264'].includes(userOptions.format_name) &&
		// 	video_cmd_array.push('-bsf:v', userOptions.format_name === 'h265' ? 'hevc_mp4toannexb' : 'h264_mp4toannexb');
		// video_convert_cmd_array[video_convert_cmd_array.indexOf('-c:v') + 1] = 'copy';
		//  userOptions.volume_level == 1 && (video_convert_cmd_array[video_convert_cmd_array.indexOf('-c:v')] = '-c');
	}

	// ← VPS/SPS/PPS mỗi keyframe
	if (needReencode) {
		// if (userOptions.format_name == 'h265') {
		// 	video_convert_cmd_array.push('-preset', 'ultrafast');
		// }
		video_cmd_array.push('-s', `${outputWidth}x${outputHeight}`);
	}

	if (needReencode == true) {
		video_cmd_array.push('-pix_fmt', fileInfo.fmt);//rgb0 = AV_PIX_FMT_RGB0, rgb0 nhanh hơn rgba một chút
	}

	var tagVideo = [];
	if (userOptions.format_name === 'h265') {
		tagVideo.push('-tag:v');
		tagVideo.push('hvc1');
	} else if (userOptions.format_name === 'h264') {
		tagVideo.push('-tag:v');
		tagVideo.push('avc1');
	}

	//----audio_cmd_array------------------------------------------------------------------------------------------	
	const isVP9 = userOptions.format_name === 'vp9';
	const isOpusOutput = isVP9; // VP9 typically uses Opus audio
	const audioStreams = fileInfo.streams.filter(s => s.type === 'Audio');

	// ✅ Process audio streams
	if (audioStreams.length > 0) {
		let needAudioEncode = userOptions.volume_level != 1;

		// ✅ Check if any stream needs encoding (multi-channel)
		if (!needAudioEncode) {
			needAudioEncode = audioStreams.some(stream => stream.channels && stream.channels > 2);
		}

		// ✅ Apply audio encoding if needed
		if (needAudioEncode) {
			// ✅ Volume adjustment for ALL audio streams using -filter:a
			if (userOptions.volume_level != 1) {
				audio_cmd_array.push('-filter:a', `volume=${userOptions.volume_level}`);
			}

			// Set audio codec
			audio_cmd_array.push('-c:a', isOpusOutput ? 'libopus' : 'aac');
			if (audioStreams.some(stream => stream.channels && stream.channels > 2)) {
				audio_cmd_array.push('-ac', '2');
			}
		}
	}

	if (userOptions.target_size && fileInfo.audioBitRate > 0) {
		audio_cmd_array.push('-b:a', 1024 * fileInfo.audioBitRate);
	}
	var hasAudio = true;
	if (userOptions.volume_level == 0 || audioStreams.length == 0) {
		hasAudio = false;
	}
	//----output_cmd_array------------------------------------------------------------------------------------------

	var filename = removeExtension(fileInfo.name) + '_' + getStringTime() + (userOptions.format_name == 'vp9' ? '.indb.webm' : '.indb.mp4');
	const formatMap = { h264: '.h264', h265: '.h265', vp9: '.ivf', av1: '.ivf' };

	if (needReencode == false) {
		var cmd_array = [
			{
				cmd: [].concat(control_cmd_array, input_cmd_array, video_cmd_array, audio_cmd_array, tagVideo, filename),
				title: 'Converting...'
			}
		]
	} else {

		if (1 > 0) {
			const fps = userOptions.fps > 0 ? userOptions.fps : fileInfo.fps;
			var extension = userOptions.format_name == 'vp9' ? '.webm' : '.mp4';
			var convert_cmd_array = [...control_cmd_array, ...input_cmd_array];
			convert_cmd_array = [...convert_cmd_array, ...video_cmd_array, 'outputVideo.indb' + formatMap[userOptions.format_name]];

			if (hasAudio) {
				convert_cmd_array = [...convert_cmd_array, ...audio_cmd_array, '-vn', 'outputAudio.indb' + extension];
			}

			var complete_cmd_array = [...control_cmd_array, '-r', fps, '-i', 'outputVideo.indb' + formatMap[userOptions.format_name]];
			if (hasAudio) {
				complete_cmd_array = [...complete_cmd_array, '-i', 'outputAudio.indb' + extension];
			}

			complete_cmd_array = [...complete_cmd_array, ...['-c', 'copy'], ...tagVideo, filename];

			var cmd_array = [

				{
					cmd: convert_cmd_array,
					title: 'Converting...'
				},
				{
					cmd: complete_cmd_array,
					title: 'Completing...'
				}
			]



		} else {

			var input_cmd_array2 = ['-an', ...input_cmd_array];
			var rawfile = 'tmp.indb' + formatMap[userOptions.format_name];
			var cmd_array1 = [].concat(control_cmd_array, input_cmd_array2, video_cmd_array, rawfile);

			input_cmd_array2 = ['-vn', ...input_cmd_array, '-i', rawfile];
			var cmd_array2 = [].concat(control_cmd_array, input_cmd_array2, ['-c:v', 'copy'], tagVideo, audio_cmd_array, filename);
			var cmd_array = [
				{
					cmd: cmd_array1,
					title: 'Converting...'
				},
				{
					cmd: cmd_array2,
					title: 'Merging...'
				}
			]
		}



	}



	settings = { ...settings, needReencode: needReencode, format_name: userOptions.format_name, width: outputWidth, height: outputHeight, duration: outputDuration, fps: (userOptions.fps > 0 ? userOptions.fps : fileInfo.fps), input_fps: fileInfo.fps, target_size: userOptions.target_size, output_filename: filename, input_filename: fileInfo.name, input_size: fileInfo.size, videoBitRate: userOptions.videoBitrate || 0 };
	return { command_list: cmd_array, settings: settings };
}