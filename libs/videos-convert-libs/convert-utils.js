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

async function load_wasm_lib() {
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
        info.thumbnail = getNoThumbnailBase64();
      }
    } else {
      // Nếu không có thumbnail, dùng ảnh base64 nhỏ mặc định
      info.thumbnail = getNoThumbnailBase64();
    }

    return info;
  }
}

function getNoThumbnailBase64() {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#eee';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NO THUMBNAIL', canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL('image/png');
}

function sendCmd(cmd, value) {
  postMessage({
    cmd: cmd,
    value: value
  });
}