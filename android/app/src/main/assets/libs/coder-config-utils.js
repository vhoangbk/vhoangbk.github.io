async function fix_format_null(frame) {

    const bitmap = await createImageBitmap(frame);
    const outputFrame = new VideoFrame(bitmap, {
        timestamp: frame.timestamp,
    });
    frame.close();
    bitmap.close();
    return outputFrame;
}

/**
 * Tìm cấu hình VideoDecoder tốt nhất cho keyframe đã cho.
 * ✅ Ưu tiên số 1: Format I420/NV12/NV21 (kiểm tra THỰC TẾ từ decoded frame)
 * ✅ Ưu tiên số 2: Hardware acceleration
 * ✅ Tự động phát hiện codec từ keyframe data
 * ✅ Hỗ trợ: 360p đến 8K, tất cả thiết bị
 * 
 * @param {number} codecId - 27: h264, 173: h265, 226: av1, 167: vp9
 * @param {EncodedVideoChunk} keyframeChunk - Keyframe chunk (bắt buộc)
 * @param {number} [width] - Video width (optional, sẽ auto-detect nếu không có)
 * @param {number} [height] - Video height (optional, sẽ auto-detect nếu không có)
 * @returns {Promise<Object|null>} - {codec, hardwareAcceleration, format, config, score, detectedCodecId}
 */
async function findBestVideoDecoderConfig(codecId, keyframeChunk, width = null, height = null) {
    // ✅ Validate input
    if (!keyframeChunk || !(keyframeChunk instanceof EncodedVideoChunk)) {
        console.error('❌ keyframeChunk must be an EncodedVideoChunk instance');
        return null;
    }

    if (keyframeChunk.type !== 'key') {
        console.warn('⚠️ Warning: chunk is not a keyframe, may fail to decode');
    }

    console.log("findBestVideoDecoderConfig received:", {
        type: keyframeChunk.type,
        timestamp: keyframeChunk.timestamp,
        duration: keyframeChunk.duration,
        byteLength: keyframeChunk.byteLength,
        codecId: codecId
    });

    // ✅ Extract data từ EncodedVideoChunk để auto-detect codec (nếu cần)
    let chunkData = null;
    if (codecId === null) {
        // Copy data ra để detect codec
        chunkData = new Uint8Array(keyframeChunk.byteLength);
        keyframeChunk.copyTo(chunkData);

        codecId = detectCodecFromKeyframe(chunkData);
        if (!codecId) {
            console.error('❌ Cannot detect codec from keyframe data');
            return null;
        }
        console.log(`🔍 Auto-detected codecId: ${codecId} (${getCodecName(codecId)})`);
    }

    const codecLists = {
        27: [ // H.264
            'avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.640028', 'avc1.64001f',
            'avc1.4d0034', 'avc1.4d0033', 'avc1.4d0032', 'avc1.4d0028', 'avc1.4d001f',
            'avc1.42E034', 'avc1.42E028', 'avc1.42E01E',
        ],
        173: [ // H.265
            'hev1.1.6.L186.B0', 'hev1.1.6.L183.B0', 'hev1.1.6.L180.B0',
            'hev1.1.6.L156.B0', 'hev1.1.6.L153.B0', 'hev1.1.6.L150.B0',
            'hev1.1.6.L120.B0', 'hev1.1.6.L93.B0',
            'hvc1.1.6.L186.B0', 'hvc1.1.6.L183.B0', 'hvc1.1.6.L180.B0',
            'hvc1.1.6.L156.B0', 'hvc1.1.6.L153.B0', 'hvc1.1.6.L150.B0',
            'hvc1.1.6.L120.B0', 'hvc1.1.6.L93.B0',
        ],
        226: [ // AV1
            'av01.0.13M.08', 'av01.0.12M.08', 'av01.0.09M.08',
            'av01.0.08M.08', 'av01.0.05M.08', 'av01.0.04M.08',
        ],
        167: [ // VP9
            'vp09.00.51.08', 'vp09.00.50.08', 'vp09.00.41.08',
            'vp09.00.40.08', 'vp09.00.31.08', 'vp09.00.21.08', 'vp09.00.10.08',
        ]
    };

    let codecList = codecLists[codecId];
    if (!codecList) {
        console.error(`❌ Unsupported codecId: ${codecId}`);
        return null;
    }

    const hardwareAccelerationMethods = ['prefer-hardware', 'prefer-software'];
    const preferredFormats = ['I420', 'NV12', 'NV21'];

    const hasResolution = width !== null && height !== null;

    console.log(`🔍 Finding best VideoDecoder for ${getCodecName(codecId)}${hasResolution ? ` (${width}x${height})` : ''}...`);

    let testedCount = 0;
    const hwResults = {}; // ✅ Lưu kết quả cho mỗi hardwareAcceleration

    // ✅ MINIMAL TESTING: Chỉ test 1 codec đầu tiên cho mỗi hwMethod để xác định format
    // Giả sử: format trả về giống nhau cho cùng hardwareAcceleration (nếu supported)
    for (const hwMethod of hardwareAccelerationMethods) {
        console.log(`🔍 Testing ${hwMethod} (minimal test)...`);

        // ✅ Chỉ test codec đầu tiên để xác định format cho hwMethod này
        let detectedFormat = null;
        let detectedWidth = width;
        let detectedHeight = height;

        for (const codecString of codecList) {
            const config = {
                codec: codecString,
                hardwareAcceleration: hwMethod
            };

            if (hasResolution) {
                config.codedWidth = width;
                config.codedHeight = height;
            }

            try {
                const support = await VideoDecoder.isConfigSupported(config);

                if (!support.supported) {
                    console.log(`❌ ${codecString} (${hwMethod}) not supported`);
                    continue;
                }

                // ✅ TEST THỰC TẾ: Decode để xác định format (chỉ 1 lần cho hwMethod này)
                try {
                    const testResult = await testDecoderWithKeyframeChunk(config, keyframeChunk);
                    testedCount++;
                    if (testResult.format == null) testResult.format = 'unknown';
                    if (!testResult || !testResult.format) {
                        console.warn(`⚠️ Failed to decode with ${codecString} (${hwMethod} ${testResult.format})`);
                        continue;
                    }

                    const { format, actualWidth, actualHeight } = testResult;

                    console.log(`✅ ${codecString} (${hwMethod}): format=${format}, resolution=${actualWidth}x${actualHeight}`);

                    // ✅ Lưu format và resolution cho hwMethod này
                    detectedFormat = format;
                    detectedWidth = actualWidth;
                    detectedHeight = actualHeight;

                    // ✅ Cập nhật width/height nếu chưa có
                    if (!hasResolution) {
                        width = actualWidth;
                        height = actualHeight;
                    }

                    console.log(`🚀 Found format for ${hwMethod}: ${format}, testing stopped`);
                    break; // ✅ Dừng ngay sau khi xác định được format

                } catch (e) {
                    console.warn(`⚠️ Failed to test decode ${codecString} (${hwMethod}): ${e.message}`);
                    continue;
                }

            } catch (error) {
                // Bỏ qua codec không support
            }
        }

        // ✅ Nếu xác định được format cho hwMethod này, chọn codec tốt nhất
        if (detectedFormat) {
            // ✅ Tìm codec tốt nhất cho hwMethod này (không cần test thêm)
            let bestCodecForHw = null;
            for (const codecString of codecList) {
                const config = {
                    codec: codecString,
                    hardwareAcceleration: hwMethod
                };

                if (hasResolution) {
                    config.codedWidth = width;
                    config.codedHeight = height;
                }

                try {
                    const support = await VideoDecoder.isConfigSupported(config);
                    if (support.supported) {
                        bestCodecForHw = codecString;
                        break; // ✅ Chọn codec đầu tiên support (là codec tốt nhất)
                    }
                } catch (error) {
                    // Continue to next codec
                }
            }

            if (bestCodecForHw) {
                // ✅ Score dựa trên format đã xác định
                let formatScore = 0;
                const formatIndex = preferredFormats.indexOf(detectedFormat);
                if (formatIndex !== -1) {
                    formatScore = (preferredFormats.length - formatIndex) * 1000;
                } else {
                    formatScore = 100; // Format khác vẫn được chấp nhận
                }

                // ✅ Calculate total score
                let score = formatScore;

                // Hardware acceleration bonus (chỉ khi format đạt yêu cầu)
                if (hwMethod === 'prefer-hardware' && formatScore >= 1000) {
                    score += 500;
                }

                // Codec mới hơn bonus
                const codecIndex = codecList.indexOf(bestCodecForHw);
                score += (codecList.length - codecIndex) * 10;

                // ✅ Lưu kết quả cho hwMethod này
                const finalConfig = {
                    codec: bestCodecForHw,
                    hardwareAcceleration: hwMethod
                };
                if (hasResolution) {
                    finalConfig.codedWidth = width;
                    finalConfig.codedHeight = height;
                }

                hwResults[hwMethod] = {
                    codec: bestCodecForHw,
                    hardwareAcceleration: hwMethod,
                    format: detectedFormat,
                    config: finalConfig,
                    score: score,
                    width: detectedWidth,
                    height: detectedHeight,
                    detectedCodecId: codecId,
                    codecName: getCodecName(codecId)
                };

                console.log(`✅ Selected best codec for ${hwMethod}: ${bestCodecForHw} (format=${detectedFormat}, score=${score})`);

                // ✅ Early exit nếu tìm thấy I420 hardware (config hoàn hảo)
                if (detectedFormat === 'I420' && hwMethod === 'prefer-hardware') {
                    console.log(`🎯 Found optimal config: ${bestCodecForHw} (hardware, I420)`);
                    return hwResults[hwMethod];
                }
            }
        }
    }

    // ✅ So sánh tất cả kết quả và chọn config tốt nhất
    let bestConfig = null;
    let bestScore = -1;

    for (const hwMethod of hardwareAccelerationMethods) {
        if (hwResults[hwMethod] && hwResults[hwMethod].score > bestScore) {
            bestScore = hwResults[hwMethod].score;
            bestConfig = hwResults[hwMethod];
        }
    }

    if (bestConfig) {
        console.log(`✅ Best VideoDecoder config (tested ${testedCount} configs):`, {
            codec: bestConfig.codec,
            codecName: bestConfig.codecName,
            hardwareAcceleration: bestConfig.hardwareAcceleration,
            format: bestConfig.format,
            resolution: `${bestConfig.width}x${bestConfig.height}`,
            score: bestConfig.score
        });
    } else {
        console.error(`❌ No suitable VideoDecoder found for codecId ${codecId}`);
    }

    return bestConfig;
}

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
 * ✅ Tự động phát hiện codec từ keyframe data
 * @param {Uint8Array} data - Keyframe data
 * @returns {number|null} - codecId (27: h264, 173: h265, 226: av1, 167: vp9)
 */
function detectCodecFromKeyframe(data) {
    if (!data || data.length < 5) return null;

    // H.264: NAL unit start code 0x00 0x00 0x00 0x01 hoặc 0x00 0x00 0x01
    // Keyframe: NAL type 5 (0x65) hoặc 7 (SPS, 0x67)
    if ((data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x01) ||
        (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01)) {
        const nalTypeIndex = (data[2] === 0x01) ? 3 : 4;
        const nalType = data[nalTypeIndex] & 0x1F;
        if (nalType === 5 || nalType === 7 || nalType === 8) {
            return 27; // H.264
        }
    }

    // H.265: NAL unit start code + NAL type (19-21 = IRAP frames)
    if ((data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x01) ||
        (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01)) {
        const nalTypeIndex = (data[2] === 0x01) ? 3 : 4;
        const nalType = (data[nalTypeIndex] >> 1) & 0x3F;
        if ((nalType >= 16 && nalType <= 23) || nalType === 32 || nalType === 33) {
            return 173; // H.265
        }
    }

    // VP9: Uncompressed header
    // Frame marker (0b10) + profile (0-3) + show_existing_frame (0/1)
    if ((data[0] & 0xC0) === 0x80) {
        return 167; // VP9
    }

    // AV1: OBU header
    // obu_forbidden_bit (0) + obu_type (1-6)
    if ((data[0] & 0x80) === 0x00) {
        const obuType = (data[0] >> 3) & 0x0F;
        if (obuType >= 1 && obuType <= 6) {
            return 226; // AV1
        }
    }

    return null; // Không phát hiện được
}

/**
 * ✅ HELPER: Lấy tên codec từ codecId
 * @param {number} codecId
 * @returns {string}
 */
function getCodecName(codecId) {
    const names = {
        27: 'H.264',
        173: 'H.265',
        226: 'AV1',
        167: 'VP9'
    };
    return names[codecId] || `Unknown(${codecId})`;
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
 * Find best VideoEncoder config for a given format, original resolution, and target bitrate.
 * Keeps aspect ratio unchanged, ensures browser-supported ranges, and picks config with bitrate closest to target.
 * @param {string} format - 'h264', 'h265', 'av1', 'vp9'
 * @param {number} originalWidth
 * @param {number} originalHeight
 * @param {number} targetBitrate - Desired bitrate in bps
 * @returns {Object|null} - {codec, width, height, framerate, bitrate}
 */
function findBestVideoEncoderConfigForBitrate(format, originalWidth, originalHeight, targetBitrate) {

    const formatToCodecId = { h264: 27, h265: 173, av1: 226, vp9: 167 };
    const codecId = formatToCodecId[format];
    if (!codecId) return null;

    // ✅ Thêm validation cho targetBitrate quá thấp
    const minReasonableBitrate = 100000; // 100kbps
    if (targetBitrate < minReasonableBitrate) {
        console.warn(`⚠️ targetBitrate ${targetBitrate} is very low, adjusting to ${minReasonableBitrate}`);
        // Có thể return config với bitrate thấp nhất có thể thay vì adjust
    }

    const minWidth = 320, maxWidth = 3840;
    const minHeight = 240, maxHeight = 2160;
    const minFps = 12, maxFps = 60;
    const aspectRatio = originalWidth / originalHeight;

    // ✅ Tăng số lượng scale options để có nhiều lựa chọn bitrate thấp hơn
    const scales = [1.0, 0.9, 0.8, 0.75, 0.67, 0.6, 0.5, 0.4, 0.33, 0.25];
    const resolutions = scales.map(scale => {
        let width = Math.round(originalWidth * scale / 2) * 2;
        let height = Math.round(width / aspectRatio / 2) * 2;
        width = Math.max(minWidth, Math.min(maxWidth, width, originalWidth));
        height = Math.max(minHeight, Math.min(maxHeight, height, originalHeight));
        return { width, height };
    });

    const uniqueResolutions = [];
    const seen = new Set();
    for (const r of resolutions) {
        const key = `${r.width}x${r.height}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueResolutions.push(r);
        }
    }

    // ✅ Mở rộng range framerate xuống thấp hơn cho bitrate thấp
    const framerates = [];
    for (let fps = 60; fps >= 5; fps--) {  // Xuống đến 5fps
        framerates.push(fps);
    }


    const codecFactors = { 27: 1.0, 173: 0.7, 226: 0.6, 167: 0.75 };

    let bestConfig = null, bestDiff = Infinity;
    let lowestBitrate = Infinity; // Track bitrate thấp nhất có thể đạt được

    for (const res of uniqueResolutions) {
        if (res.width < minWidth || res.width > maxWidth || res.height < minHeight || res.height > maxHeight) continue;

        for (const fps of framerates) {
            if (fps < 5 || fps > maxFps) continue; // Cho phép fps xuống 5

            const pixelsPerSecond = res.width * res.height * fps;


            const ratio = 8;
            // ✅ Điều chỉnh bitsPerPixelBase để có thể đạt bitrate thấp hơn
            let bitsPerPixelBase = 0.15 / ratio;

            // Giảm bpp cho targetBitrate rất thấp
            if (targetBitrate < 200000) { // < 200kbps
                bitsPerPixelBase = 0.08 / ratio;  // Giảm xuống 0.08 bpp
            } else if (targetBitrate < 500000) { // < 500kbps
                bitsPerPixelBase = 0.1 / ratio;   // Giảm xuống 0.1 bpp
            }

            const codecFactor = codecFactors[codecId] || 1.0;
            const estimatedBitrate = pixelsPerSecond * bitsPerPixelBase * codecFactor;

            // ✅ Track bitrate thấp nhất
            lowestBitrate = Math.min(lowestBitrate, estimatedBitrate);

            const diff = Math.abs(estimatedBitrate - targetBitrate);

            if (diff < bestDiff) {
                bestDiff = diff;
                bestConfig = {
                    codec: format,
                    width: res.width,
                    height: res.height,
                    framerate: fps,
                    bitrate: Math.round(estimatedBitrate)
                };
            }
        }
    }

    // ✅ Nếu không tìm được config gần với targetBitrate, log warning
    if (bestConfig && bestConfig.bitrate > targetBitrate * 2) {
        console.warn(`⚠️ Cannot achieve targetBitrate ${targetBitrate}bps. Closest achievable: ${bestConfig.bitrate}bps (lowest possible: ${Math.round(lowestBitrate)}bps)`);

        // ✅ Option: Có thể force bitrate về targetBitrate (không khuyến nghị vì chất lượng sẽ rất tệ)
        // bestConfig.bitrate = targetBitrate;
    }

    return bestConfig;
}


///======
/**
 * ✅ Tìm cấu hình VideoEncoder tốt nhất bằng test thực tế tốc độ encode
 * Ưu tiên: tốc độ encode nhanh nhất (đo thực tế), hardware acceleration, codec mới hơn.
 * Loop order: Codec -> Hardware -> BitrateMode -> LatencyMode
 * Early exit: Chỉ test codec support đầu tiên, không test hết tất cả codec
 * 
 * @param {number} codecId - 27: h264, 173: h265, 226: av1, 167: vp9
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @param {number} [fps=25] - Frame rate
 * @param {number} [bitrate=0] - Target bitrate (0 = auto calculate)
 * @param {VideoFrame} sampleFrame - Sample VideoFrame để test encode
 * @returns {Promise<Object|null>} - {codec, hardwareAcceleration, bitrateMode, latencyMode, config, score, encodeTimeMs, encodeFps}
 */
async function findBestVideoEncoderConfigWithRealTest(codecId, width, height, fps = 25, bitrate = 0, sampleFrame) {
    // ✅ Validate input
    if (!sampleFrame || !(sampleFrame instanceof VideoFrame)) {
        console.error('❌ sampleFrame must be a VideoFrame instance');
        return null;
    }

    if (sampleFrame.format == null) {
        //  debugger;
        sampleFrame = sampleFrame.clone();
        sampleFrame = await fix_format_null(sampleFrame);
    }
    // ✅ 1. Tạo danh sách codec strings (ưu tiên codec mới hơn)
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

    const codecList = codecLists[codecId];
    if (!codecList) {
        console.error(`❌ Unsupported codecId: ${codecId}`);
        return null;
    }

    // ✅ Auto calculate bitrate
    if (bitrate === 0) {
        bitrate = calculateOptimalBitrate(width, height, fps, codecId);
    }

    // ✅ 2. Loop order: Codec -> Hardware -> BitrateMode -> LatencyMode
    const hardwareAccelerationMethods = ['prefer-hardware', 'prefer-software'];
    const bitrateModes = ['variable', 'constant'];
    const latencyModes = ['quality'];

    let bestConfig = null;
    let fastestEncodeTime = Infinity;
    let testedCount = 0;

    console.log(`🔍 Testing VideoEncoder configs for codecId ${codecId} (${width}x${height}@${fps}fps)...`);

    // ✅ Loop: Codec -> Hardware -> BitrateMode -> LatencyMode
    for (const codecString of codecList) {
        let codecSupported = false; // Track nếu codec này được support
        let hardwareSupported = false; // Track nếu hardware được support

        for (const hwMethod of hardwareAccelerationMethods) {
            // ✅ Skip software nếu hardware đã được support
            if (hwMethod === 'prefer-software' && hardwareSupported) {
                console.log(`⏭️ Skipping software test for ${codecString} (hardware already supported)`);
                break;
            }

            for (const bitrateMode of bitrateModes) {
                for (const latencyMode of latencyModes) {
                    const config = {
                        codec: codecString,
                        width: width,
                        height: height,
                        framerate: fps,
                        bitrate: bitrate,
                        hardwareAcceleration: hwMethod,
                        bitrateMode: bitrateMode,
                        latencyMode: latencyMode
                    };

                    // ✅ Thêm format config cho Safari/Chrome
                    if (codecId === 27) {
                        config.avc = { format: 'annexb' };
                    } else if (codecId === 173) {
                        if (is_safari == true) {
                            config.avc = { format: 'annexb' };
                        } else {
                            config.hevc = { format: 'annexb' };
                        }
                    }

                    try {
                        // ✅ Check support
                        const support = await VideoEncoder.isConfigSupported(config);
                        if (!support.supported) continue;

                        codecSupported = true; // ✅ Codec này được support

                        // ✅ Track hardware support
                        if (hwMethod === 'prefer-hardware') {
                            hardwareSupported = true;
                        }

                        testedCount++;

                        // ✅ 3. Test encode thực tế với sampleFrame
                        const testResult = await testEncoderWithFrame(config, sampleFrame);

                        if (!testResult.success) {
                            console.warn(`⚠️ Encode test failed: ${codecString} (${hwMethod}, ${bitrateMode}, ${latencyMode})`);
                            continue;
                        }

                        const { encodeTimeMs } = testResult;

                        console.log(`✅ Tested ${codecString} (${hwMethod}, ${bitrateMode}, ${latencyMode}): ${encodeTimeMs.toFixed(2)}ms`);

                        // ✅ 4. Lưu config nhanh nhất
                        if (encodeTimeMs < fastestEncodeTime) {
                            fastestEncodeTime = encodeTimeMs;

                            const encodeFps = encodeTimeMs > 0 ? (1000 / encodeTimeMs) : 0;

                            bestConfig = {
                                codec: codecString,
                                hardwareAcceleration: hwMethod,
                                bitrateMode: bitrateMode,
                                latencyMode: latencyMode,
                                config: config,
                                encodeTimeMs: encodeTimeMs,
                                encodeFps: encodeFps,
                                score: 1000000 / encodeTimeMs, // Score cao hơn = nhanh hơn
                                testedCount: testedCount
                            };
                        }

                    } catch (error) {
                        console.warn(`⚠️ Error testing ${codecString}: ${error.message}`);
                        continue;
                    }
                }
            }
        }

        // ✅ 5. Early exit: Nếu codec này được support và đã tìm thấy config, return ngay
        if (codecSupported && bestConfig) {
            console.log(`🎯 Found supported codec: ${codecString}, stopping search`);
            break; // ✅ Không test các codec tiếp theo
        }
    }

    if (bestConfig) {
        console.log(`✅ Best VideoEncoder config (tested ${testedCount} configs):`, {
            codec: bestConfig.codec,
            hardwareAcceleration: bestConfig.hardwareAcceleration,
            bitrateMode: bestConfig.bitrateMode,
            latencyMode: bestConfig.latencyMode,
            resolution: `${width}x${height}`,
            encodeTime: `${bestConfig.encodeTimeMs.toFixed(2)}ms`,
            encodeFps: `${bestConfig.encodeFps.toFixed(1)}fps`,
            score: bestConfig.score.toFixed(0)
        });
    } else {
        console.error(`❌ No suitable VideoEncoder found for codecId ${codecId}`);
        throw new Error(`No suitable VideoEncoder found for codecId ${codecId}`);
    }

    return bestConfig;
}

/**
 * ✅ Test encode thực tế với 1 frame
 * @param {Object} config - VideoEncoder config
 * @param {VideoFrame} sampleFrame - Sample VideoFrame
 * @returns {Promise<Object>} - {success, encodeTimeMs, outputSize}
 */
async function testEncoderWithFrame(config, sampleFrame) {
    return new Promise((resolve) => {
        let encoder = null;
        let resolved = false;
        let startTime = 0;
        let outputSize = 0;

        // ✅ Timeout sau 5 giây
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                if (encoder?.state !== 'closed') {
                    encoder?.close();
                }
                resolve({ success: false, encodeTimeMs: Infinity, outputSize: 0 });
            }
        }, 5000);

        try {
            encoder = new VideoEncoder({
                output: (chunk) => {
                    if (resolved) return;

                    // ✅ Đo thời gian encode
                    const encodeTimeMs = performance.now() - startTime;
                    outputSize += chunk.byteLength;

                    // ✅ Resolve ngay sau chunk đầu tiên
                    clearTimeout(timeout);
                    resolved = true;

                    // ✅ Close encoder
                    Promise.resolve().then(() => {
                        if (encoder?.state !== 'closed') {
                            encoder.close();
                        }
                    });

                    resolve({
                        success: true,
                        encodeTimeMs: encodeTimeMs,
                        outputSize: outputSize
                    });
                },
                error: (e) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        if (encoder?.state !== 'closed') {
                            encoder?.close();
                        }
                        resolve({ success: false, encodeTimeMs: Infinity, outputSize: 0 });
                    }
                }
            });

            encoder.configure(config);

            // ✅ Encode sample frame trực tiếp (không cần clone)
            startTime = performance.now();
            encoder.encode(sampleFrame, { keyFrame: true });

            // ✅ Flush để đảm bảo encode hoàn thành
            encoder.flush().catch((e) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve({ success: false, encodeTimeMs: Infinity, outputSize: 0 });
                }
            });

        } catch (e) {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                if (encoder?.state !== 'closed') {
                    encoder?.close();
                }
                resolve({ success: false, encodeTimeMs: Infinity, outputSize: 0 });
            }
        }
    });
}




// viết function javascript để tìm các thông số width,height,fps với đầu vào là:
// - bitrate mong muốn
// - codecId (27: h264, 173: h265, 226: av1, 167: vp9)
// - width,height,fps ban đầu của video:

// yêu cầu đầu ra: 

// -Giữ nguyên tỉ lệ khung hình, đảm bảo width,height trong phạm vi trình duyệt hỗ trợ
// -fps đầu ra trong khoảng 12-60fps

// cách tiếp cận:
//  - đầu tiên giữ nguyên width,height ban đầu, thay đổi fps để đạt bitrate mong muốn
//  - nếu fps không thể đạt được trong khoảng 12-60fps, thay đổi width,height theo tỉ lệ khung hình để đạt bitrate mong muốn

// Hàm trả về object {width, height, fps} hoặc null nếu không tìm được cấu hình phù hợp





/**
 * ✅ Kiểm tra VideoEncoder có hỗ trợ cấu hình này không
 * @param {number} width - Video width
 * @param {number} height - Video height  
 * @param {number} fps - Frame rate
 * @param {number} codecId - 27: h264, 173: h265, 226: av1, 167: vp9
 * @param {number} bitrate - Target bitrate in bps
 * @param {Object} options - Additional options {hardwareAcceleration, bitrateMode, latencyMode}
 * @returns {Promise<boolean>} - true nếu được hỗ trợ, false nếu không
 */
async function isVideoEncoderConfigSupported(codecId, width, height, fps, bitrate) {
    if (typeof codecId === 'string') {
        const formatToCodecId = { h264: 27, h265: 173, av1: 226, vp9: 167 };
        codecId = formatToCodecId[codecId];
    }

    try {
        // ✅ Validate input parameters
        if (!width || !height || !fps || !codecId || !bitrate) {

            console.error('❌ Missing required parameters');
            return false;
        }

        if (width < 1 || height < 1 || fps < 1 || bitrate < 1) {
            console.error('❌ Invalid parameter values');
            return false;
        }

        // ✅ Map codecId to codec strings (sử dụng codec strings tốt nhất)
        const codecMaps = {
            27: [ // H.264 - Thử từ cao xuống thấp
                'avc1.640034', // High Profile Level 5.2
                'avc1.640028', // High Profile Level 4.0
                'avc1.4d0028', // Main Profile Level 4.0
                'avc1.42E028'  // Baseline Profile Level 4.0
            ],
            173: [ // H.265
                'hev1.1.6.L156.B0', // Main Profile Level 5.1
                'hev1.1.6.L150.B0', // Main Profile Level 5.0
                'hvc1.1.6.L156.B0', // Alternative format
                'hvc1.1.6.L150.B0'
            ],
            226: [ // AV1
                'av01.0.08M.08', // Main Profile Level 4.0
                'av01.0.05M.08', // Main Profile Level 3.1
                'av01.0.04M.08'  // Main Profile Level 3.0
            ],
            167: [ // VP9
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


        // ✅ Test từng codec string cho đến khi tìm thấy support
        for (const codecString of codecStrings) {
            const config = {
                codec: codecString,
                width: width,
                height: height,
                framerate: fps,
                bitrate: bitrate,
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

/**
 * ✅ Tìm cấu hình VideoEncoder tốt nhất cho format, resolution và bitrate cụ thể
 * @param {string} format - 'h264', 'h265', 'av1', 'vp9'
 * @param {number} originalWidth - Width ban đầu
 * @param {number} originalHeight - Height ban đầu  
 * @param {number} targetBitrate - Bitrate mong muốn (bps)
 * @returns {Promise<Object>} - {width, height, framerate, actualBitrate} - Không bao giờ null
 */
async function findBestVideoEncoderConfigForTargetBitrate(format, originalWidth, originalHeight, targetBitrate,originalFps) {
    const formatToCodecId = { h264: 27, h265: 173, av1: 226, vp9: 167 };
    const codecId = formatToCodecId[format];

    if (!codecId) {
        console.warn(`❌ Unknown format: ${format}, defaulting to h264`);
        codecId = 27;
    }

    console.log(`🔍 Finding encoder config for ${format}: ${originalWidth}x${originalHeight} @ ${targetBitrate}bps`);

    // ✅ Constraints của trình duyệt
    const minWidth = 320, maxWidth = 3840;
    const minHeight = 240, maxHeight = 2160;
    const minFps = 12, maxFps = 60;

    // ✅ Tính aspect ratio
    const aspectRatio = originalWidth / originalHeight;

    // ✅ Codec efficiency factors
    const codecFactors = { 27: 1.0, 173: 0.7, 226: 0.6, 167: 0.75 };
    const codecFactor = codecFactors[codecId] || 1.0;

    // ✅ Danh sách scale từ lớn xuống nhỏ (ưu tiên resolution cao)
    const scales = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.67, 0.6, 0.5, 0.45, 0.4, 0.35, 0.33, 0.3, 0.25, 0.2];

    // ✅ Danh sách fps từ thấp đến cao (ưu tiên fps thấp để có resolution cao hơn)
    const framerates = [15, 24, 25, 30, 45, 50, 60];

    // ✅ Generate resolution candidates (giữ aspect ratio)
    const resolutionCandidates = [];

    for (const scale of scales) {
        let width = Math.round(originalWidth * scale / 2) * 2; // Even numbers
        let height = Math.round(width / aspectRatio / 2) * 2;

        // ✅ Clamp to browser limits
        width = Math.max(minWidth, Math.min(maxWidth, width));
        height = Math.max(minHeight, Math.min(maxHeight, height));

        // ✅ Không vượt quá original size
        width = Math.min(width, originalWidth);
        height = Math.min(height, originalHeight);

        // ✅ Verify aspect ratio không bị méo quá nhiều
        const newAspectRatio = width / height;
        const aspectDiff = Math.abs(newAspectRatio - aspectRatio) / aspectRatio;

        if (aspectDiff < 0.05) { // Cho phép sai lệch < 5%
            const key = `${width}x${height}`;
            if (!resolutionCandidates.find(r => `${r.width}x${r.height}` === key)) {
                resolutionCandidates.push({ width, height, scale });
            }
        }
    }

    console.log(`📏 Generated ${resolutionCandidates.length} resolution candidates`);

    let bestConfig = null;
    let bestScore = -1;

    // ✅ Test từng combination (ưu tiên resolution cao trước)
    for (const res of resolutionCandidates) {
        console.log(`🧪 Testing resolution: ${res.width}x${res.height} (scale: ${res.scale.toFixed(2)})`);

        for (const fps of framerates) {
            if (fps < minFps || fps > maxFps) continue;

            // ✅ Calculate required bits per pixel cho targetBitrate
            const pixelsPerSecond = res.width * res.height * fps;
            const requiredBpp = (targetBitrate / codecFactor) / pixelsPerSecond;

            // ✅ Kiểm tra bpp có reasonable không (0.02 - 0.8 bpp)
            if (requiredBpp < 0.04 || requiredBpp > 0.3) {
                continue; // Bỏ qua config có bpp quá thấp hoặc quá cao
            }

            console.log(` ===================  🔍 Testing ${res.width}x${res.height}@${fps}fps (bpp: ${requiredBpp.toFixed(3)})`);

          //  debugger;
            // ✅ Test if this config is supported
            const isSupported = await isVideoEncoderConfigSupported(codecId, res.width, res.height, fps, targetBitrate);

            if (isSupported) {
                // ✅ Calculate actual bitrate với bpp reasonable
                const actualBitrate = Math.round(pixelsPerSecond * Math.min(requiredBpp, 0.3) * codecFactor);

                // ✅ Calculate score: Ưu tiên resolution cao, fps phù hợp, bitrate gần target
                const resolutionScore = (res.width * res.height) / (originalWidth * originalHeight); // 0-1
                const fpsScore = fps <= 30 ? 1.0 : (60 - fps) / 30; // Ưu tiên fps <= 30
                const bitrateAccuracy = 1 - Math.abs(actualBitrate - targetBitrate) / targetBitrate; // 0-1

                const totalScore = resolutionScore * 1000 + fpsScore * 100 + bitrateAccuracy * 50;

                console.log(`   ✅ Supported! Score: ${totalScore.toFixed(1)} (res:${resolutionScore.toFixed(2)}, fps:${fpsScore.toFixed(2)}, bitrate:${bitrateAccuracy.toFixed(2)})`);

                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestConfig = {
                        width: res.width,
                        height: res.height,
                        framerate: fps,
                        actualBitrate: actualBitrate,
                        format: format,
                        scale: res.scale,
                        score: totalScore
                    };
                }

                // ✅ Early exit nếu đã tìm được config tốt với resolution cao
                if (resolutionScore > 0.8 && bitrateAccuracy > 0.8) {
                    console.log(`🎯 Found optimal config early: ${res.width}x${res.height}@${fps}fps`, requiredBpp);
                    break;
                }
            } else {
                console.log(`   ❌ Not supported: ${res.width}x${res.height}@${fps}fps`);
            }
        }

        // ✅ Break nếu đã tìm được config tốt (không test resolution nhỏ hơn nữa)
        if (bestConfig && bestConfig.scale > 0.5) {
            console.log(`🎯 Found good config, stopping search at scale ${bestConfig.scale}`);
            break;
        }
    }

    // ✅ Nếu không tìm thấy config nào, return fallback config an toàn
    if (!bestConfig) {
        console.warn(`⚠️ No optimal config found for ${format}, using fallback`);

        let fallbackWidth = Math.max(minWidth, Math.min(640, originalWidth));
        let fallbackHeight = Math.max(minHeight, Math.round(fallbackWidth / aspectRatio / 2) * 2);

        // ✅ Ensure fallback height is within limits
        if (fallbackHeight > maxHeight) {
            fallbackHeight = maxHeight;
            fallbackWidth = Math.round(fallbackHeight * aspectRatio / 2) * 2;
        }

        const fallbackFps = 24;
        const fallbackBitrate = Math.min(targetBitrate, calculateOptimalBitrate(fallbackWidth, fallbackHeight, fallbackFps, codecId));

        bestConfig = {
            width: fallbackWidth,
            height: fallbackHeight,
            framerate: fallbackFps,
            actualBitrate: fallbackBitrate,
            format: format,
            scale: fallbackWidth / originalWidth,
            score: 0
        };
    }

    console.log(`✅ Best encoder config for ${format}:`, {
        resolution: `${bestConfig.width}x${bestConfig.height}`,
        framerate: `${bestConfig.framerate}fps`,
        targetBitrate: `${targetBitrate}bps`,
        actualBitrate: `${bestConfig.actualBitrate}bps`,
        scale: `${(bestConfig.scale * 100).toFixed(1)}%`,
        score: bestConfig.score.toFixed(1)
    });

    return {
        width: bestConfig.width,
        height: bestConfig.height,
        framerate: bestConfig.framerate,
        actualBitrate: bestConfig.actualBitrate
    };
}