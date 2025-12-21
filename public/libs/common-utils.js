
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

async function getBlobUrlOnLib(url) {
	if (typeof blobUrlMap === 'undefined') {
		blobUrlMap = {};
	}
	if (blobUrlMap[url]) {
		return blobUrlMap[url];
	}

	console.log('Fetching blob from URL:', url);
	const response = await fetch(url);
	const blob = await response.blob();
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

/**
 * ✅ Enhanced bitrate selection cho video encoding
 * Chọn bitrate tối ưu dựa vào codec, resolution, quality và framerate
 * @param {string} codec - 'av1', 'vp9', 'h264', 'h265'
 * @param {number} width - Video width
 * @param {number} height - Video height 
 * @param {string} quality - 'low', 'medium', 'high', 'ultra'
 * @param {number} fps - Frame rate (optional, default: 30)
 * @param {string} usage - 'streaming', 'storage', 'broadcast' (optional)
 * @returns {number} bitrate in bps (bits per second)
 */
function selectBitrateByCodec(codec, width, height, quality = 'medium', fps = 30, usage = 'streaming') {
	// Normalize inputs
	codec = (codec || 'h264').toLowerCase().trim();
	quality = (quality || 'medium').toLowerCase().trim();
	usage = (usage || 'streaming').toLowerCase().trim();

	width = Math.max(1, parseInt(width) || 640);
	height = Math.max(1, parseInt(height) || 480);
	fps = Math.max(1, Math.min(120, parseFloat(fps) || 30));

	// ✅ Comprehensive bitrate table per codec and resolution (kbps)
	const bitrateTable = {
		// H.264 - Most compatible, moderate efficiency
		h264: {
			resolutions: [
				{ width: 426, height: 240, bitrates: { low: 300, medium: 500, high: 800, ultra: 1200 } },
				{ width: 640, height: 360, bitrates: { low: 500, medium: 800, high: 1200, ultra: 1800 } },
				{ width: 854, height: 480, bitrates: { low: 800, medium: 1200, high: 2000, ultra: 3000 } },
				{ width: 1280, height: 720, bitrates: { low: 1500, medium: 2500, high: 4000, ultra: 6000 } },
				{ width: 1920, height: 1080, bitrates: { low: 3000, medium: 5000, high: 8000, ultra: 12000 } },
				{ width: 2560, height: 1440, bitrates: { low: 6000, medium: 9000, high: 14000, ultra: 20000 } },
				{ width: 3840, height: 2160, bitrates: { low: 12000, medium: 18000, high: 28000, ultra: 40000 } }
			]
		},

		// H.265/HEVC - 40-50% more efficient than H.264
		h265: {
			resolutions: [
				{ width: 426, height: 240, bitrates: { low: 200, medium: 350, high: 600, ultra: 900 } },
				{ width: 640, height: 360, bitrates: { low: 350, medium: 600, high: 900, ultra: 1400 } },
				{ width: 854, height: 480, bitrates: { low: 600, medium: 900, high: 1500, ultra: 2200 } },
				{ width: 1280, height: 720, bitrates: { low: 1000, medium: 1800, high: 3000, ultra: 4500 } },
				{ width: 1920, height: 1080, bitrates: { low: 2000, medium: 3500, high: 6000, ultra: 9000 } },
				{ width: 2560, height: 1440, bitrates: { low: 4000, medium: 6500, high: 10000, ultra: 15000 } },
				{ width: 3840, height: 2160, bitrates: { low: 8000, medium: 13000, high: 20000, ultra: 30000 } }
			]
		},

		// VP9 - Similar efficiency to H.265, good for web
		vp9: {
			resolutions: [
				{ width: 426, height: 240, bitrates: { low: 250, medium: 400, high: 650, ultra: 950 } },
				{ width: 640, height: 360, bitrates: { low: 400, medium: 650, high: 1000, ultra: 1500 } },
				{ width: 854, height: 480, bitrates: { low: 650, medium: 1000, high: 1600, ultra: 2400 } },
				{ width: 1280, height: 720, bitrates: { low: 1200, medium: 2000, high: 3200, ultra: 4800 } },
				{ width: 1920, height: 1080, bitrates: { low: 2200, medium: 4000, high: 6500, ultra: 9500 } },
				{ width: 2560, height: 1440, bitrates: { low: 4500, medium: 7000, high: 11000, ultra: 16000 } },
				{ width: 3840, height: 2160, bitrates: { low: 9000, medium: 14000, high: 22000, ultra: 32000 } }
			]
		},

		// AV1 - Most efficient, 30-50% better than H.265
		av1: {
			resolutions: [
				{ width: 426, height: 240, bitrates: { low: 150, medium: 250, high: 400, ultra: 600 } },
				{ width: 640, height: 360, bitrates: { low: 250, medium: 400, high: 650, ultra: 950 } },
				{ width: 854, height: 480, bitrates: { low: 400, medium: 650, high: 1000, ultra: 1500 } },
				{ width: 1280, height: 720, bitrates: { low: 750, medium: 1200, high: 2000, ultra: 3000 } },
				{ width: 1920, height: 1080, bitrates: { low: 1500, medium: 2500, high: 4000, ultra: 6000 } },
				{ width: 2560, height: 1440, bitrates: { low: 3000, medium: 4500, high: 7000, ultra: 10500 } },
				{ width: 3840, height: 2160, bitrates: { low: 6000, medium: 9000, high: 14000, ultra: 21000 } }
			]
		}
	};

	// ✅ Usage multipliers for different scenarios
	const usageMultipliers = {
		streaming: 1.0,      // Standard for streaming platforms
		storage: 0.8,        // Lower bitrate for local storage
		broadcast: 1.3,      // Higher quality for broadcasting
		archive: 0.6,        // Very compressed for long-term storage
		mobile: 0.7          // Optimized for mobile viewing
	};

	// ✅ Frame rate multipliers
	const fpsMultipliers = {
		24: 0.9,    // Cinema standard
		25: 0.92,   // PAL standard  
		30: 1.0,    // Base multiplier
		48: 1.4,    // High frame rate cinema
		50: 1.45,   // High frame rate PAL
		60: 1.5,    // High frame rate NTSC
		120: 2.0    // Very high frame rate
	};

	// Get codec table (fallback to H.264 if not found)
	const codecData = bitrateTable[codec] || bitrateTable.h264;

	// ✅ Find best matching resolution
	let selectedBitrate = 1000; // Default fallback
	let bestMatch = null;
	let minPixelDiff = Infinity;

	const targetPixels = width * height;

	for (const resolution of codecData.resolutions) {
		const resPixels = resolution.width * resolution.height;
		const pixelDiff = Math.abs(targetPixels - resPixels);

		if (pixelDiff < minPixelDiff) {
			minPixelDiff = pixelDiff;
			bestMatch = resolution;
		}
	}

	// ✅ Get base bitrate from quality level
	if (bestMatch) {
		selectedBitrate = bestMatch.bitrates[quality] || bestMatch.bitrates.medium;

		// ✅ Scale bitrate if resolution doesn't exactly match
		if (targetPixels !== bestMatch.width * bestMatch.height) {
			const scaleFactor = Math.sqrt(targetPixels / (bestMatch.width * bestMatch.height));
			selectedBitrate *= scaleFactor;
		}
	}

	// ✅ Apply frame rate multiplier
	const fpsMultiplier = fpsMultipliers[fps] ||
		(fps <= 30 ? 1.0 : Math.min(2.0, fps / 30));
	selectedBitrate *= fpsMultiplier;

	// ✅ Apply usage multiplier
	const usageMultiplier = usageMultipliers[usage] || 1.0;
	selectedBitrate *= usageMultiplier;

	// ✅ Apply resolution-based fine-tuning
	const aspectRatio = width / height;
	if (aspectRatio > 2.0) {
		// Ultra-wide content needs more bitrate
		selectedBitrate *= 1.2;
	} else if (aspectRatio < 0.8) {
		// Portrait content can use less bitrate
		selectedBitrate *= 0.9;
	}

	// ✅ Ensure reasonable bounds
	const minBitrate = 100;  // 100 kbps minimum
	const maxBitrate = Math.min(100000, targetPixels * 0.1); // Max based on pixel count

	selectedBitrate = Math.max(minBitrate, Math.min(maxBitrate, selectedBitrate));

	// ✅ Convert to bps and round
	const bitrateInBps = Math.round(selectedBitrate * 1024);

	// ✅ Debug logging (only if console enabled)
	if (typeof CONSOLE_ENABLE !== 'undefined' && CONSOLE_ENABLE > 0) {
		console.log(`🎯 Bitrate Selection:`, {
			codec,
			resolution: `${width}x${height}`,
			quality,
			fps,
			usage,
			selectedBitrate: `${selectedBitrate} kbps`,
			bitrateInBps: `${bitrateInBps} bps`,
			bestMatch: bestMatch ? `${bestMatch.width}x${bestMatch.height}` : 'none'
		});
	}

	return bitrateInBps;
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
		if (typeof obj.target_size !== 'number' || obj.target_size < 1 || obj.target_size > 1900) return 'đầu target_size không hợp lệ';
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

// ffmpeg -i /Users/hung/video-test/lv_0_20250730144936.mp4 -an \
//   -filter_complex "
//     [0:v]trim=start=0:duration=2,setpts=PTS-STARTPTS[v1];
//     [0:v]trim=start=19:duration=2,setpts=PTS-STARTPTS[v2];
//     [0:v]trim=start=28:duration=2,setpts=PTS-STARTPTS[v3];
//     [v1][v2][v3]concat=n=3:v=1[outv]
//   " \
//   -map "[outv]" -s 400x400 output.mp4

async function convertUserOptionsToCommand(userOptions, checkBitrate = false, bitrateScale = 1.0) {

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
	var settings = {};
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
		var targetConfig = await findBestVideoEncoderConfigForTargetBitrate(userOptions.format_name, userOptions.crop?.width || fileInfo.width, userOptions.crop?.height || fileInfo.height, videoBitRateNew * bitrateScale);
		if (!targetConfig) {
			return { command: null, settings: null };
		}
		userOptions.fps = targetConfig.framerate;
		userOptions.resolution = { width: targetConfig.width, height: targetConfig.height };
		userOptions.videoBitrate = (0.9 * targetConfig.bitrate) & ~0; // Giảm 10% để có khoảng trống cho audio và biến động bitrate
	}

	var cmd_array = ['-loglevel', 'info', '-stats_period', 2, '-progress', '-', '-nostats'];
	var startTime = getStartTime();
	var endTime = getEndTime();


	if (checkBitrate == true) {
		if (outputDuration <= 4) {

			cmd_array.push('-ss', startTime);
			cmd_array.push('-r', fileInfo.fps);
			cmd_array.push('-i', userOptions.input_url);

			cmd_array.push('-filter_complex', `[0:v]trim=duration=${outputDuration},setpts=PTS-STARTPTS[outv]`);
			cmd_array.push('-map', `[outv]`);
		} else {
			const segmentDuration = 2;
			cmd_array.push('-ss', startTime + 1);
			cmd_array.push('-r', fileInfo.fps);
			cmd_array.push('-i', userOptions.input_url);

			cmd_array.push('-ss', (startTime + outputDuration / 2 - segmentDuration / 2) & ~0);
			cmd_array.push('-r', fileInfo.fps);
			cmd_array.push('-i', userOptions.input_url);

			cmd_array.push('-ss', (startTime + outputDuration - segmentDuration - 1) & ~0);
			cmd_array.push('-r', fileInfo.fps);
			cmd_array.push('-i', userOptions.input_url);


			cmd_array.push('-filter_complex', `[0:v]trim=duration=${segmentDuration},setpts=PTS-STARTPTS[v1];[1:v]trim=duration=${segmentDuration},setpts=PTS-STARTPTS[v2];[2:v]trim=duration=${segmentDuration},setpts=PTS-STARTPTS[v3];[v1][v2][v3]concat=n=3:v=1[outv]`);
			cmd_array.push('-map', `[outv]`);
		}

	} else {
		startTime > 0 && cmd_array.push('-ss', startTime);
		endTime > 0 && cmd_array.push('-to', endTime);
		cmd_array.push('-r', fileInfo.fps);
		cmd_array.push('-i', userOptions.input_url);
	}

	cmd_array.push('-c:v', libNameMap[userOptions.format_name] || 'libx264');

	getVF().length > 0 && cmd_array.push('-vf', getVF());

	//config audio

	const audioStream = fileInfo.streams.find(s => s.type === 'Audio');
	const isVP9 = userOptions.format_name === 'vp9';
	const isOpusOutput = isVP9; // VP9 typically uses Opus audio

	if (audioStream) {
		// ✅ Handle multi-channel audio
		if (audioStream.channels && audioStream.channels > 2) {
			console.log(`⚠️ Multi-channel audio detected (${audioStream.channels} channels)`);

			if (isOpusOutput) {
				// ✅ Opus: Downmix to stereo
				console.log('→ Downmixing to stereo for Opus compatibility');
				audioFilters.push('pan=stereo|FL<FC+0.30*FL+0.30*BL|FR<FC+0.30*FR+0.30*BR');
				cmd_array.push('-ac', '2'); // Force stereo
			} else {
				// ✅ Other codecs: Can keep multi-channel
				// But force channel layout for safety
				cmd_array.push('-channel_layout', 'stereo');
				cmd_array.push('-ac', '2');
			}
		}

		// ✅ Handle unsupported layouts (5.1(side), etc.)
		if (isOpusOutput) {
			// Force stereo for Opus
			cmd_array.push('-ac', '2');
		}
	}

	if (userOptions.volume_level != 1) {
		cmd_array.push('-af', `volume=${userOptions.volume_level}`);
	}


	var outputWidth = userOptions.resolution?.width || userOptions.crop?.width || fileInfo.width;
	var outputHeight = userOptions.resolution?.height || userOptions.crop?.height || fileInfo.height;

	var needReencode = false;
	needReencode = needReencode || (userOptions.format_name && userOptions.format_name !== fileInfo.videoCodec);
	needReencode = needReencode || (userOptions.fps != -1 && userOptions.fps !== fileInfo.fps);
	needReencode = needReencode || (getVF().length > 0);
	needReencode = needReencode || (fileInfo.width !== outputWidth || fileInfo.height !== outputHeight);
	needReencode = needReencode || (userOptions.quality != null);

	if (needReencode && !userOptions.target_size) {
		var outputConfig = await findBestVideoEncoderConfigForTargetBitrate(userOptions.format_name, outputWidth, outputHeight, 0, userOptions.fps > 0 ? userOptions.fps : fileInfo.fps);
		outputWidth = outputConfig.width;
		outputHeight = outputConfig.height;
	}

	if (userOptions.videoBitrate) {
		cmd_array.push('-b:v', dec(userOptions.videoBitrate, 0));
	} else if (userOptions.quality) {
		if ((userOptions.format_name === 'av1' || userOptions.format_name === 'vp9') && is_safari == false) {
			settings.quantizer = getQuantizerForQuality(userOptions.format_name, userOptions.quality.toLowerCase());
		} else {
			cmd_array.push('-b:v', selectBitrateByCodec(userOptions.format_name, outputWidth, outputHeight, userOptions.quality.toLowerCase()));
		}
	}

	if (needReencode) {
		cmd_array.push('-r', userOptions.fps > 0 ? userOptions.fps : fileInfo.fps);
		cmd_array.push('-vsync', '2'); //always
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

	if (userOptions.target_size && fileInfo.audioBitRate > 0) {
		cmd_array.push('-b:a', 1024 * fileInfo.audioBitRate);
	}

	var filename = fileInfo.name || 'converted_video';
	filename = removeExtension(filename) + '-' + getStringTime() + (userOptions.format_name == 'vp9' ? '.webm' : '.mp4');
	cmd_array.push(filename);

	settings = { ...settings, needReencode: needReencode, format_name: userOptions.format_name, width: outputWidth, height: outputHeight, duration: outputDuration, fps: (userOptions.fps > 0 ? userOptions.fps : fileInfo.fps), target_size: userOptions.target_size, output_filename: filename, input_filename: fileInfo.name, input_size: fileInfo.size, videoBitRate: userOptions.videoBitrate || 0 };
	return { command: cmd_array, settings: settings };
}



