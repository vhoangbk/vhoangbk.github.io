
const REFERENCE_BPP_VALUES = {
    // H.264 (baseline)
    h264: {
        low: { bpp: 0.075, quality: 'Low' },
        medium: { bpp: 0.100, quality: 'Medium' },    // ← Most common
        high: { bpp: 0.135, quality: 'High' },
        ultra: { bpp: 0.200, quality: 'Ultra' }
    },
    // H.265 (HEVC)
    h265: {
        low: { bpp: 0.050, quality: 'Low' },
        medium: { bpp: 0.070, quality: 'Medium' },    // ← Most common
        high: { bpp: 0.095, quality: 'High' },
        ultra: { bpp: 0.140, quality: 'Ultra' }
    },
    // VP9
    vp9: {
        low: { bpp: 0.055, quality: 'Low' },
        medium: { bpp: 0.075, quality: 'Medium' },    // ← Most common
        high: { bpp: 0.100, quality: 'High' },
        ultra: { bpp: 0.145, quality: 'Ultra' }
    },
    // AV1
    av1: {
        low: { bpp: 0.040, quality: 'Low' },
        medium: { bpp: 0.055, quality: 'Medium' },    // ← Most common
        high: { bpp: 0.075, quality: 'High' },
        ultra: { bpp: 0.110, quality: 'Ultra' }
    }
};

/**
 * ✅ TEST THỰC TẾ: Decode keyframe chunk để lấy format + resolution
 * @param {Object} config - VideoDecoder config
 * @param {EncodedVideoChunk} keyframeChunk - Keyframe chunk
 * @returns {Promise<Object|null>} - {format, actualWidth, actualHeight}
 */
async function testDecoderWithKeyframeChunk(config, keyframeChunk) {
    return new Promise((resolve, reject) => {
        let decoder = null;
        let resolved = false; // ✅ Track nếu đã resolve

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                if (decoder?.state !== 'closed') {
                    decoder?.close();
                }
                reject(new Error('Decode timeout'));
            }
        }, 3000); // 3 giây timeout

        try {
            decoder = new VideoDecoder({
                output: (frame) => {
                    if (resolved) {
                        frame.close();
                        return; // ✅ Bỏ qua nếu đã resolve
                    }

                    // ✅ Lấy format + resolution từ frame thực tế
                    const result = {
                        format: frame.format,
                        actualWidth: frame.codedWidth || frame.displayWidth,
                        actualHeight: frame.codedHeight || frame.displayHeight
                    };

                    frame.close();
                    clearTimeout(timeout);
                    resolved = true;

                    // ✅ Close decoder sau khi resolve (trong microtask để tránh race)
                    Promise.resolve().then(() => {
                        if (decoder?.state !== 'closed') {
                            decoder.close();
                        }
                    });

                    resolve(result);
                },
                error: (e) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        if (decoder?.state !== 'closed') {
                            decoder?.close();
                        }
                        reject(e);
                    }
                }
            });

            decoder.configure(config);

            // ✅ Decode keyframe chunk trực tiếp
            decoder.decode(keyframeChunk);

            // ✅ Flush async để tránh close() interrupt
            decoder.flush().catch(e => {
                // ✅ Bỏ qua lỗi flush nếu đã resolved (decoder đã close)
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(e);
                }
            });

        } catch (e) {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                if (decoder?.state !== 'closed') {
                    decoder?.close();
                }
                reject(e);
            }
        }
    });
}




/**
 * Tính bitrate tối ưu dựa trên resolution, fps và codec
 * @param {number} width
 * @param {number} height
 * @param {number} fps
 * @param {number} codecId
 * @returns {number} Bitrate in bps
 */
function calculateOptimalBitrate(width, height, fps, codecId) {
    const pixelsPerSecond = width * height * fps;

    // Bits per pixel cho quality tốt
    const bitsPerPixelBase = 0.15; // Medium quality baseline

    // Codec efficiency factors
    const codecFactors = {
        27: 1.0,   // H.264
        173: 0.7,  // H.265 (30% more efficient)
        226: 0.6,  // AV1 (40% more efficient)
        167: 0.75  // VP9 (25% more efficient)
    };

    const codecFactor = codecFactors[codecId] || 1.0;

    // Resolution scaling factor (higher res = lower bpp needed)
    let resolutionFactor = 1.0;
    const pixels = width * height;
    if (pixels >= 3840 * 2160) { // 4K+
        resolutionFactor = 0.8;
    } else if (pixels >= 1920 * 1080) { // 1080p
        resolutionFactor = 0.9;
    } else if (pixels <= 640 * 360) { // 360p
        resolutionFactor = 1.2;
    }

    const bitrate = pixelsPerSecond * bitsPerPixelBase * codecFactor * resolutionFactor;

    // Clamp bitrate to reasonable ranges
    const minBitrate = 100000; // 100kbps minimum
    const maxBitrate = 100000000; // 100Mbps maximum

    return Math.max(minBitrate, Math.min(maxBitrate, Math.round(bitrate)));
}

/**
 * Tìm max bitrate tối đa theo width, height và fps
 * ✅ Tự động tính toán dựa trên độ phân giải và frame rate
 * ✅ Hỗ trợ từ 360p đến 8K với fps từ 15-120
 * ✅ Tối ưu theo chuẩn streaming và hardware limits
 * 
 * @param {number} width - Video width (pixels)
 * @param {number} height - Video height (pixels)
 * @param {number} fps - Frame rate (fps)
 * @param {number} [codecId=27] - Codec ID (27: H.264, 173: H.265, 226: AV1, 167: VP9)
 * @returns {number} Maximum bitrate in bps
 */
function findMaxBitrate(width, height, fps, codecId = 27) {
    // ✅ Validate inputs
    if (!width || !height || !fps || width <= 0 || height <= 0 || fps <= 0) {
        console.error('❌ Invalid input parameters:', { width, height, fps });
        return 1000000; // 1Mbps fallback
    }

    const pixels = width * height;
    const pixelsPerSecond = pixels * fps;

    // ✅ Max bits per pixel based on resolution tiers
    let maxBitsPerPixel = 0.3; // Default high quality

    if (pixels >= 7680 * 4320) { // 8K
        maxBitsPerPixel = 0.4;
    } else if (pixels >= 3840 * 2160) { // 4K
        maxBitsPerPixel = 0.35;
    } else if (pixels >= 2560 * 1440) { // 1440p
        maxBitsPerPixel = 0.3;
    } else if (pixels >= 1920 * 1080) { // 1080p
        maxBitsPerPixel = 0.25;
    } else if (pixels >= 1280 * 720) { // 720p
        maxBitsPerPixel = 0.2;
    } else if (pixels >= 854 * 480) { // 480p
        maxBitsPerPixel = 0.18;
    } else { // 360p and below
        maxBitsPerPixel = 0.15;
    }

    // ✅ FPS scaling factor
    let fpsMultiplier = 1.0;
    if (fps >= 120) {
        fpsMultiplier = 1.8;
    } else if (fps >= 60) {
        fpsMultiplier = 1.5;
    } else if (fps >= 50) {
        fpsMultiplier = 1.3;
    } else if (fps >= 30) {
        fpsMultiplier = 1.1;
    } else if (fps <= 15) {
        fpsMultiplier = 0.8;
    }

    // ✅ Codec efficiency factors
    const codecEfficiency = {
        27: 1.0,    // H.264 baseline
        173: 0.75,  // H.265 more efficient
        226: 0.6,   // AV1 most efficient  
        167: 0.8    // VP9 good efficiency
    };

    const codecFactor = codecEfficiency[codecId] || 1.0;

    // ✅ Calculate max bitrate
    let maxBitrate = pixelsPerSecond * maxBitsPerPixel * fpsMultiplier * codecFactor;

    // ✅ Hardware and streaming limits
    const hardwareLimits = [
        [35389440, 500000000],   // 8K: 500Mbps max (8192*4320)
        [33177600, 400000000],   // 8K: 400Mbps max (7680*4320)  
        [8294400, 150000000],    // 4K: 150Mbps max (3840*2160)
        [3686400, 80000000],     // 1440p: 80Mbps max (2560*1440)
        [2073600, 50000000],     // 1080p: 50Mbps max (1920*1080)
        [921600, 25000000],      // 720p: 25Mbps max (1280*720)
        [409920, 10000000],      // 480p: 10Mbps max (854*480)
        [230400, 5000000]        // 360p: 5Mbps max (640*360)
    ];

    // ✅ Apply hardware limits
    for (const [resolutionPixels, limit] of hardwareLimits) {
        if (pixels >= resolutionPixels) {
            maxBitrate = Math.min(maxBitrate, limit);
            break;
        }
    }

    // ✅ Absolute min/max bounds
    const absoluteMin = 500000;    // 500kbps minimum
    const absoluteMax = 1000000000; // 1Gbps maximum

    const result = Math.max(absoluteMin, Math.min(absoluteMax, Math.round(maxBitrate)));

    console.log(`🚀 Max bitrate for ${width}x${height}@${fps}fps (codec ${codecId}): ${(result / 1000000).toFixed(2)}Mbps`);

    return result;
}


function calculateBitrateFromBpp(bpp, width, height, fps = 30) {
    const pixels = width * height;
    const pixelsPerSecond = pixels * fps;
    const bitrate = pixelsPerSecond * bpp;

    console.log(`💰 Bitrate: ${(bitrate / 1000000).toFixed(2)} Mbps (${bpp} bpp × ${width}×${height}@${fps}fps)`);

    return Math.round(bitrate);
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

    quality = quality.toLowerCase();

    var bpp = 1.0;
    if (quality === 'low') {
        bpp = (self.browser_settings[codec].bpp + self.browser_settings[codec].min_bpp) / 2;
    } else if (quality === 'medium') {
        bpp = self.browser_settings[codec].bpp;
    } else if (quality === 'high') {
        bpp = (self.browser_settings[codec].bpp + self.browser_settings[codec].max_bpp) / 2;
    }

    var bitrateInBps = calculateBitrateFromBpp(bpp, width, height, fps);
    return bitrateInBps;
}



async function findBestVideoEncoderConfigForTargetSize(format, originalWidth, originalHeight, targetBitrate, fps, isTargetSize = false) {

    console.log('findBestVideoEncoderConfigForTargetBitrate===', { format, originalWidth, originalHeight, targetBitrate, fps });
    const formatToCodecId = { h264: 27, h265: 173, av1: 226, vp9: 167 };
    var codecId = formatToCodecId[format];



    // ✅ Constants
    const minWidth = originalWidth > originalHeight ? 320 : 240, maxWidth = originalWidth > originalHeight ? 3840 : 2160;
    const minHeight = originalWidth > originalHeight ? 240 : 320, maxHeight = originalWidth > originalHeight ? 2160 : 3840;
    const targetFps = fps || 24; // Fixed FPS
    const targetBpp = self.browser_settings[format].bpp; // Fixed bits per pixel

    const aspectRatio = originalWidth / originalHeight;
    var newWidth = originalWidth;
    var newHeight = originalHeight;
    if (isTargetSize === true) {
        
        const totalPixels = targetBitrate / (targetFps * targetBpp);
        var baseWidth = Math.sqrt(totalPixels * aspectRatio);
        var baseHeight = Math.sqrt(totalPixels / aspectRatio);
        if (baseWidth < 40) {
            baseWidth = 40;
            baseHeight = 40 / aspectRatio;
        }

        if (baseHeight < 40) {
            baseHeight = 40;
            baseWidth = 40 * aspectRatio;
        }
        baseWidth = baseWidth & ~1;
        baseHeight = baseHeight & ~1;
    } else {
        var baseWidth = originalWidth;
        var baseHeight = originalHeight;
    }

    if (targetBitrate <= 0) {
        targetBitrate = calculateOptimalBitrate(baseWidth, baseHeight, targetFps, codecId);
    }
    var scale = 1.0;
    while (scale > 0) {
        newWidth = (scale * baseWidth) & ~1;
        newHeight = (scale * baseHeight) & ~1;
        if (newWidth < minWidth || newHeight < minHeight) {
            break;
        }
        if (newWidth > maxWidth || newHeight > maxHeight) {
            scale -= 0.05;
            continue;
        }
        try {
            var maxBitrate = 10 * findMaxBitrate(newWidth, newHeight, targetFps, codecId);
            var br = Math.max(100000, Math.min(maxBitrate, targetBitrate));
            const support = await isVideoEncoderConfigSupported(codecId, newWidth, newHeight, targetFps, br);
            if (support === true) {

                return {
                    width: newWidth,
                    height: newHeight,
                    framerate: targetFps,
                    max_bitrate: br
                };
            }
        } catch (e) { }
        scale -= 0.05;
    }

    scale = 1.0;
    while (scale < 100) {
        newWidth = (scale * baseWidth) & ~1;
        newHeight = (scale * baseHeight) & ~1;
        if (newWidth > maxWidth || newHeight > maxHeight) {
            break;
        }

        try {
            var maxBitrate = 10 * findMaxBitrate(newWidth, newHeight, targetFps, codecId);
            var br = Math.max(100000, Math.min(maxBitrate, targetBitrate));
            const support = await isVideoEncoderConfigSupported(codecId, newWidth, newHeight, targetFps, br);
            console.log('isVideoEncoderConfigSupported:', { codecId, newWidth, newHeight, targetFps, br, support, scale });
            if (support === true) {
                var maxBitrate = findMaxBitrate(newWidth, newHeight, targetFps, codecId);
                return {
                    width: newWidth,
                    height: newHeight,
                    framerate: targetFps,
                    max_bitrate: br
                };
            }
        } catch (e) { }
        scale += 0.05;
    }

}


///======
/**
 * ✅ Tìm cấu hình VideoEncoder tốt nhất - UU TIÊN HARDWARE ACCELERATION
 * Ưu tiên: Hardware > Software, codec mới hơn, không so sánh tốc độ
 * Early exit: Tìm thấy hardware config → return ngay, không test software
 * 
 * @param {number} codecId - 27: h264, 173: h265, 226: av1, 167: vp9
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @param {number} [fps=25] - Frame rate
 * @param {number} [bitrate=0] - Target bitrate (0 = auto calculate)
 * @param {VideoFrame} sampleFrame - Sample VideoFrame để test encode
 * @returns {Promise<Object|null>} - {codec, hardwareAcceleration, bitrateMode, latencyMode, config}
 */
async function findVideoEncoderConfig(settings, codecId, width, height, fps, bitrate) {
    if (bitrate <= 0 || fps <= 0) {
        throw new Error('bitrate and fps must be greater than 0');
    }

    var setting = settings[{ 27: 'h264', 173: 'h265', 226: 'av1', 167: 'vp9' }[codecId]] || {};

    // ✅ 1. Codec lists (ưu tiên codec mới hơn)
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

    for (const codecString of codecLists[codecId]) {
        var config = {
            codec: codecString,
            width: width,
            height: height,
            framerate: fps,
            bitrate: bitrate,
            hardwareAcceleration: setting.hardwareAcceleration || 'prefer-hardware',
            bitrateMode:  'variable',
            latencyMode: setting.latencyMode || 'quality'
        };

        if (codecId === 27) {
            config.avc = { format: 'annexb' };
        } else if (codecId === 173) {
            if (typeof is_safari !== 'undefined' && is_safari === true) {
                config.avc = { format: 'annexb' };
            } else {
                config.hevc = { format: 'annexb' };
            }
        }


        try {
            // ✅ Check support
            const support = await VideoEncoder.isConfigSupported(config);
            if (support.supported) {
                return config;
            }

        } catch (error) {
            console.warn(`⚠️ Error testing hardware ${codecString}: ${error.message}`);
            continue;
        }
    }

}



/**
 * ✅ Kiểm tra VideoEncoder có hỗ trợ cấu hình này không
 * @param {number} width - Video width. (required)
 * @param {number} height - Video height  (required)
 * @param {number} fps - Frame rate (required)
 * @param {number} codecId - 27: h264, 173: h265, 226: av1, 167: vp9 (required)
 * @param {number} bitrate - (optional) thông số này không bắt buộc phải có.
 * @param {Object} options - Additional options {hardwareAcceleration, bitrateMode, latencyMode}
 * @returns {Promise<boolean>} - true nếu được hỗ trợ, false nếu không
 */
async function isVideoEncoderConfigSupported(codecId, width, height, fps, bitrate) {

    if (typeof codecId !== 'string') {
        const formatToCodecId = { 27: 'h264', 173: 'h265', 226: 'av1', 167: 'vp9' };
        codecId = formatToCodecId[codecId];
    }

    try {
        // ✅ Validate input parameters
        if (!width || !height || !fps || !codecId) {

            console.error('❌ Missing required parameters');
            return false;
        }

        if (width < 1 || height < 1 || fps < 1) {
            console.error('❌ Invalid parameter values');
            return false;
        }

        // ✅ Map codecId to codec strings (sử dụng codec strings tốt nhất)
        const codecMaps = {
            h264: [ // H.264 - Thử từ cao xuống thấp
                'avc1.640034', // High Profile Level 5.2
                'avc1.640028', // High Profile Level 4.0
                'avc1.4d0028', // Main Profile Level 4.0
                'avc1.42E028'  // Baseline Profile Level 4.0
            ],
            h265: [ // H.265
                'hev1.1.6.L156.B0', // Main Profile Level 5.1
                'hev1.1.6.L150.B0', // Main Profile Level 5.0
                'hvc1.1.6.L156.B0', // Alternative format
                'hvc1.1.6.L150.B0'
            ],
            av1: [ // AV1
                'av01.0.08M.08', // Main Profile Level 4.0
                'av01.0.05M.08', // Main Profile Level 3.1
                'av01.0.04M.08'  // Main Profile Level 3.0
            ],
            vp9: [ // VP9
                'vp09.00.51.08', // Profile 0 Level 5.1
                'vp09.00.41.08', // Profile 0 Level 4.1
                'vp09.00.31.08'  // Profile 0 Level 3.1
            ]
        };

        const codecStrings = codecMaps[codecId];
        if (!codecStrings) {
            debugger;
            console.error(`❌ Unsupported codecId: ${codecId}`);
            return false;
        }


        //debugger;
        // ✅ Test từng codec string cho đến khi tìm thấy support
        for (const codecString of codecStrings) {
            const config = {
                codec: codecString,
                width: width,
                height: height,
                framerate: fps,
                hardwareAcceleration: self.browser_settings[codecId].hardwareAcceleration,
                bitrateMode: self.browser_settings[codecId].bitrateMode,
                latencyMode: 'quality',
                ...(bitrate > 0 ? { bitrate: bitrate } : {}),
            };



            try {
                console.log(`🔍 Testing codec support: ${codecString} (${width}x${height}@${fps}fps, ${bitrate}bps)`);

                const support = await VideoEncoder.isConfigSupported(config);

                if (support.supported) {
                    console.log(`✅ VideoEncoder config SUPPORTED: ${codecString}`);
                    return true;
                } else {
                    console.log(`❌ VideoEncoder config NOT supported: ${codecString}`);
                }

            } catch (error) {
                console.warn(`⚠️ Error testing ${codecString}: ${error.message}`);
                continue; // Try next codec
            }
        }

        console.error(`❌ No supported codec found for codecId ${codecId}`);
        return false;

    } catch (error) {
        console.error('❌ Error in isVideoEncoderConfigSupported:', error);
        return false;
    }
}
//ok



async function findBestVideoDecoderConfig(codecId, keyframeChunk, width = null, height = null) {
    // ✅ Validate input
    if (!keyframeChunk || !(keyframeChunk instanceof EncodedVideoChunk)) {
        console.error('❌ keyframeChunk must be an EncodedVideoChunk instance');
        return null;
    }

    if (keyframeChunk.type !== 'key') {
        console.warn('⚠️ Warning: chunk is not a keyframe, may fail to decode');
    }

    console.log("🔍 Finding best VideoDecoder config:", {
        type: keyframeChunk.type,
        timestamp: keyframeChunk.timestamp,
        duration: keyframeChunk.duration,
        byteLength: keyframeChunk.byteLength,
        codecId: codecId
    });



    // ✅ Codec lists (ưu tiên codec mới nhất)
    const codecLists = {
        27: [ // H.264 - High > Main > Baseline (QUALITY PRIORITY)
            // 🟢 BEST QUALITY: High Profile
            'avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.640028', 'avc1.64001f',
            // 🟡 MEDIUM QUALITY: Main Profile  
            'avc1.4d0034', 'avc1.4d0033', 'avc1.4d0032', 'avc1.4d0028', 'avc1.4d001f',
            // 🔴 BASIC QUALITY: Baseline Profile
            'avc1.42E034', 'avc1.42E028', 'avc1.42E01E'
        ],
        173: [ // H.265 - Level cao trước (newer standards)
            'hev1.1.6.L186.B0', 'hev1.1.6.L183.B0', 'hev1.1.6.L180.B0',
            'hev1.1.6.L156.B0', 'hev1.1.6.L153.B0', 'hev1.1.6.L150.B0',
            'hev1.1.6.L120.B0', 'hev1.1.6.L93.B0',
            'hvc1.1.6.L186.B0', 'hvc1.1.6.L183.B0', 'hvc1.1.6.L180.B0',
            'hvc1.1.6.L156.B0', 'hvc1.1.6.L153.B0', 'hvc1.1.6.L150.B0',
            'hvc1.1.6.L120.B0', 'hvc1.1.6.L93.B0'
        ],
        226: [ // AV1 - Level cao trước (advanced features)
            'av01.0.13M.08', 'av01.0.12M.08', 'av01.0.09M.08',
            'av01.0.08M.08', 'av01.0.05M.08', 'av01.0.04M.08'
        ],
        167: [ // VP9 - Profile cao trước (better compression)
            'vp09.00.51.08', 'vp09.00.50.08', 'vp09.00.41.08',
            'vp09.00.40.08', 'vp09.00.31.08', 'vp09.00.21.08', 'vp09.00.10.08'
        ]
    };


    const codecList = codecLists[codecId];
    if (!codecList) {
        console.error(`❌ Unsupported codecId: ${codecId}`);
        return null;
    }

    var supportedMethods = [];
    // ✅ Hardware acceleration methods
    const hardwareAccelerationMethods = ['prefer-hardware', 'prefer-software'];

    // ✅ Preferred formats (YUV formats có hardware support tốt)
    const preferredFormats = ['I420', 'NV12', 'NV21'];

    // ✅ Test TẤT CẢ combinations: hwMethod × codec
    for (const hwMethod of hardwareAccelerationMethods) {
        console.log(`🔍 Testing ${hwMethod}...`);
        var decodeFailedCount = 0;
        for (let codecIndex = 0; codecIndex < codecList.length; codecIndex++) {
            const codecString = codecList[codecIndex];

            const config = {
                codec: codecString,
                hardwareAcceleration: hwMethod,

            };

            try {
                // ✅ Check basic support
                const support = await VideoDecoder.isConfigSupported(config);
                if (!support.supported) {
                    console.log(`❌ ${codecString} (${hwMethod}) not supported`);
                    continue;
                }

                // ✅ TEST THỰC TẾ: Decode để lấy format
                try {
                    console.log(`🧪 Testing decode: ${codecString} (${hwMethod})`);
                    const testResult = await testDecoderWithKeyframeChunk(config, keyframeChunk);
                    if (!testResult) {
                        console.warn(`⚠️ Failed to decode with ${codecString} (${hwMethod})`);
                        decodeFailedCount++;
                        // Nếu decode fail liên tục với nhiều codec, có thể do hwMethod không support
                        if (decodeFailedCount >= 3) {
                            console.warn(`⚠️ Multiple decode failures with ${hwMethod}, skipping further tests`);
                            break;
                        }
                        continue;
                    }



                    // 🏆 Ưu tiên số 1: Hardware + Format YUV = 10000+ points
                    const isHardware = hwMethod === 'prefer-hardware';
                    const isYuvFormat = preferredFormats.includes(testResult.format);

                    if (isHardware && isYuvFormat) {
                        // return ngay config tốt nhất                        
                        const result = {
                            codec: codecString,
                            hardwareAcceleration: hwMethod,
                            format: testResult.format,
                            config: config,
                        };
                        return result;
                    }

                    if (testResult && !supportedMethods.includes(hwMethod)) {
                        supportedMethods.push({
                            method: hwMethod,
                            codec: codecString,
                            format: testResult.format,
                            config: config,
                        });
                        break; // Không cần test các codec thấp hơn
                    }

                } catch (e) {
                    console.warn(`⚠️ Failed to test decode ${codecString} (${hwMethod}): ${e.message}`);
                    continue;
                }

            } catch (error) {
                // Config không support, bỏ qua
                continue;
            }
        }
    }

    console.log('ℹ️ Supported methods found:', supportedMethods);

    // Nếu không có phương pháp nào hỗ trợ, trả về null
    if (supportedMethods.length === 0) {
        console.error('❌ No supported VideoDecoder configuration found');
        return null;
    }

    // debugger;
    // Chọn phương pháp tốt nhất từ supportedMethods
    // Ưu tiên hardware > software, sau đó ưu tiên codec mới hơn
    for (const methodInfo of supportedMethods) {
        const isYuvFormat = preferredFormats.includes(methodInfo.format);
        if (isYuvFormat) {
            return {
                codec: methodInfo.codec,
                hardwareAcceleration: methodInfo.method,
                format: methodInfo.format,
                config: methodInfo.config,
            };
        }
    }

    for (const methodInfo of supportedMethods) {
        const isHardware = methodInfo.method === 'prefer-hardware';
        if (isHardware) {
            return {
                codec: methodInfo.codec,
                hardwareAcceleration: methodInfo.method,
                format: methodInfo.format,
                config: methodInfo.config,
            };
        }
    }

    if (supportedMethods.length > 0) {
        const methodInfo = supportedMethods[0];
        return {
            codec: methodInfo.codec,
            hardwareAcceleration: methodInfo.method,
            format: methodInfo.format,
            config: methodInfo.config,
        };
    }

    console.error('❌ No suitable VideoDecoder configuration found after testing');
    return null;

}
