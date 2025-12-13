/**
 * Tìm codec string nhanh nhất cho VideoEncoder
 * @param {string} format - 'h264', 'h265', 'av01', 'vp9'
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @param {number} fps - Frame rate (optional)
 * @param {number} bitrate - Target bitrate (optional)
 * @returns {Promise<string|null>} - Fastest codec string hoặc null nếu không hỗ trợ
 */
async function findFastestCodecStringForVideoEncoder(format, width, height, fps = 30, bitrate = 0) {
    debugger;
    const speedOptimizedCodecs = {
        h264: [
            // Baseline profile - fastest encoding
            'avc1.42001E', // Baseline, Level 3.0
            'avc1.42001F', // Baseline, Level 3.1
            'avc1.420020', // Baseline, Level 3.2
            // Main profile - balanced
            'avc1.4D001E', // Main, Level 3.0
            'avc1.4D001F', // Main, Level 3.1
            'avc1.4D0020', // Main, Level 3.2
            // High profile - fallback
            'avc1.64001E', // High, Level 3.0
            'avc1.64001F', // High, Level 3.1
            'avc1.640020'  // High, Level 3.2
        ],
        
        h265: [
            // Main profile - fastest for H.265
            'hev1.1.6.L93.B0',  // Main, Level 3.1
            'hev1.1.6.L123.B0', // Main, Level 4.0
            'hev1.1.6.L153.B0', // Main, Level 5.0
            // Main 10 profile - fallback
            'hev1.2.4.L93.B0',  // Main 10, Level 3.1
            'hev1.2.4.L123.B0', // Main 10, Level 4.0
        ],
        
        av01: [
            // Main profile với level thấp - fastest
            'av01.0.01M.08',    // Level 3.0 - fastest
            'av01.0.04M.08',    // Level 4.0 - balanced
            'av01.0.05M.08',    // Level 5.0 - high res
            'av01.0.08M.08',    // Level 5.1 - 4K
            // High profile - fallback
            'av01.0.01H.08',    // High, Level 3.0
            'av01.0.04H.08',    // High, Level 4.0
        ],
        
        vp9: [
            // Profile 0 - fastest VP9 encoding
            'vp09.00.10.08',    // Profile 0, Level 1
            'vp09.00.20.08',    // Profile 0, Level 2
            'vp09.00.30.08',    // Profile 0, Level 3
            'vp09.00.40.08',    // Profile 0, Level 4
            'vp09.00.50.08',    // Profile 0, Level 5
        ]
    };

    const codecList = speedOptimizedCodecs[format];
    if (!codecList) {
        console.warn(`Unsupported format: ${format}`);
        return null;
    }

    const baseConfig = {
        width: width,
        height: height,
        framerate: fps,
        hardwareAcceleration: getOptimalHardwareAcceleration(format),
        latencyMode: getOptimalLatencyMode(format)
    };

    if (bitrate > 0) {
        baseConfig.bitrate = bitrate;
    }

    // Test từng codec theo thứ tự ưu tiên tốc độ
    for (const codec of codecList) {
        try {
            const config = { ...baseConfig, codec };
            const support = await VideoEncoder.isConfigSupported(config);
            
            if (support.supported) {
                console.log(`✅ Found fastest codec for ${format}: ${codec}`);
                return codec;
            }
        } catch (error) {
            console.warn(`❌ Codec ${codec} test failed:`, error.message);
        }
    }

    console.warn(`⚠️ No supported codec found for ${format}`);
    return null;
}

/**
 * DECODER FUNCTIONS - Tìm codec strings nhanh nhất cho VideoDecoder
 */

/**
 * Tìm codec string nhanh nhất cho VideoDecoder
 * @param {string} format - 'h264', 'h265', 'av01', 'vp9'
 * @param {number} width - Video width (optional, for optimization)
 * @param {number} height - Video height (optional, for optimization)
 * @returns {Promise<string|null>} - Fastest decoder codec string hoặc null nếu không hỗ trợ
 */
async function findFastestCodecStringForVideoDecoder(format, width = 1920, height = 1080) {
    if (format == 27) {
        format = 'h264';
    } else if (format == 173) {
        format = 'h265';
    } else if (format == 226) {
        format = 'av1';
    } else if (format == 167) {
        format = 'vp9';
    }

    const decoderOptimizedCodecs = {
        h264: [
            // Baseline profile - decode nhanh nhất, ít phức tạp
            'avc1.42001E', // Baseline, Level 3.0 - fastest decode
            'avc1.42001F', // Baseline, Level 3.1
            'avc1.420020', // Baseline, Level 3.2
            'avc1.420028', // Baseline, Level 4.0
            // Main profile - balanced decode speed
            'avc1.4D001E', // Main, Level 3.0
            'avc1.4D001F', // Main, Level 3.1
            'avc1.4D0020', // Main, Level 3.2
            'avc1.4D0028', // Main, Level 4.0
            // High profile - more complex but widely supported
            'avc1.64001E', // High, Level 3.0
            'avc1.64001F', // High, Level 3.1
            'avc1.640020', // High, Level 3.2
            'avc1.640028'  // High, Level 4.0
        ],
        
        h265: [
            // Main profile - fastest H.265 decode
            'hev1.1.6.L93.B0',  // Main, Level 3.1 - fastest decode
            'hev1.1.6.L120.B0', // Main, Level 3.2
            'hev1.1.6.L123.B0', // Main, Level 4.0
            'hev1.1.6.L153.B0', // Main, Level 5.0
            // Main 10 - nếu cần HDR
            'hev1.2.4.L93.B0',  // Main 10, Level 3.1
            'hev1.2.4.L123.B0', // Main 10, Level 4.0
            // Alternative format
            'hvc1.1.6.L93.B0',  // Main, Level 3.1 (hvc1 format)
            'hvc1.1.6.L123.B0'  // Main, Level 4.0 (hvc1 format)
        ],
        
        av01: [
            // Main profile với level thấp - decode nhanh nhất
            'av01.0.01M.08',    // Level 3.0 - fastest AV1 decode
            'av01.0.04M.08',    // Level 4.0 - balanced
            'av01.0.05M.08',    // Level 5.0 - high res
            'av01.0.08M.08',    // Level 5.1 - 4K
            'av01.0.12M.08',    // Level 6.0 - 8K
            // Professional profile - fallback
            'av01.0.01P.08',    // Professional, Level 3.0
            'av01.0.04P.08',    // Professional, Level 4.0
            // High profile - nếu cần quality cao
            'av01.0.01H.08',    // High, Level 3.0
            'av01.0.04H.08'     // High, Level 4.0
        ],
        
        vp9: [
            // Profile 0 - decode nhanh nhất VP9
            'vp09.00.10.08',    // Profile 0, Level 1.0 - fastest decode
            'vp09.00.20.08',    // Profile 0, Level 2.0
            'vp09.00.30.08',    // Profile 0, Level 3.0
            'vp09.00.40.08',    // Profile 0, Level 4.0
            'vp09.00.50.08',    // Profile 0, Level 5.0
            'vp09.00.51.08',    // Profile 0, Level 5.1
            // Profile 2 - cho HDR content
            'vp09.02.10.10',    // Profile 2, Level 1.0, 10-bit
            'vp09.02.20.10',    // Profile 2, Level 2.0, 10-bit
            'vp09.02.30.10'     // Profile 2, Level 3.0, 10-bit
        ]
    };

    const codecList = decoderOptimizedCodecs[format];
    if (!codecList) {
        console.warn(`Unsupported format for decoder: ${format}`);
        return null;
    }

    const baseConfig = {
        codec: '',
        hardwareAcceleration: getOptimalDecoderHardwareAcceleration(format),
        optimizeForLatency: true // Ưu tiên tốc độ decode
    };

    // Test từng codec theo thứ tự ưu tiên tốc độ decode
    for (const codec of codecList) {
        try {
            const config = { ...baseConfig, codec };
            const support = await VideoDecoder.isConfigSupported(config);
            
            if (support.supported) {
                console.log(`✅ Found fastest decoder codec for ${format}: ${codec}`);
                return codec;
            }
        } catch (error) {
            console.warn(`❌ Decoder codec ${codec} test failed:`, error.message);
        }
    }

    console.warn(`⚠️ No supported decoder codec found for ${format}`);
    return null;
}

/**
 * Lấy hardware acceleration setting tối ưu cho từng format, for VideoEncoder
 * @param {string} format - Video format
 * @returns {string} - Hardware acceleration preference
 */
function getOptimalHardwareAcceleration(format) {
    switch (format) {
        case 'h264':
        case 'h265':
            return 'prefer-hardware'; // Hardware encoders mature cho H.264/H.265
        case 'av01':
        case 'vp9':
            return 'prefer-software'; // Software encoders tốt hơn cho AV1/VP9
        default:
            return 'prefer-hardware';
    }
}

/**
 * Lấy latency mode tối ưu cho từng format
 * @param {string} format - Video format  
 * @returns {string} - Latency mode
 */
function getOptimalLatencyMode(format) {
    switch (format) {
        case 'h264':
            return 'quality'; // H.264 mature, có thể dùng quality mode
        case 'h265':
        case 'av01':
        case 'vp9':
            return 'realtime'; // Formats mới ưu tiên tốc độ
        default:
            return 'quality';
    }
}

/**
 * Batch test tất cả formats và trả về codec nhanh nhất cho mỗi format
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @param {number} fps - Frame rate
 * @param {number} bitrate - Target bitrate
 * @returns {Promise<Object>} - Object chứa fastest codecs cho từng format
 */
async function findAllFastestCodecs(width, height, fps = 30, bitrate = 0) {
    const formats = ['h264', 'h265', 'av01', 'vp9'];
    const results = {};

    console.log(`🔍 Finding fastest codecs for ${width}x${height}@${fps}fps...`);

    for (const format of formats) {
        try {
            const fastestCodec = await findFastestCodecStringForVideoEncoder(format, width, height, fps, bitrate);
            results[format] = fastestCodec;
        } catch (error) {
            console.error(`❌ Error testing ${format}:`, error);
            results[format] = null;
        }
    }

    console.log('🎉 Fastest codecs found:', results);
    return results;
}

// Sử dụng trong selectCodecStringForVideoEncoder
async function selectCodecStringForVideoEncoder(codecId, width, height, fps, bitrate) {
    const formatMap = { 27: 'h264', 173: 'h265', 226: 'av01', 167: 'vp9' };
    const format = formatMap[codecId];
    
    if (format) {
        const fastestCodec = await findFastestCodecStringForVideoEncoder(format, width, height, fps, bitrate);
        if (fastestCodec) return fastestCodec;
    }
    
    // Fallback to original logic...
}



/**
 * Lấy hardware acceleration setting tối ưu cho VideoDecoder
 * @param {string} format - Video format
 * @returns {string} - Hardware acceleration preference
 */
function getOptimalDecoderHardwareAcceleration(format) {
    switch (format) {
        case 'h264':
            return 'prefer-hardware'; // H.264 decode rất mature, hardware luôn nhanh hơn
        case 'h265':
            return 'prefer-hardware'; // H.265 hardware decoders đã tốt
        case 'av01':
            return 'prefer-hardware'; // AV1 hardware decode ngày càng tốt hơn software
        case 'vp9':
            return 'prefer-hardware'; // VP9 hardware decode cũng đã khá mature
        default:
            return 'prefer-hardware';
    }
}

/**
 * Batch test tất cả formats và trả về decoder codec nhanh nhất cho mỗi format
 * @param {number} width - Video width (optional)
 * @param {number} height - Video height (optional)
 * @returns {Promise<Object>} - Object chứa fastest decoder codecs cho từng format
 */
async function findAllFastestDecoderCodecs(width = 1920, height = 1080) {
    const formats = ['h264', 'h265', 'av01', 'vp9'];
    const results = {};

    console.log(`🔍 Finding fastest decoder codecs for ${width}x${height}...`);

    for (const format of formats) {
        try {
            const fastestCodec = await findFastestCodecStringForVideoDecoder(format, width, height);
            results[format] = fastestCodec;
        } catch (error) {
            console.error(`❌ Error testing decoder ${format}:`, error);
            results[format] = null;
        }
    }

    console.log('🎉 Fastest decoder codecs found:', results);
    return results;
}

/**
 * Utility function - Select codec for VideoDecoder by codecId
 * @param {number} codecId - Codec ID (27: h264, 173: h265, 226: av01, 167: vp9)
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @returns {Promise<string|null>} - Fastest decoder codec string
 */
async function selectDecoderCodecString(codecId, width, height) {
    const formatMap = { 27: 'h264', 173: 'h265', 226: 'av01', 167: 'vp9' };
    const format = formatMap[codecId];
    
    if (format) {
        const fastestCodec = await findFastestCodecStringForVideoDecoder(format, width, height);
        if (fastestCodec) return fastestCodec;
    }
    
    console.warn(`⚠️ No decoder codec found for codecId: ${codecId}`);
    return null;
}


      