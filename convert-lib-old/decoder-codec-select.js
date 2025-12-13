/**
 * Tìm codec string nhanh nhất cho VideoDecoder
 * VideoDecoder có yêu cầu khác với VideoEncoder về hiệu suất
 */

/**
 * Tìm codec string nhanh nhất cho VideoDecoder
 * @param {string} format - 'h264', 'h265', 'av01', 'vp9'
 * @param {number} width - Video width (optional, for optimization)
 * @param {number} height - Video height (optional, for optimization)
 * @returns {Promise<string|null>} - Fastest decoder codec string hoặc null nếu không hỗ trợ
 */
async function findFastestDecoderCodecString(format, width = 1920, height = 1080) {
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
            const fastestCodec = await findFastestDecoderCodecString(format, width, height);
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
 * Test hiệu suất decode thực tế với codec string
 * @param {string} codecString - Codec string để test
 * @param {ArrayBuffer} sampleData - Sample video data để test decode
 * @returns {Promise<number>} - Decode time in milliseconds
 */
async function benchmarkDecoderCodec(codecString, sampleData) {
    try {
        const decoder = new VideoDecoder({
            output: (frame) => {
                frame.close(); // Clean up frame
            },
            error: (error) => {
                console.error('Decoder error:', error);
            }
        });

        const config = {
            codec: codecString,
            hardwareAcceleration: 'prefer-hardware',
            optimizeForLatency: true
        };

        const startTime = performance.now();
        
        decoder.configure(config);
        
        // Decode a small chunk to measure speed
        const chunk = new EncodedVideoChunk({
            type: 'key',
            timestamp: 0,
            data: sampleData
        });
        
        decoder.decode(chunk);
        await decoder.flush();
        
        const endTime = performance.now();
        const decodeTime = endTime - startTime;
        
        decoder.close();
        
        console.log(`Decoder ${codecString} benchmark: ${decodeTime.toFixed(2)}ms`);
        return decodeTime;
        
    } catch (error) {
        console.error(`Benchmark failed for ${codecString}:`, error);
        return Infinity; // Return max time for failed codecs
    }
}

/**
 * Tìm codec string nhanh nhất bằng cách benchmark thực tế
 * @param {string} format - Video format
 * @param {ArrayBuffer} sampleData - Sample video data
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @returns {Promise<Object>} - {codec: string, time: number}
 */
async function findFastestDecoderByBenchmark(format, sampleData, width = 1920, height = 1080) {
    const supportedCodecs = [];
    
    // Get all supported codecs first
    const allCodecs = await findFastestDecoderCodecString(format, width, height);
    if (!allCodecs) return null;

    // Get codec list for format
    const decoderOptimizedCodecs = {
        h264: ['avc1.42001E', 'avc1.42001F', 'avc1.4D001E', 'avc1.64001E'],
        h265: ['hev1.1.6.L93.B0', 'hev1.1.6.L123.B0', 'hvc1.1.6.L93.B0'],
        av01: ['av01.0.01M.08', 'av01.0.04M.08', 'av01.0.05M.08'],
        vp9: ['vp09.00.10.08', 'vp09.00.20.08', 'vp09.00.30.08']
    };

    const codecList = decoderOptimizedCodecs[format] || [];
    
    // Benchmark each supported codec
    const benchmarkResults = [];
    
    for (const codec of codecList) {
        try {
            const config = { codec, hardwareAcceleration: 'prefer-hardware' };
            const support = await VideoDecoder.isConfigSupported(config);
            
            if (support.supported) {
                const time = await benchmarkDecoderCodec(codec, sampleData);
                benchmarkResults.push({ codec, time });
            }
        } catch (error) {
            console.warn(`Benchmark failed for ${codec}:`, error);
        }
    }

    // Sort by decode time (fastest first)
    benchmarkResults.sort((a, b) => a.time - b.time);
    
    console.log(`Benchmark results for ${format}:`, benchmarkResults);
    
    return benchmarkResults.length > 0 ? benchmarkResults[0] : null;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        findFastestDecoderCodecString,
        findAllFastestDecoderCodecs,
        benchmarkDecoderCodec,
        findFastestDecoderByBenchmark,
        getOptimalDecoderHardwareAcceleration
    };
}