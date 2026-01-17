const REFERENCE_BPP_VALUES = {
    h264: {
        low: { bpp: 0.075 },
        medium: { bpp: 0.100 },
        high: { bpp: 0.130 },
        ultra: { bpp: 0.160 }
    },
    h265: {
        low: { bpp: 0.050 },
        medium: { bpp: 0.070 },
        high: { bpp: 0.090 },
        ultra: { bpp: 0.120 }
    },
    av1: {
        low: { bpp: 0.040 },
        medium: { bpp: 0.055 },
        high: { bpp: 0.070 },
        ultra: { bpp: 0.090 }
    },
    vp9: {
        low: { bpp: 0.055 },
        medium: { bpp: 0.075 },
        high: { bpp: 0.095 },
        ultra: { bpp: 0.110 }
    }
};
//khi width*height càng lớn thì bpp càng nhỏ.
//khi xét bpp min thì cần x2, còn xét bpp max thì cần x0.5.
var width = 1280 / 2;
var height = 720 / 2;
var fps = 30;
var totalTime = 0;
count_encode = 0;
var frameStore = [];


class VideoGenerator {
    constructor() {
        this.encoder = null;
        this.chunks = [];
        this.frameCount = 0;
        this.startTime = 0;
    }

    async generate(encoderConfig) {
        // debugger;
        this.chunks = [];
        this.frameCount = 0;
        this.startTime = performance.now();
        if (frameStore.length == 0) {
            for (let i = 0; i < 60; i++) {
                const frame = await this.createFrame(i, width, height, fps, 'plasma');
                frameStore.push(frame);
            }
        }

        const duration = 4;

        const bitrate = encoderConfig.bitrate;
        const pattern = 'gradient';// 'gradient', 'plasma', 'random'


        // Check support
        const support = await VideoEncoder.isConfigSupported(encoderConfig);
        if (!support.supported) {
            throw new Error(`Codec ${encoderConfig.codec} not supported on this device`);
        }

        //console.log('✅ Encoder config supported:', encoderConfig);

        // Create encoder
        this.encoder = new VideoEncoder({
            output: (chunk) => {
                this.chunks.push(chunk);
            },
            error: (error) => {
                console.error('❌ Encoder error:', error);
                throw error;
            }
        });

        this.encoder.configure(encoderConfig);

        // Generate frames
        const totalFrames = fps * duration;
        const frameDuration = 1000000 / fps; // microseconds

        for (let i = 0; i < totalFrames; i++) {
            var t = Date.now();

            const frame2 = frameStore[i % frameStore.length];

            const frame = new VideoFrame(frame2, {
                timestamp: i * frameDuration,
                duration: frameDuration
            });

            //frame.timestamp = i * frameDuration;
            const isKeyFrame = (i % fps === 0); // Keyframe every second
            var count_loop = 0;
            while (this.encoder.encodeQueueSize > 2) {
                await new Promise(resolve => setTimeout(resolve, 1));
                count_loop++;
                if (count_loop > 1000) {
                    console.warn('⚠️ Encoder queue is full for too long, breaking loop', this.encoder.encodeQueueSize);
                    break;
                }
            }

            count_encode++;
            this.encoder.encode(frame, {
                keyFrame: isKeyFrame,
                duration: frameDuration
            });

            frame.close();
            this.frameCount++;
        }

        // Flush encoder
        await this.encoder.flush();
        this.encoder.close();


        // Calculate stats
        const totalBytes = this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const actualBitrate = (totalBytes * 8) / duration;
        const ratioBitrate = bitrate / actualBitrate;
        const bpp = actualBitrate / (width * height * fps);


        return { ratioBitrate, bpp };
    }

    async createFrame(frameIndex, width, height, fps, pattern) {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');

        this.drawPattern(ctx, frameIndex, width, height, fps, pattern);

        const bitmap = canvas.transferToImageBitmap();
        const timestamp = frameIndex * (1000000 / fps); // microseconds

        return new VideoFrame(bitmap, {
            timestamp: timestamp,
            duration: 1000000 / fps
        });
    }

    drawPattern(ctx, frameIndex, width, height, fps, pattern) {
        const time = frameIndex / fps;

        switch (pattern) {
            case 'gradient':
                this.drawGradient(ctx, width, height, time);
                break;
            case 'plasma':
                this.drawPlasma(ctx, width, height, time);
                break;
            case 'random':
                this.drawRandom(ctx, width, height, time);
                break;

        }
    }

    drawGradient(ctx, width, height, time) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        const hue1 = (time * 30) % 360;
        const hue2 = (time * 30 + 180) % 360;
        gradient.addColorStop(0, `hsl(${hue1}, 70%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue2}, 70%, 50%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    drawPlasma(ctx, width, height, time) {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const value = Math.sin(x / 16.0 + time) +
                    Math.sin(y / 8.0 + time) +
                    Math.sin((x + y) / 16.0 + time) +
                    Math.sin(Math.sqrt(x * x + y * y) / 8.0 + time);

                const color = Math.floor((value + 4) * 32);
                data[idx] = color;
                data[idx + 1] = color * 1.5;
                data[idx + 2] = color * 2;
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }


    drawRandom(ctx, width, height, time) {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        // Seed based on time for consistent randomness per frame
        let seed = Math.floor(time * 1000);

        // Simple pseudo-random function (seeded)
        const random = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                data[idx] = Math.floor(random() * 256);      // R
                data[idx + 1] = Math.floor(random() * 256);  // G
                data[idx + 2] = Math.floor(random() * 256);  // B
                data[idx + 3] = 255;                         // A
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }





}

async function loadVideoEncoderSettings() {

    const settings = {};

    const codecLists = {
        27: [ // H.264 - High > Main > Baseline
            'avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.640028', 'avc1.64001f',
            'avc1.4d0034', 'avc1.4d0033', 'avc1.4d0032', 'avc1.4d0028', 'avc1.4d001f',
            'avc1.42E034', 'avc1.42E028', 'avc1.42E01E'
        ],
        173: [ // H.265
            'hev1.1.6.L186.B0', 'hev1.1.6.L183.B0', 'hev1.1.6.L180.B0',
            'hev1.1.6.L156.B0', 'hev1.1.6.L153.B0', 'hev1.1.6.L150.B0',
            'hev1.1.6.L120.B0', 'hev1.1.6.L93.B0',
            'hvc1.1.6.L186.B0', 'hvc1.1.6.L183.B0', 'hvc1.1.6.L180.B0',
            'hvc1.1.6.L156.B0', 'hvc1.1.6.L153.B0', 'hvc1.1.6.L150.B0',
            'hvc1.1.6.L120.B0', 'hvc1.1.6.L93.B0'
        ],
        226: [ // AV1
            'av01.0.13M.08', 'av01.0.12M.08', 'av01.0.09M.08',
            'av01.0.08M.08', 'av01.0.05M.08', 'av01.0.04M.08'
        ],
        167: [ // VP9
            'vp09.00.51.08', 'vp09.00.50.08', 'vp09.00.41.08',
            'vp09.00.40.08', 'vp09.00.31.08', 'vp09.00.21.08', 'vp09.00.10.08'
        ]
    };

    const codecIds = [27, 173, 226, 167];
    const codecNames = ['h264', 'h265', 'av1', 'vp9'];

    // const codecIds = [27];
    // const codecNames = ['h264'];

    const hardwareAccelerationMethods = ['prefer-hardware', 'prefer-software'];
    const bitrateModes = ['constant', 'variable'];
    const bitrateQualities = ['max', 'min'];
    const latencyModes = ['quality'];

    for (const codecId of codecIds) {
        var codecName = codecNames[codecIds.indexOf(codecId)];
        var time = Date.now();
        const codecList = codecLists[codecId];
        var configList = [];
        for (const hardwareAcceleration of hardwareAccelerationMethods) {
            if (codecId == 27 && hardwareAcceleration == 'prefer-software') {
                continue;
            }

            if (codecId == 173 && hardwareAcceleration == 'prefer-software') {
                continue;
            }
            var supportedBitrateMode = '';
            for (const bitrateMode of bitrateModes) {

                if ((codecId == 226 || codecId == 167) && supportedBitrateMode == 'constant') {
                    continue;
                }

                for (const latencyMode of latencyModes) {

                    var config = {
                        codecName: codecName,
                        width: width,
                        height: height,
                        framerate: fps,
                        hardwareAcceleration: hardwareAcceleration,
                        bitrateMode: bitrateMode,
                        latencyMode: latencyMode
                    };

                    for (const bitrateQuality of bitrateQualities) {
                        var bitrate_array = [];
                        for (i = 50; i > 0; i--) {
                            bitrate_array.push(width * height * fps * 0.01 * i);
                        }
                        var bitrates = bitrateQuality == 'min' ? [width * height * fps * 0.001] : bitrate_array;

                        for (const codecString of codecList) {
                            config.codec = codecString;
                            var is_break = false;
                            for (const bitrate of bitrates) {
                                config.bitrate = bitrate;
                                try {
                                    const support = await VideoEncoder.isConfigSupported(config);
                                    if (!support.supported) {
                                        continue;
                                    }
                                    supportedBitrateMode = bitrateMode;
                                    const generator = new VideoGenerator();
                                    const { ratioBitrate, bpp } = await generator.generate(config);



                                    //khi xét bpp min thì cần x2, còn xét bpp max thì cần x0.5.
                                    if (bitrateQuality == 'min') {
                                        config.min_bpp = bpp;
                                    } else {
                                        config.max_bpp = bpp;
                                    }
                                    is_break = true;
                                    break;

                                } catch (error) {
                                    console.warn(`⚠️ Error testing hardware  ${error.message}`);
                                    continue;
                                }

                            }
                            if (is_break) {
                                break;
                            }


                        }

                    }

                    if (config.min_bpp) {
                        config.bpp = (config.min_bpp + config.max_bpp) / 2;
                        configList.push(config);
                        console.log('config123:', configList);
                    }

                }
            }
        }

        console.log(`⚙️ Configs for codec ${codecId}:`, configList);
        configList.sort(function (a, b) {
            const scoreFn = (config) => {
                let score = 0;
                //h265 với bitrateMode = variable sẽ chính xác hơn constant.
                if (config.codecName == 'h265') {
                    score += config.bitrateMode == 'constant' ? 100 : 150;
                } else {
                    score += config.bitrateMode == 'constant' ? 110 : 100;
                }

                score += config.hardwareAcceleration === 'prefer-hardware' ? 1000 : 500;
                score += config.bpp * 1000;
                return score; // Higher score is better
            }
            return scoreFn(b) - scoreFn(a);
        });

        if (configList.length > 0) {
            var config = configList[0];
            config.supported_resolution = await getResolutionsSupport(codecLists[codecId]);
            settings[codecName] = config;
        }
        console.log(`⏱️ Time for codec ${codecId}: ${(Date.now() - time)}`);
    }

    for (frame in frameStore) {
        frameStore[frame].close();
    }

    postMessage({ cmd: 'init-browser-ready', settings: settings });
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


/**
 * Kiểm tra max WebAssembly.Memory mà thiết bị hỗ trợ
 * @returns {number} - Max memory in MB
 */
function checkMaxWebAssemblyMemory() {
    let maxPages = 0;
    let low = 1, high = 32768; // Test up to 2GB

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        try {
            new WebAssembly.Memory({ initial: mid, maximum: mid });
            maxPages = mid;
            low = mid + 1;
        } catch (e) {
            high = mid - 1;
        }
    }

    const maxMemoryMB = Math.round(maxPages * 64 / 1024);
    console.log(`📊 Max WebAssembly Memory: ${maxMemoryMB}MB`);
    return maxMemoryMB;
}


/**
 * ✅ Tìm bitrate tối ưu dựa vào width, height, fps, codecId và quality
 * Gộp tất cả logic từ calculateOptimalBitrate, selectBitrateByCodec và REFERENCE_BPP_VALUES
 * 
 * @param {number} width - Video width (pixels)
 * @param {number} height - Video height (pixels)
 * @param {number} fps - Frame rate (default: 30)
 * @param {number|string} codecId - Codec ID: 27/h264, 173/h265, 226/av1, 167/vp9
 * @param {string} quality - Quality level: 'low', 'medium', 'high', 'ultra' (default: 'medium')
 * @returns {number} Bitrate in bps (bits per second)
 * 
 * @example
 * // H.264 1080p @ 30fps, medium quality
 * const bitrate = findOptimalBitrate(1920, 1080, 30, 27, 'medium');
 * // → ~5,184,000 bps (5.18Mbps)
 * 
 * @example
 * // AV1 4K @ 60fps, high quality (using string codec)
 * const bitrate = findOptimalBitrate(3840, 2160, 60, 'av1', 'high');
 * // → ~24,883,200 bps (24.88Mbps)
 */
function findOptimalBitrate(width, height, fps = 30, codecId = 27, quality = 'medium') {
    // ✅ Validate inputs
    if (!width || !height || width <= 0 || height <= 0) {
        console.error('❌ Invalid width/height:', { width, height });
        return 1000000; // 1Mbps fallback
    }

    if (!fps || fps <= 0) {
        console.error('❌ Invalid fps:', fps);
        fps = 30;
    }

    // ✅ Convert codecId to string format
    const codecIdMap = {
        27: 'h264',
        173: 'h265',
        226: 'av1',
        167: 'vp9'
    };

    let codecName = typeof codecId === 'string'
        ? codecId.toLowerCase()
        : codecIdMap[codecId];

    if (!codecName || !REFERENCE_BPP_VALUES[codecName]) {
        console.error('❌ Unsupported codec:', codecId);
        codecName = 'h264'; // Fallback to H.264
    }

    // ✅ Normalize quality
    quality = quality.toLowerCase();
    if (!REFERENCE_BPP_VALUES[codecName][quality]) {
        console.warn(`⚠️ Invalid quality "${quality}", using "medium"`);
        quality = 'medium';
    }

    // ✅ Get base BPP from REFERENCE_BPP_VALUES
    const baseBpp = REFERENCE_BPP_VALUES[codecName][quality].bpp;

    const pixels = width * height;

    // ✅ Calculate BPP adjusted for resolution
    let adjustedBpp;

    if (typeof self !== 'undefined' && self.browser_settings && self.browser_settings[codecName]) {
        // Use browser_settings if available (more accurate)
        adjustedBpp = calculateBppSimple(
            self.browser_settings[codecName].width,
            self.browser_settings[codecName].height,
            self.browser_settings[codecName].bpp,
            width,
            height
        );

        // Apply quality multiplier
        if (quality === 'low') {
            adjustedBpp *= 0.75;
        } else if (quality === 'high') {
            adjustedBpp *= 1.35;
        } else if (quality === 'ultra') {
            adjustedBpp *= 2.0;
        }
    } else {
        // Fallback: Manual BPP adjustment based on resolution
        // Resolution efficiency factor (BPP decreases as resolution increases)
        let resolutionFactor = 1.0;

        if (pixels >= 7680 * 4320) {        // 8K
            resolutionFactor = 0.8;
        } else if (pixels >= 3840 * 2160) { // 4K
            resolutionFactor = 0.85;
        } else if (pixels >= 2560 * 1440) { // 1440p
            resolutionFactor = 0.9;
        } else if (pixels >= 1920 * 1080) { // 1080p
            resolutionFactor = 1.0;         // Baseline
        } else if (pixels >= 1280 * 720) {  // 720p
            resolutionFactor = 1.1;
        } else if (pixels >= 854 * 480) {   // 480p
            resolutionFactor = 1.2;
        } else {                             // 360p and below
            resolutionFactor = 1.3;
        }

        adjustedBpp = baseBpp * resolutionFactor;
    }

    // ✅ FPS scaling factor (non-linear)
    // fps 60 không cần gấp đôi bitrate so với fps 30
    const fpsMultiplier = Math.pow(fps / 30, 0.8);

    // ✅ Calculate bitrate
    const bitrate = pixels * fps * adjustedBpp * fpsMultiplier;

    // ✅ Apply min/max bounds
    const minBitrate = 100000;     // 100kbps
    const maxBitrate = 1000000000; // 1Gbps

    // ✅ Hardware limits per resolution
    const hardwareLimits = [
        [7680 * 4320, 500000000],  // 8K: 500Mbps max
        [3840 * 2160, 150000000],  // 4K: 150Mbps max
        [2560 * 1440, 50000000],   // 1440p: 50Mbps max
        [1920 * 1080, 25000000],   // 1080p: 25Mbps max
        [1280 * 720, 15000000],    // 720p: 15Mbps max
        [854 * 480, 8000000],      // 480p: 8Mbps max
        [640 * 360, 5000000],      // 360p: 5Mbps max
        [0, 3000000]               // Lower: 3Mbps max
    ];

    let hardwareLimit = maxBitrate;
    for (const [resPixels, limit] of hardwareLimits) {
        if (pixels >= resPixels) {
            hardwareLimit = limit;
            break;
        }
    }

    const finalBitrate = Math.max(minBitrate, Math.min(hardwareLimit, Math.round(bitrate)));

    return finalBitrate;
}

loadVideoEncoderSettings();