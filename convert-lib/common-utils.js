// Lấy filename và mimeType từ url
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


function getUrlLength(url) {
  if (typeof urlLengthStore === 'undefined') {
    urlLengthStore = {};
  }

  var originalUrl = url;

  // Decode URL if it's encoded (handle blob URLs)
  if (url.indexOf('blob%3A') == 0 || url.indexOf('http%3A') == 0 || url.indexOf('https%3A') == 0) {
    url = decodeURIComponent(url);
  }

  if (urlLengthStore[originalUrl]) {
    return urlLengthStore[originalUrl];
  }

  var method = url.indexOf('http') == 0 ? "HEAD" : "GET";
  var xhr = new XMLHttpRequest;
  var length = -1;
  xhr.open(method, url, false);
  if (method === 'GET') {
    xhr.setRequestHeader("Range", "bytes=" + 0 + "-" + 1);
  }

  xhr.send(null);
  if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
    throw new Error("Couldn't load " + url + ". Status: " + xhr.status);

  if (method === 'GET') {
    length = Number(xhr.getAllResponseHeaders().match(/\/(\d+)/i)[1]);
  } else {
    length = Number(xhr.getResponseHeader("Content-length"));
  }
  urlLengthStore[originalUrl] = length;
  return length;
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

function getDataFromUrlSync(url, from, to) {

  if (from > to)
    throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
  var xhr = new XMLHttpRequest;
  xhr.open("GET", url, false);
  xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  xhr.responseType = 'arraybuffer';
  xhr.send(null);
  if (xhr.status == 200 || xhr.status == 206) {
    return xhr.response;
  }
}

async function getVideoThumbnailBase64(file, seekTime = 1) {
  return new Promise((resolve, reject) => {
    const url = file instanceof File ? URL.createObjectURL(file) : file;
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.addEventListener('loadeddata', function () {
      // Seek đến thời điểm lấy thumbnail
      video.currentTime = Math.min(seekTime, video.duration - 0.1);
    });

    video.addEventListener('seeked', function () {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.6);
      if (file instanceof File) URL.revokeObjectURL(url);
      resolve(base64); // Trả về chuỗi base64
    });

    video.addEventListener('error', function () {
      //if (file instanceof File) URL.revokeObjectURL(url);
      reject('Cannot load video');
    });
  });
}

function concatTypedArrays(a, b) {
  var c = new (a.constructor)(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
};

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


function dec(fl, d = 2) {
  var p = Math.pow(10, d);
  return Math.round(fl * p) / p;
}



const extractInfo = async function (response, blob_url, thumbnail) {
  response = response.split('Stream mapping:');
  response = response[0];
  const regex = /Input #((?!Input #)[\S\s])*/g;
  const array = [...response.matchAll(regex)];

  if (array.length > 0) {
    var text = array[0][0];
    var info = {};
    info.mediaType = 'Audio';
    info.video_stream_index = -1;
    info.audio_stream_index = -1;
    info.streams = [];
    var filename_regex = (/from '([^']*)/g).exec(text);
    if (filename_regex) {
      info.filename = filename_regex[1];
    }


    var duration_regex = (/Duration: ([\d:\\.]+)/g).exec(text);
    if (duration_regex) {
      info.duration = duration_regex[1].split(':').reduce((acc, time) => (60 * acc) + +time);
    }

    var streams = [...text.matchAll(/Stream #((?!Stream #)[\S\s])*/g)];

    for (var j = 0; j < streams.length; j++) {
      var stream_text = streams[j][0];
      var stream_attr = {};
      var extracted_attr = (/(?<mediaType>(Video|Audio)):\s?(?<mediaCode>([a-zA-Z0-9_]*)).*(\s(?<fps>[\d\\.]{1,5}) fps|(\s(?<hz>\d{1,5}) Hz))/g).exec(stream_text);
      if (!extracted_attr) {
        continue;
      }
      stream_attr.mediaType = extracted_attr.groups.mediaType;
      stream_attr.mediaCode = extracted_attr.groups.mediaCode;

      if (extracted_attr.groups.fps) {
        stream_attr.fps = Number(extracted_attr.groups.fps);
        info.fps = stream_attr.fps;
      }

      if (extracted_attr.groups.hz) {
        stream_attr.hz = extracted_attr.groups.hz;
      }

      if (stream_attr.mediaType === 'Video') {
        var displaymatrix_attr = (/((displaymatrix: rotation of )(?<displaymatrix>.*)\sdegrees)/g).exec(stream_text);
        if (displaymatrix_attr) {
          info.rotation = Number(displaymatrix_attr[3]);
        }


        var size_attr = (/(\s(?<size>\d{1,4}x\d{1,4})[\s,])/g).exec(stream_text);
        if (size_attr) {
          stream_attr.width = Number(size_attr.groups.size.split('x')[0]);
          stream_attr.height = Number(size_attr.groups.size.split('x')[1]);
          info.width = stream_attr.width;
          info.height = stream_attr.height;
          info.mediaCode = stream_attr.mediaCode;

          //kiem tra neu video bi xoay
          if (info.rotation) {
            var tmp = Math.abs(info.rotation) / 90;
            if (tmp % 2 == 1) {
              info.width = stream_attr.height;
              info.height = stream_attr.width;
              stream_attr.width = info.width;
              stream_attr.height = info.height;
            }
          }
        }

        info.mediaType = 'Video';
        info.video_stream_index = j;
        if (stream_attr.mediaCode == 'mjpeg' || stream_attr.mediaCode == 'png' || stream_attr.mediaCode == 'gif' || stream_attr.mediaCode == 'webp') {
          info.mediaType = 'Image';
        }
      } else if (stream_attr.mediaType === 'Audio') {
        stream_attr.isStereo = stream_text.indexOf('stereo') > 0;
        info.audio_stream_index = j;
      }

      var bitrate_attr = (/(\s(?<bitrate>[\d\\.]{1,9}) kb\/s)/g).exec(stream_text);

      if (bitrate_attr) {
        stream_attr.bitrate = Number(bitrate_attr.groups.bitrate);
      } else {
        stream_attr.bitrate = -1;
      }
      info.streams.push(stream_attr);
    }

    var length = blob_url instanceof File ? blob_url.size : getUrlLength(decodeURIComponent(blob_url));
    info.length = length;
    info.lengthInMB = dec(length / (1024 * 1024), 2);
    info.blob_url = blob_url;
    if (thumbnail) {
      info.thumbnail = thumbnail;
    } else if (info.mediaCode == 'av1') {
      try {
        info.thumbnail = await getVideoThumbnailBase64(blob_url, 0);
        console.log('generate thumbnail for av1:', info.thumbnail);
      } catch (error) {
        console.log('error generate thumbnail for av1:', error);
        // Nếu lỗi, dùng ảnh base64 nhỏ mặc định
      }
    }
    return info;
  }
}

function sendCmd(cmd, value) {
  postMessage({
    cmd: cmd,
    value: value
  });
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let deviceType = /Mobi|Android/i.test(ua) ? 'Phone' : 'PC';

  let browser = 'Unknown';
  if (ua.indexOf("Chrome") > -1 && ua.indexOf("Edg") === -1 && ua.indexOf("OPR") === -1) {
    browser = "Chrome";
  } else if (ua.indexOf("Firefox") > -1) {
    browser = "Firefox";
  } else if (ua.indexOf("Safari") > -1 && ua.indexOf("Chrome") === -1) {
    browser = "Safari";
  } else if (ua.indexOf("Edg") > -1) {
    browser = "Edge";
  } else if (ua.indexOf("OPR") > -1 || ua.indexOf("Opera") > -1) {
    browser = "Opera";
  }

  let os = 'Unknown';
  if (ua.indexOf("Win") !== -1) {
    os = "Windows";
  } else if (ua.indexOf("Mac") !== -1) {
    os = "macOS";
  } else if (ua.indexOf("Linux") !== -1) {
    os = "Linux";
  } else if (ua.indexOf("Android") !== -1) {
    os = "Android";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
  }

  const memory = navigator.deviceMemory || 'Unknown';
  const cpuCores = navigator.hardwareConcurrency || 'Unknown';

  return {
    deviceType,
    browser,
    os,
    memory,
    cpuCores
  };
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


function getInputId(inputUrl) {
  if (inputUrl instanceof File) {
    return inputUrl.name;
  } else if (typeof FileSystemFileHandle !== 'undefined' && inputUrl instanceof FileSystemFileHandle) {
    return inputUrl.name;
  } else if (typeof inputUrl === 'string' || inputUrl instanceof String) {
    return inputUrl.toString();
  } else {
    return inputUrl;
  }
}


// Kiểm tra string là số (hợp lệ: số nguyên, số thực, số âm, số dương, không nhận NaN, Infinity)
function isNumber(str) {
    if (typeof str !== 'string') return false;
    // Loại bỏ khoảng trắng đầu cuối
    str = str.trim();
    if (str === '') return false;
    // Không nhận các giá trị đặc biệt
    if (str === 'NaN' || str === 'Infinity' || str === '-Infinity') return false;
    // Kiểm tra số hợp lệ
    return !isNaN(str) && isFinite(str);
}