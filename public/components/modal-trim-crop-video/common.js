function preventDefault(e) {
  e.preventDefault();
  e.stopPropagation();
}

function $(id) {
  return document.getElementById(id);
}

function getEl(selector) {
  return document.querySelector(selector);
}

function getEls(selector) {
  return document.querySelectorAll(selector);
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function timeStringToSeconds(timeStr) {
  if (!timeStr) return 0;

  const parts = timeStr.split(':').map(Number);
  let seconds = 0;

  switch (parts.length) {
    case 1: { // ss
      const [s] = parts;
      seconds = s;
      break;
    }
    case 2: { // mm:ss
      const [m, s] = parts;
      seconds = m * 60 + s;
      break;
    }
    case 3: { // hh:mm:ss
      const [h, m, s] = parts;
      seconds = h * 3600 + m * 60 + s;
      break;
    }
    case 4: { // dd:hh:mm:ss
      const [d, h, m, s] = parts;
      seconds = d * 86400 + h * 3600 + m * 60 + s;
      break;
    }
    case 5: { // ww:dd:hh:mm:ss
      const [w, d, h, m, s] = parts;
      seconds = w * 604800 + d * 86400 + h * 3600 + m * 60 + s;
      break;
    }
    case 6: { // MM:ww:dd:hh:mm:ss
      const [mo, w, d, h, m, s] = parts;
      seconds = mo * 2592000 + w * 604800 + d * 86400 + h * 3600 + m * 60 + s;
      break;
    }
    default:
      seconds = 0;
  }
  return seconds;
}

function parseRatio(ratioString) {
  const ratios = {
    '1:1': { width: 1, height: 1 },
    '16:9': { width: 16, height: 9 },
    '9:16': { width: 9, height: 16 },
    '4:3': { width: 4, height: 3 },
    'custom': null
  };
  return ratios[ratioString] || null;
}

function getCursorForHandle(handle) {
  switch (handle) {
    case 'tl': return 'nw-resize';
    case 'tr': return 'ne-resize';
    case 'bl': return 'sw-resize';
    case 'br': return 'se-resize';
    default: return 'default';
  }
}

function getScaledMouseDelta(ev, pointerStart, stageDims) {
  const scaleRatio = stageDims.scaleRatio;
  const dx = (ev.clientX - pointerStart.x) / scaleRatio;
  const dy = (ev.clientY - pointerStart.y) / scaleRatio;
  return { dx: Math.round(dx), dy: Math.round(dy) };
}

function getMTCVStageDimensions() {
  if (!mtcv_stage) {
    console.warn('mtcv_stage not found, using default dimensions');
    return {
      originalWidth: 298,
      originalHeight: 200,
      scaleRatio: 1,
      scaledWidth: 298,
      scaledHeight: 200
    };
  }

  const mtcv_mediaContainerRect = mtcv_mediaContainer.getBoundingClientRect();
  const width = Math.round(mtcv_mediaContainerRect.width);
  const height = Math.round(mtcv_mediaContainerRect.height);

  return {
    originalWidth: width,
    originalHeight: height,
    scaleRatio: 1,
    scaledWidth: width,
    scaledHeight: height
  };
}

function calculateScaleFactors(mediaWidth, mediaHeight, origWidth, origHeight) {
  return {
    scaleX: mediaWidth / origWidth,
    scaleY: mediaHeight / origHeight
  };
}

function scaledToOriginal(scaledX, scaledY, scaledW, scaledH, scaleX, scaleY, origWidth = null, origHeight = null) {
  const scaleMin = Math.min(scaleX, scaleY);
  let result = {
    x: Math.max(0, Math.round(scaledX / scaleMin)),
    y: Math.max(0, Math.round(scaledY / scaleMin)),
    width: Math.max(1, Math.round(scaledW / scaleMin)),
    height: Math.max(1, Math.round(scaledH / scaleMin))
  };

  // Đảm bảo width/height không vượt quá kích thước gốc
  if (origWidth !== null && origHeight !== null) {
    result.width = Math.min(result.width, origWidth);
    result.height = Math.min(result.height, origHeight);

    // Đảm bảo x + width không vượt quá origWidth
    if (result.x + result.width > origWidth) {
      result.x = Math.max(0, origWidth - result.width);
    }

    // Đảm bảo y + height không vượt quá origHeight
    if (result.y + result.height > origHeight) {
      result.y = Math.max(0, origHeight - result.height);
    }
  }

  return result;
}

function originalToScaled(origX, origY, origW, origH, scaleX, scaleY) {
  return {
    x: Math.round(origX * scaleX),
    y: Math.round(origY * scaleY),
    width: Math.round(origW * scaleX),
    height: Math.round(origH * scaleY)
  };
}

function constrainCropBox(box, mediaWidth, mediaHeight, minSize, origWidth = null, origHeight = null) {
  const maxW = origWidth !== null ? origWidth : mediaWidth;
  const maxH = origHeight !== null ? origHeight : mediaHeight;
  
  if (box.w < minSize) box.w = minSize;
  if (box.h < minSize) box.h = minSize;
  
  // ✅ SỬA: Cho phép width/height đạt max (mediaWidth/mediaHeight)
  if (box.w > mediaWidth) box.w = mediaWidth;
  if (box.h > mediaHeight) box.h = mediaHeight;

  box.w = roundToEven(box.w, mediaWidth);
  box.h = roundToEven(box.h, mediaHeight);

  if (box.x < 0) box.x = 0;
  if (box.y < 0) box.y = 0;

  // ✅ SỬA: Đảm bảo có thể đạt max width/height
  // Nếu box.w = mediaWidth, đảm bảo box.x = 0
  if (box.w === mediaWidth) {
    box.x = 0;
  } else if (box.x + box.w > mediaWidth) {
    box.x = mediaWidth - box.w;
    if (box.x < 0) {
      box.x = 0;
      box.w = roundToEven(mediaWidth, mediaWidth);
    }
  }

  // ✅ Tương tự cho height
  if (box.h === mediaHeight) {
    box.y = 0;
  } else if (box.y + box.h > mediaHeight) {
    box.y = mediaHeight - box.h;
    if (box.y < 0) {
      box.y = 0;
      box.h = roundToEven(mediaHeight, mediaHeight);
    }
  }
  
  return box;
}

function snapHandleToCorner(box, corner, mediaWidth, mediaHeight, threshold = 20) {
  const nearTop = box.y < threshold;
  const nearBottom = box.y + box.h > mediaHeight - threshold;
  const nearLeft = box.x < threshold;
  const nearRight = box.x + box.w > mediaWidth - threshold;

  switch (corner) {
    case 'tl':
      if (nearTop) box.y = 0;
      if (nearLeft) box.x = 0;
      break;
    case 'tr':
      if (nearTop) box.y = 0;
      if (nearRight) box.x = mediaWidth - box.w;
      break;
    case 'bl':
      if (nearBottom) box.y = mediaHeight - box.h;
      if (nearLeft) box.x = 0;
      break;
    case 'br':
      if (nearBottom) box.y = mediaHeight - box.h;
      if (nearRight) box.x = mediaWidth - box.w;
      break;
  }

  if (box.x < 0) box.x = 0;
  if (box.y < 0) box.y = 0;
  if (box.x + box.w > mediaWidth) box.x = mediaWidth - box.w;
  if (box.y + box.h > mediaHeight) box.y = mediaHeight - box.h;

  return box;
}

function applyRatioConstraints(box, ratio, mediaWidth, mediaHeight, minSize) {
  if (!ratio) return box;

  const aspectRatio = ratio.width / ratio.height;
  let newWidth = box.w;
  let newHeight = box.h;

  if (newWidth > mediaWidth) {
    newWidth = mediaWidth;
    newHeight = calculateDimensionFromRatio(newWidth, ratio, true);
  }
  if (newHeight > mediaHeight) {
    newHeight = mediaHeight;
    newWidth = calculateDimensionFromRatio(newHeight, ratio, false);
  }

  if (newWidth <= mediaWidth && newHeight <= mediaHeight) {
    const currentRatio = newWidth / newHeight;
    if (Math.abs(currentRatio - aspectRatio) > 0.001) {
      if (newWidth >= newHeight * aspectRatio) {
        newHeight = calculateDimensionFromRatio(newWidth, ratio, true);
      } else {
        newWidth = calculateDimensionFromRatio(newHeight, ratio, false);
      }
    }
  }

  const minWidth = minSize;
  const minHeight = calculateDimensionFromRatio(minWidth, ratio, true);

  if (newWidth < minWidth) {
    newWidth = minWidth;
    newHeight = calculateDimensionFromRatio(newWidth, ratio, true);
  }
  if (newHeight < minHeight) {
    newHeight = minHeight;
    newWidth = calculateDimensionFromRatio(newHeight, ratio, false);
  }

  if (newWidth > mediaWidth) {
    newWidth = mediaWidth;
    newHeight = calculateDimensionFromRatio(newWidth, ratio, true);
  }
  if (newHeight > mediaHeight) {
    newHeight = mediaHeight;
    newWidth = calculateDimensionFromRatio(newHeight, ratio, false);
  }

  const final = ensureExactRatio(newWidth, newHeight, ratio, newWidth >= newHeight);
  
  if (final.width > mediaWidth) {
    final.width = mediaWidth;
    final.height = calculateDimensionFromRatio(final.width, ratio, true);
  }
  if (final.height > mediaHeight) {
    final.height = mediaHeight;
    final.width = calculateDimensionFromRatio(final.height, ratio, false);
  }

  box.w = final.width;
  box.h = final.height;
  return box;
}

function handleResizeTL(box, boxStart, dx, dy, mediaWidth, mediaHeight, minSize) {
  const newW = boxStart.w - dx;
  const newH = boxStart.h - dy;

  // ✅ SỬA: Cho phép đạt max width với threshold lớn hơn
  if (newW >= boxStart.x + boxStart.w - 5) {
    box.w = roundToEven(boxStart.x + boxStart.w, mediaWidth);
    box.x = 0;
  } else {
    const maxW = boxStart.x + boxStart.w;
    box.w = Math.max(minSize, Math.min(newW, maxW));
    box.w = roundToEven(box.w, mediaWidth);
    box.x = boxStart.x + (boxStart.w - box.w);
  }

  // ✅ Tương tự cho height với threshold lớn hơn
  if (newH >= boxStart.y + boxStart.h - 5) {
    box.h = roundToEven(boxStart.y + boxStart.h, mediaHeight);
    box.y = 0;
  } else {
    const maxH = boxStart.y + boxStart.h;
    box.h = Math.max(minSize, Math.min(newH, maxH));
    box.h = roundToEven(box.h, mediaHeight);
    box.y = boxStart.y + (boxStart.h - box.h);
  }

  return box;
}

function handleResizeTR(box, boxStart, dx, dy, mediaWidth, mediaHeight, minSize) {
  const newW = boxStart.w + dx;
  const newH = boxStart.h - dy;

  // ✅ SỬA: Cho phép đạt max width với threshold lớn hơn
  const distanceToRightEdge = mediaWidth - (boxStart.x + boxStart.w);
  const isNearRightEdge = newW >= mediaWidth - boxStart.x - 10 || (boxStart.x + newW) >= mediaWidth - 10;
  
  if (isNearRightEdge) {
    box.w = roundToEven(mediaWidth - boxStart.x, mediaWidth);
    box.x = boxStart.x;
  } else {
    const maxW = mediaWidth - boxStart.x;
    box.w = Math.max(minSize, Math.min(newW, maxW));
    box.w = roundToEven(box.w, mediaWidth);
    box.x = boxStart.x;
  }

  // ✅ Cho height
  const maxH = boxStart.y + boxStart.h;
  box.h = Math.max(minSize, Math.min(newH, maxH));
  box.h = roundToEven(box.h, mediaHeight);
  box.y = boxStart.y + (boxStart.h - box.h);

  return box;
}

function handleResizeBL(box, boxStart, dx, dy, mediaWidth, mediaHeight, minSize) {
  const newW = boxStart.w - dx;
  const newH = boxStart.h + dy;

  const maxW = boxStart.x + boxStart.w;
  box.w = Math.max(minSize, Math.min(newW, maxW));
  box.w = roundToEven(box.w, mediaWidth);
  box.x = boxStart.x + (boxStart.w - box.w);

  // ✅ SỬA: Cho phép đạt max height với threshold lớn hơn
  if (newH >= mediaHeight - boxStart.y - 5) {
    box.h = roundToEven(mediaHeight - boxStart.y, mediaHeight);
    box.y = boxStart.y;
  } else {
    const maxH = mediaHeight - boxStart.y;
    box.h = Math.max(minSize, Math.min(newH, maxH));
    box.h = roundToEven(box.h, mediaHeight);
    box.y = boxStart.y;
  }

  return box;
}

function handleResizeBR(box, boxStart, dx, dy, mediaWidth, mediaHeight, minSize) {
  const newW = boxStart.w + dx;
  const newH = boxStart.h + dy;

  // ✅ SỬA: Cho phép đạt max width/height bằng cách điều chỉnh cả x và w
  // Tăng threshold và kiểm tra cả điều kiện kéo về phía right edge
  const distanceToRightEdge = mediaWidth - (boxStart.x + boxStart.w);
  const isNearRightEdge = newW >= mediaWidth - boxStart.x - 10 || (boxStart.x + newW) >= mediaWidth - 10;
  
  if (isNearRightEdge) {
    // ✅ Cho phép đạt full width
    box.w = roundToEven(mediaWidth, mediaWidth);
    box.x = 0;
  } else {
    const maxW = mediaWidth - boxStart.x;
    box.w = Math.max(minSize, Math.min(newW, maxW));
    box.w = roundToEven(box.w, mediaWidth);
    box.x = boxStart.x;
  }

  // ✅ Tương tự cho height
  const distanceToBottomEdge = mediaHeight - (boxStart.y + boxStart.h);
  const isNearBottomEdge = newH >= mediaHeight - boxStart.y - 10 || (boxStart.y + newH) >= mediaHeight - 10;
  
  if (isNearBottomEdge) {
    // ✅ Cho phép đạt full height
    box.h = roundToEven(mediaHeight, mediaHeight);
    box.y = 0;
  } else {
    const maxH = mediaHeight - boxStart.y;
    box.h = Math.max(minSize, Math.min(newH, maxH));
    box.h = roundToEven(box.h, mediaHeight);
    box.y = boxStart.y;
  }

  return box;
}

function setupEventListener(element, event, handler, options = {}) {
  element.addEventListener(event, handler, options);
  return () => element.removeEventListener(event, handler, options);
}


function updateElementStyle(element, styles) {
  if (!element) return;

  const cssStyles = {};
  const domProperties = {};

  Object.entries(styles).forEach(([key, value]) => {
    if (key === 'textContent' || key === 'innerHTML' || key === 'innerText') {
      domProperties[key] = value;
    } else {
      cssStyles[key] = value;
    }
  });

  if (Object.keys(cssStyles).length > 0) {
    Object.assign(element.style, cssStyles);
  }

  Object.entries(domProperties).forEach(([key, value]) => {
    element[key] = value;
  });
}

function toggleClassForElements(elements, className, add = true) {
  elements.forEach(el => {
    if (el) {
      if (add) {
        el.classList.add(className);
      } else {
        el.classList.remove(className);
      }
    }
  });
}

function setupElementEvents(element, eventConfigs) {
  const cleanupFunctions = [];

  eventConfigs.forEach(({ event, handler, options }) => {
    element.addEventListener(event, handler, options);
    cleanupFunctions.push(() => element.removeEventListener(event, handler, options));
  });

  return () => cleanupFunctions.forEach(cleanup => cleanup());
}

function calculateTimeFromPosition(clientX, container, videoDuration, handleOffset = 7) {
  const rect = container.getBoundingClientRect();
  const adjustedX = Math.max(handleOffset, Math.min(clientX - rect.left, rect.width - handleOffset));
  const dragPercent = ((adjustedX - handleOffset) / (rect.width - handleOffset * 2)) * 100;
  return (dragPercent / 100) * videoDuration;
}

function constrainTimeInRange(time, minTime, maxTime) {
  return Math.max(minTime, Math.min(time, maxTime));
}

function timeToPercent(time, duration) {
  return (time / duration) * 100;
}

function createDragHandler(calculateTime, updatePosition) {
  return function (e) {
    if (!mtcv_isDragging) return;
    const newTime = calculateTime(e.clientX);
    updatePosition(newTime);
  };
}

function createTouchDragHandler(calculateTime, updatePosition) {
  return function (e) {
    if (!mtcv_isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const newTime = calculateTime(touch.clientX);
    updatePosition(newTime);
  };
}

function calculateMinGapPercent() {
  if (!mtcv_progressContainer || !mtcv_minPixelDistance) {
    return 0;
  }
  const containerWidth = mtcv_progressContainer.offsetWidth || 0;
  if (containerWidth <= 0) {
    return 0;
  }
  return (mtcv_minPixelDistance / containerWidth) * 100;
}

function updateProgressElements(elements, percentages) {
  const { currentPercent, startPercent, endPercent } = percentages;
  
  let effectiveStart = startPercent;
  let effectiveEnd = endPercent;
  
  if (mtcv_isDragging && mtcv_dragTarget) {
    // Khi đang drag, chỉ điều chỉnh handle ĐANG ĐƯỢC KÉO để không trồng lên handle kia
    // Handle không được kéo giữ nguyên vị trí
    const minGapPercent = calculateMinGapPercent();
    
    if (mtcv_dragTarget === 'start') {
      // Đang kéo start handle: chỉ điều chỉnh start để không quá gần end
      if ((endPercent - startPercent) < minGapPercent) {
        effectiveStart = endPercent - minGapPercent;
        if (effectiveStart < 0) {
          effectiveStart = 0;
        }
        // endPercent giữ nguyên (không thay đổi)
      }
    } else if (mtcv_dragTarget === 'end') {
      // Đang kéo end handle: chỉ điều chỉnh end để không quá gần start
      if ((endPercent - startPercent) < minGapPercent) {
        effectiveEnd = startPercent + minGapPercent;
        if (effectiveEnd > 100) {
          effectiveEnd = 100;
        }
        // startPercent giữ nguyên (không thay đổi)
      }
    }
  } else {
    // Khi không drag, dùng enforceHandleSpacing như cũ
    const spaced = enforceHandleSpacing(startPercent, endPercent);
    effectiveStart = spaced.startPercent;
    effectiveEnd = spaced.endPercent;
  }

  if (elements.currentTimeLine) {
    updateElementStyle(elements.currentTimeLine, { left: `${currentPercent}%` });
  }

  if (elements.selectedRange) {
    updateElementStyle(elements.selectedRange, {
      left: `${effectiveStart}%`,
      width: `${effectiveEnd - effectiveStart}%`
    });
  }

  if (elements.startHandle) {
    updateElementStyle(elements.startHandle, { left: `${effectiveStart}%` });
  }

  if (elements.endHandle) {
    updateElementStyle(elements.endHandle, { left: `${effectiveEnd}%` });
  }
}

function createProgressClickHandler(container, videoDuration, constrainFunction) {
  return function (e) {
    if (this.isDragging) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = (clickX / rect.width) * 100;
    const newTime = (clickPercent / 100) * videoDuration;

    const constrainedTime = constrainFunction(newTime);
    mtcv_displayedVideo.currentTime = constrainedTime;
  };
}

function createTouchProgressHandler(container, videoDuration, constrainFunction) {
  return function (e) {
    if (this.isDragging) return;

    e.preventDefault();
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const clickX = touch.clientX - rect.left;
    const clickPercent = (clickX / rect.width) * 100;
    const newTime = (clickPercent / 100) * videoDuration;

    const constrainedTime = constrainFunction(newTime);
    mtcv_displayedVideo.currentTime = constrainedTime;
  };
}

function updateElementText(element, text) {
  if (!element) return;
  element.textContent = text;
}

function getCurrentCropConfig(mtcv_box, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_origWidth, mtcv_origHeight, mtcv_startTime, mtcv_endTime, mtcv_flipState, mtcv_currentRatio) {
  if (!mtcv_mediaWidth || !mtcv_mediaHeight) return null;

  const { scaleX, scaleY } = calculateScaleFactors(mtcv_mediaWidth, mtcv_mediaHeight, mtcv_origWidth, mtcv_origHeight);
  let { x: origX, y: origY, width: origW, height: origH } = scaledToOriginal(
    mtcv_box.x, mtcv_box.y, mtcv_box.w, mtcv_box.h, scaleX, scaleY, mtcv_origWidth, mtcv_origHeight
  );

  if (mtcv_currentRatio) {
    const ratioCorrected = ensureExactRatio(origW, origH, mtcv_currentRatio, origW >= origH);
    origW = ratioCorrected.width;
    origH = ratioCorrected.height;
  }

  let finalWidth = Math.min(origW, mtcv_origWidth);
  let finalHeight = Math.min(origH, mtcv_origHeight);
  
  if (mtcv_currentRatio) {
    if (finalWidth < origW) {
      finalHeight = calculateDimensionFromRatio(finalWidth, mtcv_currentRatio, true);
      if (finalHeight > mtcv_origHeight) {
        finalHeight = mtcv_origHeight;
        finalWidth = calculateDimensionFromRatio(finalHeight, mtcv_currentRatio, false);
      }
    }
    else if (finalHeight < origH) {
      finalWidth = calculateDimensionFromRatio(finalHeight, mtcv_currentRatio, false);
      if (finalWidth > mtcv_origWidth) {
        finalWidth = mtcv_origWidth;
        finalHeight = calculateDimensionFromRatio(finalWidth, mtcv_currentRatio, true);
      }
    }
    
    const finalRatioCorrected = ensureExactRatio(finalWidth, finalHeight, mtcv_currentRatio, finalWidth >= finalHeight);
    finalWidth = finalRatioCorrected.width;
    finalHeight = finalRatioCorrected.height;
    
    if (finalWidth > mtcv_origWidth) {
      finalWidth = mtcv_origWidth;
      finalHeight = calculateDimensionFromRatio(finalWidth, mtcv_currentRatio, true);
    }
    if (finalHeight > mtcv_origHeight) {
      finalHeight = mtcv_origHeight;
      finalWidth = calculateDimensionFromRatio(finalHeight, mtcv_currentRatio, false);
    }
  }
  
  const finalX = Math.min(origX, Math.max(0, mtcv_origWidth - finalWidth));
  const finalY = Math.min(origY, Math.max(0, mtcv_origHeight - finalHeight));

  const finalWidthEven  = roundToEven(finalWidth,  mtcv_origWidth);
  const finalHeightEven = roundToEven(finalHeight, mtcv_origHeight);

  // ✅ Chỉ làm tròn width và height, KHÔNG làm tròn x và y
  return {
    width: finalWidthEven,
    height: finalHeightEven,
    x: finalX, // ✅ Không làm tròn
    y: finalY, // ✅ Không làm tròn
    originalWidth: mtcv_origWidth,
    originalHeight: mtcv_origHeight,
    startTime: mtcv_startTime,
    endTime: mtcv_endTime,
    flip: mtcv_flipState,
    ratio: mtcv_currentRatio
  };
}

function showSaveConfirmation() {
  return confirm('You have unsaved changes. Do you want to save them?');
}

function closeModal(modalSelector, buttonSelector) {
  const modal = getEl(modalSelector);
  const button = getEl(buttonSelector);

  if (modal) {
    modal.classList.remove('mtcv-show');
    document.documentElement.classList.remove('mtcv-open');
    
    // ✅ Reset mtcv_action để restore scroll (nếu đang drag crop-box)
    if (typeof window.resetMTCVAction === 'function') {
      window.resetMTCVAction();
    }
    
    // ✅ Restore scroll khi đóng modal
    // Lấy scroll position đã lưu từ body style top
    const scrollY = document.body.style.top;
    const scrollPosition = scrollY ? parseInt(scrollY.replace('px', '').replace('-', '')) : 0;
    
    // ✅ Restore body styles
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.height = '';
    
    // ✅ Restore html/documentElement styles
    document.documentElement.style.overflow = '';
    document.documentElement.style.position = '';
    document.documentElement.style.width = '';
    document.documentElement.style.height = '';
    document.documentElement.style.left = '';
    document.documentElement.style.right = '';
    document.documentElement.style.top = '';
    
    // ✅ Remove classes
    document.body.classList.remove('dialog-open');
    document.documentElement.classList.remove('dialog-open');
    
    // ✅ Restore scroll position sau khi remove fixed position
    if (scrollPosition > 0) {
      // Dùng requestAnimationFrame để đảm bảo styles đã được apply
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
        document.documentElement.scrollTop = scrollPosition;
      });
    }
    
    setTimeout(() => modal.style.display = 'none', 300);
  }
  if (button) {
    button.classList.remove('advance-btn-active');
  }
}

function getProgressHandleWidthPx(className = '') {
  const handleElement = document.querySelector(className);
  if (!handleElement) {
    console.warn('Progress handle element not found');
    return 0;
  }
  const style = getComputedStyle(handleElement);
  const widthPx = parseFloat(style.borderWidth) * 2 + parseFloat(style.width);
  return widthPx;
}

function setupFlipControls() {
  const flipButtons = getEls('[data-flip]');

  flipButtons.forEach(button => {
    button.addEventListener('click', function () {
      const flipType = this.dataset.flip;

      mtcv_flipState[flipType] = !mtcv_flipState[flipType];

      if (mtcv_flipState[flipType]) {
        this.classList.add('mtcv-flip-btn-active');
      } else {
        this.classList.remove('mtcv-flip-btn-active');
      }

      applyFlipToVideo();
    });
  });
}

function setupRatioButtons() {
  const ratioButtons = getEls('[data-ratio]');

  ratioButtons.forEach(button => {
    button.addEventListener('click', function () {
      const ratio = parseRatio(this.dataset.ratio);
      const position = calculateCropBoxPosition(ratio);
      if (position) {
        updateCropBoxWithRatio(position, ratio);
        updateCropConfig();
        toggleClassForElements(ratioButtons, 'mtcv-crop-ratios-active', false);
        this.classList.add('mtcv-crop-ratios-active');
      }
    });
  });
}

function applyFlipToVideo() {
  if (!mtcv_displayedVideo) return;
  mtcv_displayedVideo.classList.remove('flip-vertical', 'flip-horizontal', 'flip-both');
  if (mtcv_flipState.vertical && mtcv_flipState.horizontal) {
    mtcv_displayedVideo.classList.add('flip-both');
  } else if (mtcv_flipState.vertical) {
    mtcv_displayedVideo.classList.add('flip-vertical');
  } else if (mtcv_flipState.horizontal) {
    mtcv_displayedVideo.classList.add('flip-horizontal');
  }
}

function calculateCropBoxPosition(ratio) {
  if (!mtcv_mediaContainer || !mtcv_displayedVideo) return null;
  const videoDisplayWidth = mtcv_mediaWidth;
  const videoDisplayHeight = mtcv_mediaHeight;

  let cropWidth, cropHeight;

  if (ratio) {
    const aspectRatio = ratio.width / ratio.height;
    const limitWidth80 = videoDisplayWidth * 0.8;
    const limitHeight80 = videoDisplayHeight * 0.8;

    const potentialH_fromW = limitWidth80 / aspectRatio;
    const potentialW_fromH = limitHeight80 * aspectRatio;

    let tempW = 0, tempH = 0;
    if (potentialH_fromW <= limitHeight80) {
      tempW = Math.min(limitWidth80, videoDisplayWidth);
      tempH = tempW / aspectRatio;
    } else {
      tempW = potentialW_fromH;
      tempH = Math.min(limitHeight80, videoDisplayHeight);
    }

    tempW = Math.min(tempW, videoDisplayWidth);
    tempH = Math.min(tempH, videoDisplayHeight);

    const isSquareRatio = Math.abs(ratio.width - ratio.height) < 0.001 && Math.abs(aspectRatio - 1) < 0.001;

    if (isSquareRatio) {
      let size = Math.floor(Math.min(tempW, tempH));
      size = Math.max(size, mtcv_minSize);
      size = Math.min(size, videoDisplayWidth, videoDisplayHeight);
      cropWidth = cropHeight = size;
    } else {
      let w = Math.round(tempW);
      let h = calculateDimensionFromRatio(w, ratio, true);

      if (h > tempH || h > videoDisplayHeight) {
        h = Math.round(tempH);
        w = calculateDimensionFromRatio(h, ratio, false);

        if (w > videoDisplayWidth) {
          w = Math.floor(videoDisplayWidth);
          h = calculateDimensionFromRatio(w, ratio, true);
        }
      }

      const minW = mtcv_minSize;
      const minH = calculateDimensionFromRatio(minW, ratio, true);
      
      if (w < minW) {
        w = minW;
        h = calculateDimensionFromRatio(w, ratio, true);
      }
      if (h < minH) {
        h = minH;
        w = calculateDimensionFromRatio(h, ratio, false);
      }

      if (w > videoDisplayWidth) {
        w = videoDisplayWidth;
        h = calculateDimensionFromRatio(w, ratio, true);
      }
      if (h > videoDisplayHeight) {
        h = videoDisplayHeight;
        w = calculateDimensionFromRatio(h, ratio, false);
      }

      const final = ensureExactRatio(w, h, ratio, w >= h);
      
      if (final.width > videoDisplayWidth) {
        final.width = videoDisplayWidth;
        final.height = calculateDimensionFromRatio(final.width, ratio, true);
      }
      if (final.height > videoDisplayHeight) {
        final.height = videoDisplayHeight;
        final.width = calculateDimensionFromRatio(final.height, ratio, false);
      }
      
      const final2 = ensureExactRatio(final.width, final.height, ratio, final.width >= final.height);
      
      cropWidth = final2.width;
      cropHeight = final2.height;
    }

  } else {
    cropWidth = Math.round(videoDisplayWidth * 0.5);
    cropHeight = Math.round(videoDisplayHeight * 0.5);
  }

  const relativeX = Math.round((videoDisplayWidth - cropWidth) / 2);
  const relativeY = Math.round((videoDisplayHeight - cropHeight) / 2);

  return {
    x: Math.max(0, relativeX),
    y: Math.max(0, relativeY),
    width: cropWidth,
    height: cropHeight
  };
}

function calculateDimensionFromRatio(baseDimension, ratio, isWidth) {
  if (isWidth) {
    return Math.round(baseDimension * ratio.height / ratio.width);
  } else {
    return Math.round(baseDimension * ratio.width / ratio.height);
  }
}

function ensureExactRatio(width, height, ratio, preferWidth = true) {
  const aspectRatio = ratio.width / ratio.height;
  const currentRatio = width / height;
  
  if (Math.abs(currentRatio - aspectRatio) < 0.001) {
    return { width, height };
  }
  
  if (preferWidth) {
    const newHeight = Math.round(width * ratio.height / ratio.width);
    return { width, height: newHeight };
  } else {
    const newWidth = Math.round(height * ratio.width / ratio.height);
    return { width: newWidth, height };
  }
}

function calculateMinTimeDistance() {
  if (!mtcv_progressContainer || !mtcv_videoDuration || mtcv_videoDuration <= 0) {
    return 0.1;
  }

  if (mtcv_videoDuration >= 600) {
    return 0;
  }

  return 1;
}

function enforceHandleSpacing(startPercent, endPercent) {
  if (!mtcv_progressContainer || !mtcv_minPixelDistance) {
    return { startPercent, endPercent };
  }

  const containerWidth = mtcv_progressContainer.offsetWidth || 0;
  if (containerWidth <= 0) {
    return { startPercent, endPercent };
  }

  const minGapPercent = (mtcv_minPixelDistance / containerWidth) * 100;
  if ((endPercent - startPercent) >= minGapPercent) {
    return { startPercent, endPercent };
  }

  const halfGap = minGapPercent / 2;
  const midPoint = (startPercent + endPercent) / 2;
  let displayStart = midPoint - halfGap;
  let displayEnd = midPoint + halfGap;

  if (displayStart < 0) {
    displayEnd -= displayStart;
    displayStart = 0;
  }
  if (displayEnd > 100) {
    const diff = displayEnd - 100;
    displayStart -= diff;
    displayEnd = 100;
  }

  return {
    startPercent: Math.max(0, displayStart),
    endPercent: Math.min(100, displayEnd)
  };
}

// Thêm hàm helper ở đầu file (sau các biến global)
function roundToEven(value, maxValue = null) {
  // THAY ĐỔI DUY NHẤT: Ưu tiên làm tròn LÊN thay vì xuống
  let rounded = Math.round(value);
  
  if (rounded % 2 !== 0) {
    rounded += 1;  // ← Đây là dòng quan trọng nhất! Trước bạn trừ 1 → bị thu nhỏ dần
  }

  if (maxValue !== null && rounded > maxValue) {
    rounded = maxValue - (maxValue % 2); // lấy số chẵn lớn nhất ≤ maxValue
  }

  return Math.max(0, rounded);
}