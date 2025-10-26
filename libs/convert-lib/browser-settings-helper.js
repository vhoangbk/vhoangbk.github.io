async function createRandomBitmap(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.random() * 256 | 0;
        data[i + 1] = Math.random() * 256 | 0;
        data[i + 2] = Math.random() * 256 | 0;
        data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return await createImageBitmap(canvas);
}

function generateStringHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

async function loadVideoEncoderSettings() {
    const idUserAgent = generateStringHash(navigator.userAgent) + '-settings-v3';
    const storedSetting = localStorage.getItem(idUserAgent);
    //if (storedSetting) return JSON.parse(storedSetting);

    const w = min_width, h = min_height, durationMs = 1000, fps = 15;
    const totalFrames = Math.floor(durationMs / (1000 / fps));
    const bitmapCount = 5;
    const bitmapStore = await Promise.all(
        Array.from({ length: bitmapCount }, () => createRandomBitmap(w, h))
    );

    async function buildAndConfigureEncoder(mimeCodec) {
        try {
            const videoEncoder = new VideoEncoder({
                output: chunk => {
                    if (count_output == 0 && chunk.type !== 'key') {
                        //trên 1 số thiết bị iPhone cũ, frame đầu tiên không phải keyframe nên bỏ qua
                        byteLengthTotal = Number.MAX_SAFE_INTEGER;
                    }
                    last_time_output = Date.now();
                    byteLengthTotal += chunk.byteLength;
                    count_output++;
                },
                error: error => console.log("onCodecError", error)
            });
            if (mimeCodec) {
                const init = { codec: mimeCodec, width: w, height: h, framerate: fps, bitrate: 10000 };
                const support = await VideoEncoder.isConfigSupported(init);
                if (support.supported) {
                    videoEncoder.configure(init);
                    videoEncoder.mime_code = mimeCodec;
                    return videoEncoder;
                }
            }
        } catch (e) { }
        return null;
    }

    async function drawFrame(progress, videoEncoder, index) {
        const videoFrame = new VideoFrame(bitmapStore[index % bitmapStore.length], { timestamp: durationMs * progress });
        videoEncoder.encode(videoFrame);
        videoFrame.close();
    }

    const settings = {};
    const codecIds = [27, 173, 226, 167];
    const codecNames = ['h264', 'h265', 'av1', 'vp9'];
    let indexImage = 0;

    for (let c = 0; c < codecIds.length; c++) {
        const codecName = codecNames[c];
        const profiles = Object.keys(all_codecs[codecName]);
        for (const profile of profiles) {
            let countTimeout = 0;
            for (let t = 0; t < Math.min(20, all_codecs[codecName][profile].length); t++) {
                byteLengthTotal = 0;
                count_output = 0;
                const mimeCodec = all_codecs[codecName][profile][t];
                const videoEncoder = await buildAndConfigureEncoder(mimeCodec);
                if (!videoEncoder) continue;

                last_time_output = Date.now();
                for (let i = 0; i < totalFrames; i++) {
                    await drawFrame(i / totalFrames, videoEncoder, indexImage++);
                    await new Promise(r => setTimeout(r, 1));
                }
                await withTimeout(videoEncoder.flush(), 500);

                if (byteLengthTotal > 0) {
                    if (videoEncoder.state != "closed")
                        videoEncoder.close();
                    const bpp = byteLengthTotal / (count_output * w * h);
                    if (bpp < 0.5) {
                        const settingItem = {
                            codec: profile,
                            bpp: dec(bpp, 4),
                            supported_resolution: await getResolutionsSupport(all_codecs[codecName][profile])
                        };
                        if (!settings[codecName]) settings[codecName] = {};
                        settings[codecName][profile] = settingItem;
                        break;
                    } else {
                        if (videoEncoder.state != "closed")
                            videoEncoder.close();
                        break;
                    }
                } else {
                    if (videoEncoder.state != "closed")
                        videoEncoder.close();
                    countTimeout++;
                    if (countTimeout > 2) break;
                }
            }
        }
    }

    localStorage.setItem(idUserAgent, JSON.stringify(settings));
    return settings;
}

async function getResolutionsSupport(mimeCodecList) {
    const landscapeRes = [[320, 240], [640, 480], [960, 540], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]];
    const portraitRes = [[240, 320], [480, 640], [540, 960], [720, 1280], [1080, 1920], [1440, 2560], [2160, 3840]];
    const supported = { landscape: [], portrait: [] };

    for (const [type, resList] of Object.entries({ landscape: landscapeRes, portrait: portraitRes })) {
        for (const dimension of resList) {
            for (const mimeCodec of mimeCodecList) {
                const config = { codec: mimeCodec, width: dimension[0], height: dimension[1] };
                const support = await VideoEncoder.isConfigSupported(config);
                if (support.supported) {
                    supported[type].push(dimension);
                    break;
                }
            }
        }
    }
    return supported;
}

function timeoutPromise(ms) {
    return new Promise(resolve => setTimeout(() => resolve('finish'), ms));
}

async function withTimeout(promise, ms) {
    return Promise.race([promise, timeoutPromise(ms)]);
}