
// Hàm lấy min/max width/height mà VideoEncoder hỗ trợ cho một codec string
async function getMinMaxVideoEncoderResolution(codec) {
    // Danh sách độ phân giải phổ biến từ thấp đến cao
    const resolutions = [
        [160, 120], [240, 180], [320, 240], [480, 360], [640, 480],
        [960, 540], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160],
        [4096, 2160], [7680, 4320]
    ];
    let minWidth = null, minHeight = null, maxWidth = 0, maxHeight = 0;
    for (const [w, h] of resolutions) {
        const config = { codec, width: w, height: h, framerate: 30 };
        try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (support.supported) {
                if (minWidth === null || w < minWidth) {
                    minWidth = w;
                    minHeight = h;
                }
                if (w > maxWidth) {
                    maxWidth = w;
                    maxHeight = h;
                }
            }
        } catch (e) { }
    }
    return { minWidth, minHeight, maxWidth, maxHeight };
}

function getSuitableResolution(inputWidth, inputHeight, minWidth, minHeight, maxWidth, maxHeight) {
    const aspectRatio = inputWidth / inputHeight;

    if (inputWidth < minWidth || inputHeight < minHeight || inputWidth > maxWidth || inputHeight > maxHeight) {
        if (aspectRatio > 1) {
            // Landscape orientation
            inputWidth = Math.min(maxWidth, Math.max(minWidth, inputWidth));
            inputHeight = inputWidth / aspectRatio;
        } else {
            // Portrait orientation
            inputHeight = Math.min(maxHeight, Math.max(minHeight, inputHeight));
            inputWidth = inputHeight * aspectRatio;
        }
    }

    return {
        width: Math.round(inputWidth),
        height: Math.round(inputHeight)
    };
}

async function selectCodecStringForVideoEncoder(codecId, width, height, fps, bitrate) {

    var codec_list = null;
    if (codecId == 27) {
        codec_list = [...all_codecs['h264']['Baseline'], ...all_codecs['h264']['Main'], ...all_codecs['h264']['High']];
    } else if (codecId == 173) {
        codec_list = [...all_codecs['h265']['Main 10'], ...all_codecs['h265']['Main']];
    } else if (codecId == 226) {
        codec_list = [...all_codecs['av1']['High'], ...all_codecs['av1']['Main']];// Trên android, video với profile là High đc tạo ra không chạy đc.
    } else if (codecId == 167) {
        codec_list = [...all_codecs['vp9']['0']];
    }


    const config = { width, height, framerate: fps };
    if (bitrate > 0) {
        config.bitrate = bitrate;
    }

    // Duyệt từ cuối mảng để ưu tiên các codec mới hơn
    for (const codec of [...codec_list].reverse()) {
        config.codec = codec;
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) return codec;

    }

}

async function selectCodecStringForVideoDecoder(codecId, width, height, suggestedCodecString) {

    var codec_list = null;
    if (codecId == 27) {
        codec_list = [...all_codecs['h264']['Baseline'], ...all_codecs['h264']['Main'], ...all_codecs['h264']['High']];
    } else if (codecId == 173) {
        codec_list = [...all_codecs['h265']['Main 10'], ...all_codecs['h265']['Main']];
    } else if (codecId == 226) {
        codec_list = [...all_codecs['av1']['Main'], ...all_codecs['av1']['High']];
    } else if (codecId == 167) {
        codec_list = [...all_codecs['vp9']['0']];
    } else {
        return null;
    }

    if (suggestedCodecString) {
        codec_list.push(suggestedCodecString);
    }
    var config = {
        width: width,
        height: height,
    };
    for (var n = codec_list.length - 1; n >= 0; n--) {
        if (!codec_list[n]) {
            continue;
        }
        config.codec = codec_list[n];
        const support = await VideoDecoder.isConfigSupported(config);
        if (support.supported) {
            return config.codec;
        }
    }
}

async function selectConfigForVideoEncoder(codec_id, bitrate, fps, width, height) {


    var codec_key = '';
    if (codec_id == 27) {
        codec_key = 'h264';
    } else if (codec_id == 173) {
        codec_key = 'h265';
    } else if (codec_id == 226) {
        codec_key = 'av1';
    } else if (codec_id == 167) {
        codec_key = 'vp9';
    }


    var codec_list = all_codecs[codec_key]['High'] || all_codecs[codec_key]['Main'] || all_codecs[codec_key]['Baseline'] || all_codecs[codec_key]['0'] || [];
    var methods = ["prefer-hardware", "prefer-software"];

    var config = {
        width: width,
        height: height,
    };

    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
        if (codec_id == 27 || codec_id == 173) {
            config.avc = { format: 'annexb' };
            config.hevc = { format: 'annexb' };
        }
    } else {
        if (codec_id == 27) {
            config.avc = { format: 'annexb' };
        } else if (codec_id == 173) {
            config.hevc = { format: 'annexb' };
        }
    }

    if (bitrate > 0) {
        config.bitrate = bitrate;
    }
    
    if (fps > 0) {
        config.framerate = fps;
    }

    for (var i = 0; i < methods.length; i++) {
        config.hardwareAcceleration = methods[i];
        for (var n = 0; n < codec_list.length; n++) {
            try {
                config.codec = codec_list[n];
                const support = await VideoEncoder.isConfigSupported(config);
                if (support.supported) {
                    return config;
                }
            } catch (error) {
            }
        }
    }
}

async function selectBestMethodForVideoDecoder(encoded_video_chunk, mime_code, width, height, required_smallest) {

    var methods = ["prefer-hardware", "prefer-software"];
    var selected_method;
    var selected_format;
    for (var i = 0; i < methods.length; i++) {

        var config = {
            codec: mime_code,
            width: width,
            height: height,
        };


        config.hardwareAcceleration = methods[i];
        const support = await VideoDecoder.isConfigSupported(config);
        if (support.supported) {
            try {
                var video_decoder = new VideoDecoder({
                    output: async (frame) => {
                        var format = frame.format;
                        frame.close();
                        selected_method = methods[i];
                        selected_format = format;
                    },
                    error: (error) => {
                        console.error('error get_videodecoder_method:', error);
                    }
                });

                video_decoder.configure(config);
                video_decoder.decode(encoded_video_chunk);
                await video_decoder.flush();
                video_decoder.close();
                if (selected_format == 'I420' || selected_format == 'NV12') {
                    return selected_method;
                }
            } catch (error) {
                console.log('hungnote get_videodecoder_method error===', error);
            }
        }
    }

    if (!required_smallest && selected_method) {
        return selected_method;
    }
}

/**
 * Tự động lựa chọn fps, width, height để đạt bitrate mong muốn
 * @param {number} codecId - Codec ID (27: h264, 173: h265, 226: av01, 167: vp9)
 * @param {number} targetBitrate - Bitrate mong muốn (bps)
 * @param {number} originalWidth - Width gốc của video
 * @param {number} originalHeight - Height gốc của video
 * @param {number} originalFps - FPS gốc của video
 * @param {Object} constraints - Ràng buộc (optional)
 * @returns {Promise<Object>} - Optimized config {width, height, fps, bitrate, codec}
 */
async function optimizeVideoConfigForBitrate(codecId, targetBitrate, originalWidth, originalHeight, originalFps = 30, constraints = {}) {
    const {
        maxWidth = 3840,
        maxHeight = 2160,
        minWidth = 320,
        minHeight = 240,
        maxFps = 60,
        minFps = 15,
        qualityPriority = 'balanced', // 'resolution', 'framerate', 'balanced'
        aspectRatioTolerance = 0.1
    } = constraints;

    console.log(`🎯 Optimizing video config for ${targetBitrate} bps target bitrate...`);

    // Lấy codec string để test
    const testCodec = await selectCodecStringForVideoEncoder(codecId, originalWidth, originalHeight, originalFps, targetBitrate);
    if (!testCodec) {
        throw new Error(`No supported codec found for codecId ${codecId}`);
    }

    // Tính aspect ratio gốc
    const originalAspectRatio = originalWidth / originalHeight;

    // Tạo danh sách các cấu hình test theo strategy khác nhau
    const testConfigs = generateTestConfigurations(
        originalWidth, originalHeight, originalFps,
        minWidth, minHeight, maxWidth, maxHeight,
        minFps, maxFps, qualityPriority, targetBitrate
    );

    console.log(`📊 Testing ${testConfigs.length} configurations...`);

    const results = [];

    // Test từng configuration
    for (const config of testConfigs) {
        try {
            const testResult = await testVideoEncoderConfig(
                codecId, testCodec, config, targetBitrate, originalAspectRatio, aspectRatioTolerance
            );
            
            if (testResult.supported) {
                results.push(testResult);
            }
        } catch (error) {
            console.warn(`❌ Config test failed:`, config, error.message);
        }
    }

    if (results.length === 0) {
        throw new Error('No suitable configuration found for target bitrate');
    }

    // Sắp xếp kết quả theo score
    results.sort((a, b) => b.score - a.score);

    const bestConfig = results[0];
    console.log(`✅ Best config found:`, bestConfig);

    return {
        width: bestConfig.width,
        height: bestConfig.height,
        fps: bestConfig.fps,
        bitrate: targetBitrate,
        codec: testCodec,
        estimatedQuality: bestConfig.qualityScore,
        bitrateEfficiency: bestConfig.bitrateScore,
        totalScore: bestConfig.score,
        alternatives: results.slice(1, 5), // Top 5 alternatives
        originalResolution: { width: originalWidth, height: originalHeight, fps: originalFps }
    };
}

/**
 * Tạo danh sách configurations để test
 */
function generateTestConfigurations(originalWidth, originalHeight, originalFps, 
                                  minWidth, minHeight, maxWidth, maxHeight, 
                                  minFps, maxFps, qualityPriority, targetBitrate) {
    const configs = [];
    const originalAspectRatio = originalWidth / originalHeight;

    // Các mức scale resolution
    const resolutionScales = [1.0, 0.9, 0.8, 0.75, 0.67, 0.5, 0.4, 0.33, 0.25];
    
    // Các mức FPS
    const fpsOptions = [60, 50, 30, 25, 24, 20, 15].filter(fps => fps >= minFps && fps <= maxFps);

    // Strategy 1: Giữ FPS, giảm resolution
    if (qualityPriority === 'framerate' || qualityPriority === 'balanced') {
        for (const fps of [originalFps, ...fpsOptions]) {
            for (const scale of resolutionScales) {
                const width = Math.max(minWidth, Math.min(maxWidth, Math.round(originalWidth * scale / 2) * 2));
                const height = Math.max(minHeight, Math.min(maxHeight, Math.round(originalHeight * scale / 2) * 2));
                
                configs.push({
                    width, height, fps,
                    strategy: 'maintain_fps',
                    scale: scale,
                    priority: qualityPriority === 'framerate' ? 100 : 50
                });
            }
        }
    }

    // Strategy 2: Giữ resolution, giảm FPS
    if (qualityPriority === 'resolution' || qualityPriority === 'balanced') {
        for (const scale of [1.0, 0.9, 0.8, 0.75]) {
            const width = Math.max(minWidth, Math.min(maxWidth, Math.round(originalWidth * scale / 2) * 2));
            const height = Math.max(minHeight, Math.min(maxHeight, Math.round(originalHeight * scale / 2) * 2));
            
            for (const fps of fpsOptions) {
                configs.push({
                    width, height, fps,
                    strategy: 'maintain_resolution',
                    scale: scale,
                    priority: qualityPriority === 'resolution' ? 100 : 50
                });
            }
        }
    }

    // Strategy 3: Balanced scaling (cả resolution và FPS)
    for (const resScale of [0.9, 0.8, 0.75, 0.67, 0.5]) {
        for (const fpsScale of [0.9, 0.8, 0.67, 0.5]) {
            const width = Math.max(minWidth, Math.min(maxWidth, Math.round(originalWidth * resScale / 2) * 2));
            const height = Math.max(minHeight, Math.min(maxHeight, Math.round(originalHeight * resScale / 2) * 2));
            const fps = Math.max(minFps, Math.min(maxFps, Math.round(originalFps * fpsScale)));
            
            configs.push({
                width, height, fps,
                strategy: 'balanced',
                resScale: resScale,
                fpsScale: fpsScale,
                priority: 75
            });
        }
    }

    // Strategy 4: Common resolutions với FPS tối ưu
    const commonResolutions = [
        [3840, 2160], [2560, 1440], [1920, 1080], [1280, 720], 
        [960, 540], [854, 480], [640, 360], [480, 270]
    ];

    for (const [w, h] of commonResolutions) {
        if (w >= minWidth && w <= maxWidth && h >= minHeight && h <= maxHeight) {
            // Kiểm tra aspect ratio có phù hợp không
            const aspectRatio = w / h;
            if (Math.abs(aspectRatio - originalAspectRatio) / originalAspectRatio <= 0.2) {
                for (const fps of fpsOptions) {
                    configs.push({
                        width: w, height: h, fps,
                        strategy: 'common_resolution',
                        priority: 60
                    });
                }
            }
        }
    }

    // Loại bỏ duplicates và sort theo priority
    const uniqueConfigs = configs.filter((config, index, self) => 
        index === self.findIndex(c => c.width === config.width && c.height === config.height && c.fps === config.fps)
    );

    return uniqueConfigs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * Test một video encoder configuration
 */
async function testVideoEncoderConfig(codecId, codecString, config, targetBitrate, originalAspectRatio, aspectRatioTolerance) {
    const { width, height, fps, strategy, priority = 50 } = config;

    // Tạo encoder config
    const encoderConfig = {
        codec: codecString,
        width: width,
        height: height,
        framerate: fps,
        bitrate: targetBitrate,
        hardwareAcceleration: 'prefer-hardware'
    };

    // Test support
    const support = await VideoEncoder.isConfigSupported(encoderConfig);
    if (!support.supported) {
        return { supported: false, config };
    }

    // Tính các điểm số chất lượng
    const qualityScore = calculateQualityScore(width, height, fps, originalAspectRatio, aspectRatioTolerance);
    const bitrateScore = calculateBitrateEfficiencyScore(width, height, fps, targetBitrate, codecId);
    const strategyScore = getStrategyScore(strategy, priority);
    
    const totalScore = (qualityScore * 0.4) + (bitrateScore * 0.4) + (strategyScore * 0.2);

    return {
        supported: true,
        width, height, fps,
        strategy: strategy,
        qualityScore: Math.round(qualityScore),
        bitrateScore: Math.round(bitrateScore),
        strategyScore: Math.round(strategyScore),
        score: Math.round(totalScore),
        config: encoderConfig,
        estimatedBitsPerPixel: targetBitrate / (width * height * fps),
        pixelCount: width * height,
        aspectRatio: width / height
    };
}

/**
 * Tính điểm chất lượng dựa trên resolution và FPS
 */
function calculateQualityScore(width, height, fps, originalAspectRatio, aspectRatioTolerance) {
    const pixelCount = width * height;
    const aspectRatio = width / height;
    
    // Điểm resolution (0-100)
    const resolutionScore = Math.min(100, (pixelCount / (1920 * 1080)) * 80 + 20);
    
    // Điểm FPS (0-100)
    const fpsScore = Math.min(100, (fps / 60) * 80 + 20);
    
    // Penalty cho aspect ratio không đúng
    const aspectRatioDiff = Math.abs(aspectRatio - originalAspectRatio) / originalAspectRatio;
    const aspectRatioPenalty = aspectRatioDiff > aspectRatioTolerance ? 
        Math.min(50, aspectRatioDiff * 100) : 0;
    
    return Math.max(0, (resolutionScore + fpsScore) / 2 - aspectRatioPenalty);
}

/**
 * Tính điểm hiệu quả bitrate
 */
function calculateBitrateEfficiencyScore(width, height, fps, targetBitrate, codecId) {
    const pixelsPerSecond = width * height * fps;
    const bitsPerPixel = targetBitrate / pixelsPerSecond;
    
    // Các codec có efficiency khác nhau
    const codecEfficiency = {
        27: 1.0,   // H.264 baseline
        173: 1.3,  // H.265 better compression
        226: 1.5,  // AV1 best compression
        167: 1.2   // VP9 good compression
    };
    
    const efficiency = codecEfficiency[codecId] || 1.0;
    const adjustedBitsPerPixel = bitsPerPixel * efficiency;
    
    // Optimal range: 0.1 - 0.3 bits per pixel
    let score = 100;
    if (adjustedBitsPerPixel < 0.05) {
        score = 30; // Too low quality
    } else if (adjustedBitsPerPixel < 0.1) {
        score = 60; // Low quality
    } else if (adjustedBitsPerPixel <= 0.3) {
        score = 100; // Good range
    } else if (adjustedBitsPerPixel <= 0.5) {
        score = 80; // High quality
    } else {
        score = 50; // Inefficient
    }
    
    return score;
}

/**
 * Tính điểm strategy
 */
function getStrategyScore(strategy, priority) {
    const baseScore = priority || 50;
    
    // Bonus cho strategies tốt
    const strategyBonus = {
        'maintain_fps': 10,      // Tốt cho video motion
        'maintain_resolution': 5, // Tốt cho detail
        'balanced': 15,          // Tốt overall
        'common_resolution': 8    // Tốt cho compatibility
    };
    
    return baseScore + (strategyBonus[strategy] || 0);
}

/**
 * Estimate bitrate cần thiết cho một configuration
 * @param {number} width - Video width
 * @param {number} height - Video height  
 * @param {number} fps - Frame rate
 * @param {number} codecId - Codec ID
 * @param {string} quality - Quality level ('low', 'medium', 'high')
 * @returns {number} - Estimated bitrate in bps
 */
function estimateRequiredBitrate(width, height, fps, codecId, quality = 'medium') {
    const pixelsPerSecond = width * height * fps;
    
    // Base bits per pixel cho different quality levels
    const qualityFactors = {
        'low': 0.08,
        'medium': 0.15,
        'high': 0.25,
        'ultra': 0.4
    };
    
    // Codec efficiency factors
    const codecFactors = {
        27: 1.0,   // H.264
        173: 0.75, // H.265 (25% more efficient)
        226: 0.65, // AV1 (35% more efficient)
        167: 0.8   // VP9 (20% more efficient)
    };
    
    const baseBitsPerPixel = qualityFactors[quality] || qualityFactors['medium'];
    const codecFactor = codecFactors[codecId] || 1.0;
    
    const estimatedBitrate = pixelsPerSecond * baseBitsPerPixel * codecFactor;
    
    return Math.round(estimatedBitrate);
}

/**
 * Tìm configuration tối ưu cho file size target
 * @param {number} codecId - Codec ID
 * @param {number} targetFileSizeMB - Target file size in MB
 * @param {number} durationSeconds - Video duration in seconds
 * @param {number} originalWidth - Original width
 * @param {number} originalHeight - Original height
 * @param {number} originalFps - Original FPS
 * @param {Object} constraints - Constraints
 * @returns {Promise<Object>} - Optimized config
 */
async function optimizeVideoConfigForFileSize(codecId, targetFileSizeMB, durationSeconds, 
                                            originalWidth, originalHeight, originalFps = 30, constraints = {}) {
    // Convert file size to bitrate
    const targetBitrate = (targetFileSizeMB * 8 * 1024 * 1024) / durationSeconds;
    
    console.log(`🎯 Target file size: ${targetFileSizeMB}MB (${Math.round(targetBitrate/1000)}kbps for ${durationSeconds}s)`);
    
    // Reserve some bitrate for audio (typically 128kbps)
    const audioBitrate = 128 * 1000; // 128kbps
    const videoBitrate = Math.max(100000, targetBitrate - audioBitrate); // Minimum 100kbps for video
    
    console.log(`📹 Video bitrate budget: ${Math.round(videoBitrate/1000)}kbps`);
    
    const result = await optimizeVideoConfigForBitrate(
        codecId, videoBitrate, originalWidth, originalHeight, originalFps, constraints
    );
    
    // Add file size info to result
    result.targetFileSize = targetFileSizeMB;
    result.estimatedFileSize = Math.round((result.bitrate + audioBitrate) * durationSeconds / (8 * 1024 * 1024) * 100) / 100;
    result.videoBitrate = videoBitrate;
    result.audioBitrate = audioBitrate;
    result.duration = durationSeconds;
    
    return result;
}