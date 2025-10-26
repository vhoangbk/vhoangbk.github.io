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
  const secs = Math.floor(seconds % 60);

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

function scaledToOriginal(scaledX, scaledY, scaledW, scaledH, scaleX, scaleY) {
  const scaleMin = Math.min(scaleX, scaleY);
  return {
    x: Math.max(0, Math.round(scaledX / scaleMin)),
    y: Math.max(0, Math.round(scaledY / scaleMin)),
    width: Math.max(1, Math.round(scaledW / scaleMin)),
    height: Math.max(1, Math.round(scaledH / scaleMin))
  };
}

function originalToScaled(origX, origY, origW, origH, scaleX, scaleY) {
  return {
    x: Math.round(origX * scaleX),
    y: Math.round(origY * scaleY),
    width: Math.round(origW * scaleX),
    height: Math.round(origH * scaleY)
  };
}

function constrainCropBox(box, mediaWidth, mediaHeight, minSize) {
  if (box.w < minSize) box.w = minSize;
  if (box.h < minSize) box.h = minSize;
  if (box.w > mediaWidth) box.w = mediaWidth;
  if (box.h > mediaHeight) box.h = mediaHeight;

  if (box.x < 0) box.x = 0;
  if (box.y < 0) box.y = 0;

  if (box.x + box.w > mediaWidth) {
    box.x = Math.max(0, mediaWidth - box.w);
  }
  if (box.y + box.h > mediaHeight) {
    box.y = Math.max(0, mediaHeight - box.h);
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
    newHeight = newWidth / aspectRatio;
  }
  if (newHeight > mediaHeight) {
    newHeight = mediaHeight;
    newWidth = newHeight * aspectRatio;
  }

  if (newWidth <= mediaWidth && newHeight <= mediaHeight) {
    const currentRatio = newWidth / newHeight;
    if (currentRatio > aspectRatio) {
      newHeight = newWidth / aspectRatio;
    } else {
      newWidth = newHeight * aspectRatio;
    }
  }

  const minWidth = minSize;
  const minHeight = minWidth / aspectRatio;

  if (newWidth < minWidth) {
    newWidth = minWidth;
    newHeight = minWidth / aspectRatio;
  }
  if (newHeight < minHeight) {
    newHeight = minHeight;
    newWidth = minHeight * aspectRatio;
  }

  if (newWidth > mediaWidth) {
    newWidth = mediaWidth;
    newHeight = newWidth / aspectRatio;
  }
  if (newHeight > mediaHeight) {
    newHeight = mediaHeight;
    newWidth = newHeight * aspectRatio;
  }

  box.w = Math.round(newWidth);
  box.h = Math.round(newHeight);
  return box;
}

function handleResizeTL(box, boxStart, dx, dy, mediaWidth, mediaHeight, minSize) {
  const newW = boxStart.w - dx;
  const newH = boxStart.h - dy;

  const maxW = boxStart.x + boxStart.w;
  const maxH = boxStart.y + boxStart.h;

  box.w = Math.max(minSize, Math.min(newW, maxW));
  box.h = Math.max(minSize, Math.min(newH, maxH));

  box.x = boxStart.x + (boxStart.w - box.w);
  box.y = boxStart.y + (boxStart.h - box.h);

  return box;
}

function handleResizeTR(box, boxStart, dx, dy, mediaWidth, mediaHeight, minSize) {
  const newW = boxStart.w + dx;
  const newH = boxStart.h - dy;

  const maxW = mediaWidth - boxStart.x;
  const maxH = boxStart.y + boxStart.h;

  box.w = Math.max(minSize, Math.min(newW, maxW));
  box.h = Math.max(minSize, Math.min(newH, maxH));

  box.y = boxStart.y + (boxStart.h - box.h);

  return box;
}

function handleResizeBL(box, boxStart, dx, dy, mediaWidth, mediaHeight, minSize) {
  const newW = boxStart.w - dx;
  const newH = boxStart.h + dy;

  const maxW = boxStart.x + boxStart.w;
  const maxH = mediaHeight - boxStart.y;

  box.w = Math.max(minSize, Math.min(newW, maxW));
  box.h = Math.max(minSize, Math.min(newH, maxH));

  box.x = boxStart.x + (boxStart.w - box.w);

  return box;
}

function handleResizeBR(box, boxStart, dx, dy, mediaWidth, mediaHeight, minSize) {
  const newW = boxStart.w + dx;
  const newH = boxStart.h + dy;

  const maxW = mediaWidth - boxStart.x;
  const maxH = mediaHeight - boxStart.y;

  box.w = Math.max(minSize, Math.min(newW, maxW));
  box.h = Math.max(minSize, Math.min(newH, maxH));
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


function updateProgressElements(elements, percentages) {
  const { currentPercent, startPercent, endPercent } = percentages;

  if (elements.currentTimeLine) {
    updateElementStyle(elements.currentTimeLine, { left: `${currentPercent}%` });
  }

  if (elements.selectedRange) {
    updateElementStyle(elements.selectedRange, {
      left: `${startPercent}%`,
      width: `${endPercent - startPercent}%`
    });
  }

  if (elements.startHandle) {
    updateElementStyle(elements.startHandle, { left: `${startPercent}%` });
  }

  if (elements.endHandle) {
    updateElementStyle(elements.endHandle, { left: `calc(${endPercent}%)` });
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
  const { x: origX, y: origY, width: origW, height: origH } = scaledToOriginal(
    mtcv_box.x, mtcv_box.y, mtcv_box.w, mtcv_box.h, scaleX, scaleY
  );

  return {
    width: origW,
    height: origH,
    x: origX,
    y: origY,
    originalWidth: mtcv_origWidth,
    originalHeight: mtcv_origHeight,
    startTime: formatTime(mtcv_startTime),
    endTime: formatTime(mtcv_endTime),
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
      tempH = potentialH_fromW;
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
      const targetAspect = aspectRatio;
      let w = Math.round(tempW);
      let h = Math.round(w / targetAspect);

      if (h > tempH || h > videoDisplayHeight) {
        h = Math.round(tempH);
        w = Math.round(h * targetAspect);

        if (w > videoDisplayWidth) {
          w = Math.floor(videoDisplayWidth);
          h = Math.round(w / targetAspect);
        }
      }

      const minW = mtcv_minSize;
      const minH = Math.max(1, Math.round(minW / targetAspect));
      if (w < minW) { w = minW; h = Math.round(w / targetAspect); }
      if (h < minH) { h = minH; w = Math.round(h * targetAspect); }

      if (w > videoDisplayWidth) { w = videoDisplayWidth; h = Math.round(w / targetAspect); }
      if (h > videoDisplayHeight) { h = videoDisplayHeight; w = Math.round(h * targetAspect); }

      cropWidth = w;
      cropHeight = h;
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