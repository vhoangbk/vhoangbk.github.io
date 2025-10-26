function initializeDOMElementsForMTCV() {
  mtcv_displayedVideo = $(MTCV.ids.displayedVideo);
  mtcv_stage = $(MTCV.ids.stage);
  mtcv_cropBox = $(MTCV.ids.cropBox);
  mtcv_mediaContainer = $(MTCV.ids.mediaContainer);
  mtcv_overlayTop = $(MTCV.ids.overlayTop);
  mtcv_overlayLeft = $(MTCV.ids.overlayLeft);
  mtcv_overlayRight = $(MTCV.ids.overlayRight);
  mtcv_overlayBottom = $(MTCV.ids.overlayBottom);

  mtcv_play = $(MTCV.ids.play);
  mtcv_pause = $(MTCV.ids.pause);
  mtcv_progressContainer = $(MTCV.ids.progressContainer);
  mtcv_selectedRange = $(MTCV.ids.selectedRange);
  mtcv_currentTimeMarker = $(MTCV.ids.currentTimeMarker);
  mtcv_currentTimeLine = $(MTCV.ids.currentTimeLine);
  mtcv_startHandleByID = $(MTCV.ids.startHandle);
  mtcv_endHandleByID = $(MTCV.ids.endHandle);
  mtcv_startTimeLabel = $(MTCV.ids.startTimeLabel);
  mtcv_endTimeLabel = $(MTCV.ids.endTimeLabel);

  mtcv_dimensionWidth = getEl(MTCV.ids.dimensionWidth);
  mtcv_dimensionHeight = getEl(MTCV.ids.dimensionHeight);
  mtcv_dimensionX = getEl(MTCV.ids.dimensionX);
  mtcv_dimensionY = getEl(MTCV.ids.dimensionY);

  if (!mtcv_displayedVideo || !mtcv_stage || !mtcv_cropBox || !mtcv_mediaContainer) {
    return false;
  }

  restoreStatesFromConfig();

  setupEventListeners();
  loadVideoFromUrl(APP_STATE.urlVideo);
  initializeMTCVTimeline();
  setupRatioButtons();
  setupFlipControls();
  setupScaleListener();
  setupCropRatiosDragScroll();
  
  restoreCheckboxStates();
  
  setTimeout(() => {
    populateModalFromConfig();
  }, 100);
  return true;
}

function restoreStatesFromConfig() {
  if (!APP_STATE.configConvertVideo) {
    return;
  }
  
  const config = APP_STATE.configConvertVideo;
  
  if (config.cropCheck === true) {
    mtcv_showCropBox = true;
    if (config.width !== undefined && config.height !== undefined && 
        config.x !== undefined && config.y !== undefined) {
    }
  } else {
    mtcv_showCropBox = false;
  }
  
  if (config.trimCheck === true) {
    mtcv_showTrimVideo = true;
    mtcv_startTime = 0;
    const videoDuration = APP_STATE.selectedFileInfo?.duration || mtcv_videoDuration || 0;
    mtcv_endTime = videoDuration;
  } else {
    mtcv_showTrimVideo = false;
  }
  
  if (config.flipVerticalCheck === true) {
    mtcv_showVerticalFlip = true;
    mtcv_flipState.vertical = true;
  } else {
    mtcv_showVerticalFlip = false;
    mtcv_flipState.vertical = false;
  }
  
  if (config.flipHorizontalCheck === true) {
    mtcv_showHorizontalFlip = true;
    mtcv_flipState.horizontal = true;
  } else {
    mtcv_showHorizontalFlip = false;
    mtcv_flipState.horizontal = false;
  }
  
  if (config.ratio) {
    mtcv_currentRatio = config.ratio;
  }
}

function populateModalFromConfig() {
  if (!APP_STATE.configConvertVideo) {
    return;
  }
  const config = APP_STATE.configConvertVideo;
  
  if (mtcv_showCropBox) {
    populateDimensionsInfo(config);
    populateCropRatios(config.ratio);
    populateCropBox(config);
  }
  
  populateFlipControls(config.flip);
  populateTimeline(config.startTime, config.endTime);
}

function populateDimensionsInfo(config) {
  updateElementStyle(mtcv_dimensionWidth, { textContent: config.width });
  updateElementStyle(mtcv_dimensionHeight, { textContent: config.height });
  updateElementStyle(mtcv_dimensionX, { textContent: config.x });
  updateElementStyle(mtcv_dimensionY, { textContent: config.y });
}

function populateCropRatios(ratio) {
  const ratioButtons = getEls('.mtcv-ratio-btn');
  toggleClassForElements(ratioButtons, 'mtcv-crop-ratios-active', false);

  let targetRatio = 'custom';
  if (ratio) {
    if (ratio.width === 1 && ratio.height === 1) {
      targetRatio = '1:1';
    } else if (ratio.width === 9 && ratio.height === 16) {
      targetRatio = '9:16';
    } else if (ratio.width === 16 && ratio.height === 9) {
      targetRatio = '16:9';
    } else if (ratio.width === 4 && ratio.height === 3) {
      targetRatio = '4:3';
    }
  }

  let ratioTemp = parseRatio(targetRatio);
  
  toggleClassForElements(ratioButtons, 'mtcv-crop-ratios-active', false);
  const targetButton = getEl(`[data-ratio="${targetRatio}"]`);
  if (targetButton) {
    targetButton.classList.add('mtcv-crop-ratios-active');
  }
  
  if (!APP_STATE.configConvertVideo || 
      APP_STATE.configConvertVideo.width === undefined || 
      APP_STATE.configConvertVideo.height === undefined ||
      APP_STATE.configConvertVideo.x === undefined ||
      APP_STATE.configConvertVideo.y === undefined) {
    
    const position = calculateCropBoxPosition(ratioTemp);
    if (position) {
      updateCropBoxWithRatio(position, ratioTemp);
    }
  } else {
    mtcv_currentRatio = ratioTemp;
  }
}

function populateFlipControls(flip) {
  const flipButtons = getEls('.mtcv-flip-btn');
  toggleClassForElements(flipButtons, 'mtcv-flip-btn-active', false);

  if (flip?.vertical) {
    const verticalBtn = getEl('[data-flip="vertical"]');
    if (verticalBtn) verticalBtn.classList.add('mtcv-flip-btn-active');
  }

  if (flip?.horizontal) {
    const horizontalBtn = getEl('[data-flip="horizontal"]');
    if (horizontalBtn) horizontalBtn.classList.add('mtcv-flip-btn-active');
  }
  applyFlipToVideo();
}

function populateTimeline(startTime, endTime) {
  const startTimeStr = typeof startTime === 'number' ? formatTime(startTime) : startTime;
  const endTimeStr = typeof endTime === 'number' ? formatTime(endTime) : endTime;
  
  const startSeconds = timeStringToSeconds(startTimeStr);
  let endSeconds = timeStringToSeconds(endTimeStr);
  if (!endSeconds) {
    endSeconds = mtcv_videoDuration;
  }

  if (typeof mtcv_startTime !== 'undefined') {
    mtcv_startTime = startSeconds;
  }
  if (typeof mtcv_endTime !== 'undefined') {
    mtcv_endTime = endSeconds;
  }

  if (typeof updateDisplays === 'function') {
    updateDisplays();
  }
  if (typeof updateProgressBar === 'function') {
    updateProgressBar();
  }
}

function populateCropBox(config) {
  if (!mtcv_cropBox) return;

  const { scaleX, scaleY } = calculateScaleFactors(mtcv_mediaWidth, mtcv_mediaHeight, mtcv_origWidth, mtcv_origHeight);
  const { x: scaledX, y: scaledY, width: scaledWidth, height: scaledHeight } = originalToScaled(
    config.x, config.y, config.width, config.height, scaleX, scaleY
  );

  mtcv_box.x = scaledX;
  mtcv_box.y = scaledY;
  mtcv_box.w = scaledWidth;
  mtcv_box.h = scaledHeight;
  mtcv_box.visible = mtcv_showCropBox;
  updateCropBoxUI('populateCropBox 213');
}

function setupEventListeners() {
  if (!mtcv_cropBox) return;

  mtcv_cropBox.addEventListener('pointerdown', (ev) => {
    const isVideoControl = ev.target.closest('video') ||
      ev.target.tagName === 'VIDEO' ||
      ev.target.classList.contains('video-controls') ||
      ev.target.closest('.video-controls');

    if (isVideoControl) return;

    let elementWithHandle = ev.target;
    while (elementWithHandle && !elementWithHandle.dataset.handle) {
      elementWithHandle = elementWithHandle.parentElement;
    }

    const handle = elementWithHandle ? elementWithHandle.dataset.handle : null;

    if (handle) {
      ev.preventDefault();
      ev.stopPropagation();

      mtcv_pointerStart = { x: ev.clientX, y: ev.clientY };
      mtcv_boxStart = { x: mtcv_box.x, y: mtcv_box.y, w: mtcv_box.w, h: mtcv_box.h };

      if (handle === 'move') {
        mtcv_action = 'move';
        document.body.style.cursor = 'move';
      } else {
        mtcv_action = 'resize-' + handle;
        document.body.style.cursor = getCursorForHandle(handle);
      }

      ev.target.setPointerCapture(ev.pointerId);
    }
  });

  const moveHandle = mtcv_cropBox.querySelector('.mtcv-move-handle');
  if (moveHandle) {
    moveHandle.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      mtcv_action = 'move';
      document.body.style.cursor = 'move';
      mtcv_pointerStart = { x: ev.clientX, y: ev.clientY };
      mtcv_boxStart = { x: mtcv_box.x, y: mtcv_box.y, w: mtcv_box.w, h: mtcv_box.h };

      ev.target.setPointerCapture(ev.pointerId);
    });
  }

  let lastMoveEvent = null;
  let animationFrameRequested = false;

  document.addEventListener('pointermove', (ev) => {
    if (!mtcv_action) return;
    ev.preventDefault();
    lastMoveEvent = ev;

    if (!animationFrameRequested) {
      animationFrameRequested = true;
      requestAnimationFrame(() => {
        handlePointerMove(lastMoveEvent);
        animationFrameRequested = false;
      });
    }
  });

  document.addEventListener('pointerup', (ev) => {
    if (mtcv_action && mtcv_action.startsWith('resize-')) {
      const corner = mtcv_action.split('-')[1];

      const isOutsideBounds = (
        mtcv_box.x < 0 ||
        mtcv_box.y < 0 ||
        mtcv_box.x + mtcv_box.w > mtcv_mediaWidth ||
        mtcv_box.y + mtcv_box.h > mtcv_mediaHeight
      );

      if (isOutsideBounds) {
        snapHandleToCorner(mtcv_box, corner, mtcv_mediaWidth, mtcv_mediaHeight);
        updateCropBoxUI('pointerup 299');
      }
    }

    document.body.style.cursor = '';
    mtcv_action = null;
  });
}

function handlePointerMove(ev) {
  const stageDims = getMTCVStageDimensions();
  const { dx, dy } = getScaledMouseDelta(ev, mtcv_pointerStart, stageDims);

  if (mtcv_action === 'move') {
    mtcv_box.x = mtcv_boxStart.x + dx;
    mtcv_box.y = mtcv_boxStart.y + dy;
    constrainCropBox(mtcv_box, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_minSize);
    updateCropBoxUI('handlePointerMove 317');
  } else if (mtcv_action && mtcv_action.startsWith('resize-')) {
    const corner = mtcv_action.split('-')[1];

    switch (corner) {
      case 'tl':
        handleResizeTL(mtcv_box, mtcv_boxStart, dx, dy, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_minSize);
        break;
      case 'tr':
        handleResizeTR(mtcv_box, mtcv_boxStart, dx, dy, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_minSize);
        break;
      case 'bl':
        handleResizeBL(mtcv_box, mtcv_boxStart, dx, dy, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_minSize);
        break;
      case 'br':
        handleResizeBR(mtcv_box, mtcv_boxStart, dx, dy, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_minSize);
        break;
    }

    if (mtcv_currentRatio) {
      applyRatioConstraints(mtcv_box, mtcv_currentRatio, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_minSize);
    }

    constrainCropBox(mtcv_box, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_minSize);
    updateCropBoxUI('handlePointerMove 341');
  }
}

function loadVideoFromUrl(videoUrl) {
  if (!videoUrl || !mtcv_displayedVideo) return;

  mtcv_displayedVideo.onloadedmetadata = () => {
    mtcv_mediaLoaded = true;
    mtcv_origWidth = mtcv_displayedVideo.videoWidth;
    mtcv_origHeight = mtcv_displayedVideo.videoHeight;
    fitMediaToContainer();
    showEditorAfterLoad();
  };

  const mtcvTimeMarker = document.querySelector('.current-time-marker');
  if (mtcvTimeMarker) {
    mtcvTimeMarker.style.display = 'block';
  }

  mtcv_displayedVideo.onerror = () => {
    const mtcvThumbnailNotPlayVideo = document.querySelector('.mtcv-thumbnail-not-play-video');
    const mtcvDisplayedVideo = document.querySelector('.mtcv-displayed-video');
    const mtcvTimeMarker = document.querySelector('.current-time-marker');
    if (mtcvTimeMarker) {
      mtcvTimeMarker.style.display = 'none';
    }
    if (APP_STATE.selectedFileInfo && APP_STATE.selectedFileInfo.thumbnail) {
      mtcvThumbnailNotPlayVideo.style.backgroundImage = `url(${APP_STATE.selectedFileInfo.thumbnail})`;
      mtcvThumbnailNotPlayVideo.style.backgroundSize = 'cover';
      mtcvThumbnailNotPlayVideo.style.backgroundPosition = 'center';
      mtcvThumbnailNotPlayVideo.style.backgroundRepeat = 'no-repeat';
    }
    fitThumbnailToContainer();
    initializeTimelineForThumbnail();
    mtcvThumbnailNotPlayVideo.style.display = 'flex';
    mtcvDisplayedVideo.style.display = 'none';
    mtcv_mediaLoaded = true;
    showEditorAfterLoad();
  };

  mtcv_displayedVideo.src = videoUrl;
  mtcv_displayedVideo.load();
}

function fitMediaToContainer() {
  if (!mtcv_stage || !mtcv_displayedVideo || !mtcv_mediaContainer) return;

  const stageDims = getMTCVStageDimensions();
  const containerW = stageDims.originalWidth;
  const containerH = stageDims.originalHeight;
  const isVerticalVideo = mtcv_origHeight > mtcv_origWidth;
  let scale;
  if (isVerticalVideo) {
    scale = containerH / mtcv_origHeight;
  } else {
    scale = containerW / mtcv_origWidth;
  }

  mtcv_mediaWidth = Math.round(mtcv_origWidth * scale);
  mtcv_mediaHeight = Math.round(mtcv_origHeight * scale);

  updateElementStyle(mtcv_displayedVideo, {
    width: mtcv_mediaWidth + 'px',
    height: mtcv_mediaHeight + 'px'
  });

  const mediaLeft = Math.round((containerW - mtcv_mediaWidth) / 2);
  const mediaTop = Math.round((containerH - mtcv_mediaHeight) / 2);

  mtcv_mediaOffsetX = mediaLeft;
  mtcv_mediaOffsetY = mediaTop;

  if (!APP_STATE.configConvertVideo || 
      APP_STATE.configConvertVideo.width === undefined || 
      APP_STATE.configConvertVideo.height === undefined ||
      APP_STATE.configConvertVideo.x === undefined ||
      APP_STATE.configConvertVideo.y === undefined) {
    
    const initialW = Math.round(mtcv_mediaWidth * 0.5);
    const initialH = Math.round(mtcv_mediaHeight * 0.5);

    mtcv_box.w = initialW;
    mtcv_box.h = initialH;
    mtcv_box.x = Math.round((mtcv_mediaWidth - mtcv_box.w) / 2);
    mtcv_box.y = Math.round((mtcv_mediaHeight - mtcv_box.h) / 2);
    mtcv_box.visible = mtcv_showCropBox;

    updateCropBoxUI('fitMediaToContainer 432');
  } else {
    mtcv_box.visible = mtcv_showCropBox;
    updateCropBoxUI('fitMediaToContainer 434');
    return;
  }
}

function showEditorAfterLoad() {
  if (!mtcv_cropBox || !mtcv_mediaContainer) return;

  if (mtcv_showCropBox) {
    mtcv_cropBox.style.display = 'block';
    const overlays = [mtcv_overlayTop, mtcv_overlayLeft, mtcv_overlayRight, mtcv_overlayBottom];
    overlays.forEach(o => {
      if (o) o.style.display = 'block';
    });
  } else {
    mtcv_cropBox.style.display = 'none';
    const overlays = [mtcv_overlayTop, mtcv_overlayLeft, mtcv_overlayRight, mtcv_overlayBottom];
    overlays.forEach(o => {
      if (o) o.style.display = 'none';
    });
  }
}

function updateCropBoxUI(location) {
  if (!mtcv_box.visible || !mtcv_cropBox) {
    if (mtcv_cropBox) mtcv_cropBox.style.display = 'none';
    updateOverlays();
    
    updateElementText(mtcv_dimensionWidth, 0);
    updateElementText(mtcv_dimensionHeight, 0);
    updateElementText(mtcv_dimensionX, 0);
    updateElementText(mtcv_dimensionY, 0);
    
    if (!mtcv_showCropBox) {
      disableRatioButtons();
    }
    return;
  }
  
  if (mtcv_showCropBox) {
    enableRatioButtons();
  }
  
  updateElementStyle(mtcv_cropBox, {
    display: 'block',
    width: mtcv_box.w + 'px',
    height: mtcv_box.h + 'px',
    left: (mtcv_mediaOffsetX + mtcv_box.x) + 'px',
    top: (mtcv_mediaOffsetY + mtcv_box.y) + 'px'
  });
  
  const { scaleX, scaleY } = calculateScaleFactors(mtcv_mediaWidth, mtcv_mediaHeight, mtcv_origWidth, mtcv_origHeight);
  const { x: origX, y: origY, width: origW, height: origH } = scaledToOriginal(
    mtcv_box.x, mtcv_box.y, mtcv_box.w, mtcv_box.h, scaleX, scaleY
  );
  updateCropConfig('cropBox');
  updateElementText(mtcv_dimensionWidth, origW);
  updateElementText(mtcv_dimensionHeight, origH);
  updateElementText(mtcv_dimensionX, origX);
  updateElementText(mtcv_dimensionY, origY);

  updateOverlays();
}

function toggleCropBox(enable = null) {
  if (enable === null) {
    const checkbox = document.getElementById('crop-toggle-checkbox');
    enable = checkbox ? checkbox.checked : false;
  }
  
  mtcv_showCropBox = enable;
  mtcv_box.visible = enable;
  
  if (enable) {
    updateCropBoxUI('toggleCropBox 520');
    updateCropConfig('cropBox');
    enableRatioButtons();
  } else {
    updateCropBoxUI('toggleCropBox 522');
    resetCropConfig('cropBox');
    disableRatioButtons();
    
    const ratioButtons = getEls('.mtcv-ratio-btn');
    toggleClassForElements(ratioButtons, 'mtcv-crop-ratios-active', false);
    
    mtcv_currentRatio = null;
  }
}

function updateCropConfig(updateType = 'all') {
  if (!APP_STATE.configConvertVideo) {
    APP_STATE.configConvertVideo = {};
  }

  switch (updateType) {
    case 'cropBox':
      const cropData = getCurrentCropConfig(
        mtcv_box, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_origWidth, mtcv_origHeight,
        mtcv_startTime, mtcv_endTime, mtcv_flipState, mtcv_currentRatio
      );

      APP_STATE.configConvertVideo.originalWidth = cropData.originalWidth;
      APP_STATE.configConvertVideo.originalHeight = cropData.originalHeight;
      APP_STATE.configConvertVideo.width = cropData.width;
      APP_STATE.configConvertVideo.height = cropData.height;
      APP_STATE.configConvertVideo.x = cropData.x;
      APP_STATE.configConvertVideo.y = cropData.y;
      APP_STATE.configConvertVideo.ratio = cropData.ratio;
      APP_STATE.configConvertVideo.cropCheck = mtcv_showCropBox;
      break;

    case 'trimVideo':
      APP_STATE.configConvertVideo.startTime = mtcv_startTime;
      APP_STATE.configConvertVideo.endTime = mtcv_endTime;
      APP_STATE.configConvertVideo.trimCheck = mtcv_showTrimVideo;
      break;

    case 'flip':
      APP_STATE.configConvertVideo.flip = {
        vertical: mtcv_flipState.vertical,
        horizontal: mtcv_flipState.horizontal
      };
      APP_STATE.configConvertVideo.flipVerticalCheck = mtcv_showVerticalFlip;
      APP_STATE.configConvertVideo.flipHorizontalCheck = mtcv_showHorizontalFlip;
      break;

    case 'all':
    default:
      const allCropData = getCurrentCropConfig(
        mtcv_box, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_origWidth, mtcv_origHeight,
        mtcv_startTime, mtcv_endTime, mtcv_flipState, mtcv_currentRatio
      );

      APP_STATE.configConvertVideo = allCropData;
      APP_STATE.configConvertVideo.cropCheck = mtcv_showCropBox;
      APP_STATE.configConvertVideo.trimCheck = mtcv_showTrimVideo;
      APP_STATE.configConvertVideo.flipVerticalCheck = mtcv_showVerticalFlip;
      APP_STATE.configConvertVideo.flipHorizontalCheck = mtcv_showHorizontalFlip;
      break;
  }

}

function resetCropConfig(resetType = 'all') {
  if (!APP_STATE.configConvertVideo) {
    APP_STATE.configConvertVideo = {};
  }
  switch (resetType) {
    case 'cropBox':
      APP_STATE.configConvertVideo.originalWidth = undefined;
      APP_STATE.configConvertVideo.originalHeight = undefined;
      APP_STATE.configConvertVideo.width = undefined;
      APP_STATE.configConvertVideo.height = undefined;
      APP_STATE.configConvertVideo.x = undefined;
      APP_STATE.configConvertVideo.y = undefined;
      APP_STATE.configConvertVideo.ratio = undefined;
      APP_STATE.configConvertVideo.cropCheck = false;
      break;

    case 'trimVideo':
      APP_STATE.configConvertVideo.startTime = undefined;
      APP_STATE.configConvertVideo.endTime = undefined;
      APP_STATE.configConvertVideo.trimCheck = false;
      break;

    case 'flip':
      APP_STATE.configConvertVideo.flip = {
        vertical: false,
        horizontal: false
      };
      APP_STATE.configConvertVideo.flipVerticalCheck = false;
      APP_STATE.configConvertVideo.flipHorizontalCheck = false;
      break;

    case 'all':
    default:
      APP_STATE.configConvertVideo.width = undefined;
      APP_STATE.configConvertVideo.height = undefined;
      APP_STATE.configConvertVideo.x = undefined;
      APP_STATE.configConvertVideo.y = undefined;
      APP_STATE.configConvertVideo.ratio = undefined;
      APP_STATE.configConvertVideo.startTime = undefined;
      APP_STATE.configConvertVideo.endTime = undefined;
      APP_STATE.configConvertVideo.flip = {
        vertical: false,
        horizontal: false
      };
      APP_STATE.configConvertVideo.cropCheck = false;
      APP_STATE.configConvertVideo.trimCheck = false;
      APP_STATE.configConvertVideo.flipVerticalCheck = false;
      APP_STATE.configConvertVideo.flipHorizontalCheck = false;
      break;
  }
}

function disableRatioButtons() {
  const ratioButtons = getEls('.mtcv-ratio-btn');
  const cropRatiosContainer = document.querySelector('.mtcv-crop-ratios');

  ratioButtons.forEach(btn => {
    btn.style.pointerEvents = 'none';
    btn.style.cursor = 'not-allowed';
    btn.style.opacity = '0.5';
  });

  if (cropRatiosContainer) {
    cropRatiosContainer.style.cursor = 'not-allowed';
  }
}

function enableRatioButtons() {
  const ratioButtons = getEls('.mtcv-ratio-btn');
  const cropRatiosContainer = document.querySelector('.mtcv-crop-ratios');

  ratioButtons.forEach(btn => {
    btn.style.pointerEvents = 'auto';
    btn.style.cursor = 'pointer';
    btn.style.opacity = '1';
  });

  if (cropRatiosContainer) {
    cropRatiosContainer.style.cursor = 'grab';
  }
}

function updateOverlays() {
  if (!mtcv_stage || !mtcv_overlayTop || !mtcv_overlayLeft || !mtcv_overlayRight || !mtcv_overlayBottom) return;

  const stageDims = getMTCVStageDimensions();
  const stageW = stageDims.originalWidth;
  const stageH = stageDims.originalHeight;
  const cropTop = mtcv_mediaOffsetY + mtcv_box.y;
  const cropLeft = mtcv_mediaOffsetX + mtcv_box.x;
  const cropRight = cropLeft + mtcv_box.w;
  const cropBottom = cropTop + mtcv_box.h;

  const overlayStyles = {
    top: {
      left: '0px',
      top: '0px',
      width: stageW + 'px',
      height: Math.max(0, cropTop) + 'px'
    },
    bottom: {
      left: '0px',
      top: Math.max(0, cropBottom) + 'px',
      width: stageW + 'px',
      height: Math.max(0, stageH - cropBottom) + 'px'
    },
    left: {
      left: '0px',
      top: Math.max(0, cropTop) + 'px',
      width: Math.max(0, cropLeft) + 'px',
      height: Math.max(0, mtcv_box.h) + 'px'
    },
    right: {
      left: Math.max(0, cropRight) + 'px',
      top: Math.max(0, cropTop) + 'px',
      width: Math.max(0, stageW - cropRight) + 'px',
      height: Math.max(0, mtcv_box.h) + 'px'
    }
  };

  updateElementStyle(mtcv_overlayTop, overlayStyles.top);
  updateElementStyle(mtcv_overlayBottom, overlayStyles.bottom);
  updateElementStyle(mtcv_overlayLeft, overlayStyles.left);
  updateElementStyle(mtcv_overlayRight, overlayStyles.right);

  const show = mtcv_showCropBox && mtcv_box.visible && mtcv_mediaLoaded;
  const overlays = [mtcv_overlayTop, mtcv_overlayLeft, mtcv_overlayRight, mtcv_overlayBottom];
  overlays.forEach(o => {
    if (o) o.style.display = show ? 'block' : 'none';
  });
}

function updateCropBoxWithRatio(position, ratio) {
  if (!position || !mtcv_cropBox) return;
  mtcv_currentRatio = ratio;
  mtcv_box.x = position.x;
  mtcv_box.y = position.y;
  mtcv_box.w = position.width;
  mtcv_box.h = position.height;
  mtcv_box.visible = true;
  mtcv_showCropBox = true;

  updateCropBoxUI('updateCropBoxWithRatio 733');
}

function cancelTrimCropModal() {
  if (mtcv_displayedVideo && !mtcv_displayedVideo.paused) {
    mtcv_displayedVideo.pause();
  }
  closeModal('.mtcv-container', '.config-advenced-button');
}

function setupScaleListener() {
  window.addEventListener('resize', () => {
    if (mtcv_mediaLoaded && mtcv_box.visible) {
      setTimeout(() => {
        const mtcvThumbnailNotPlayVideo = document.querySelector('.mtcv-thumbnail-not-play-video');
        const isThumbnailMode = mtcvThumbnailNotPlayVideo && mtcvThumbnailNotPlayVideo.style.display !== 'none';
        if (isThumbnailMode) {
          fitThumbnailToContainer();
        } else {
          fitMediaToContainer();
        }
        updateCropBoxUI('setupScaleListener 754');
      }, 350);
    }
  });
}

function initializeTimelineForThumbnail() {
  if (APP_STATE.selectedFileInfo && APP_STATE.selectedFileInfo.duration) {
    mtcv_videoDuration = APP_STATE.selectedFileInfo.duration;
    mtcv_startTime = 0;
    mtcv_endTime = mtcv_videoDuration;
    initializeTimelineUI();
    setupTimelineDragEventsForThumbnail();
  }
}

function initializeTimelineUI() {
  if (mtcv_startHandleByID) {
    updateElementStyle(mtcv_startHandleByID, { left: '0%' });
  }
  if (mtcv_endHandleByID) {
    updateElementStyle(mtcv_endHandleByID, { left: '100%' });
  }
  updateTimeDisplay();
  updateProgressBarForThumbnail();
}

function updateProgressBarForThumbnail() {
  if (!mtcv_videoDuration) return;

  const startPercent = timeToPercent(mtcv_startTime, mtcv_videoDuration);
  const endPercent = timeToPercent(mtcv_endTime, mtcv_videoDuration);
  const minTimeDistance = calculateMinTimeDistance();
  const minPercentDistance = timeToPercent(minTimeDistance, mtcv_videoDuration);

  const elements = {
    currentTimeMarker: mtcv_currentTimeMarker,
    currentTimeLine: mtcv_currentTimeLine,
    selectedRange: mtcv_selectedRange,
    startHandle: mtcv_startHandleByID,
    endHandle: mtcv_endHandleByID
  };

  const percentages = {
    currentPercent: 0,
    startPercent,
    endPercent,
    constrainedPercent: undefined
  };

  updateProgressElements(elements, percentages);
}

function setupTimelineDragEventsForThumbnail() {
  const dragStartHandler = (e, type) => {
    e.stopPropagation();
    e.preventDefault();
    startDraggingForThumbnail(type);
  };

  if (mtcv_startHandleByID) {
    setupElementEvents(mtcv_startHandleByID, [
      { event: 'mousedown', handler: (e) => dragStartHandler(e, 'start') },
      { event: 'touchstart', handler: (e) => dragStartHandler(e, 'start'), options: { passive: false } }
    ]);
  }
  if (mtcv_endHandleByID) {
    setupElementEvents(mtcv_endHandleByID, [
      { event: 'mousedown', handler: (e) => dragStartHandler(e, 'end') },
      { event: 'touchstart', handler: (e) => dragStartHandler(e, 'end'), options: { passive: false } }
    ]);
  }

  if (mtcv_progressContainer) {
    const { handleProgressClick, handleTouchProgress } = createProgressHandlersForThumbnail();

    setupElementEvents(mtcv_progressContainer, [
      {
        event: 'mousedown',
        handler: (e) => {
          if (!e.target.closest('.progress-handle-icon')) {
            handleProgressClick.call({ isDragging: mtcv_isDragging }, e);
          }
        }
      },
      {
        event: 'touchstart',
        handler: (e) => {
          if (!e.target.closest('.progress-handle-icon')) {
            handleTouchProgress.call({ isDragging: mtcv_isDragging }, e);
          }
        },
        options: { passive: false }
      }
    ]);
  }
}

function startDraggingForThumbnail(type) {
  mtcv_isDragging = true;
  mtcv_dragTarget = type;

  const { handleDrag, handleTouchDrag } = createDragHandlersForThumbnail();

  setupElementEvents(document, [
    { event: 'mousemove', handler: handleDrag },
    { event: 'mouseup', handler: stopDragging },
    { event: 'touchmove', handler: handleTouchDrag, options: { passive: false } },
    { event: 'touchend', handler: stopDragging }
  ]);
}

function createDragHandlersForThumbnail() {
  const calculateTime = (clientX) => calculateTimeFromPosition(clientX, mtcv_progressContainer, mtcv_videoDuration);

  return {
    handleDrag: createDragHandler(calculateTime, updateDragPositionForThumbnail),
    handleTouchDrag: createTouchDragHandler(calculateTime, updateDragPositionForThumbnail)
  };
}

function updateDragPositionForThumbnail(newTime) {
  const minTimeDistance = calculateMinTimeDistance();

  const handlers = {
    start: () => handleStartDragForThumbnail(newTime, minTimeDistance),
    end: () => handleEndDragForThumbnail(newTime, minTimeDistance)
  };

  if (handlers[mtcv_dragTarget]) {
    handlers[mtcv_dragTarget]();
  }

  updateTimeDisplay();
  updateProgressBarForThumbnail();
  
  updateCropConfig('trimVideo');
}

function handleStartDragForThumbnail(newTime, minTimeDistance) {
  mtcv_startTime = constrainTimeInRange(newTime, 0, mtcv_endTime - minTimeDistance);

  if (mtcv_startHandleByID) {
    const startPercent = timeToPercent(mtcv_startTime, mtcv_videoDuration);
    updateElementStyle(mtcv_startHandleByID, { left: `${startPercent}%` });
  }
}

function handleEndDragForThumbnail(newTime, minTimeDistance) {
  mtcv_endTime = constrainTimeInRange(newTime, mtcv_startTime + minTimeDistance, mtcv_videoDuration);

  if (mtcv_endHandleByID) {
    const endPercent = timeToPercent(mtcv_endTime, mtcv_videoDuration);
    updateElementStyle(mtcv_endHandleByID, { left: `${endPercent}%` });
  }
}

function createProgressHandlersForThumbnail() {
  const constrainFunction = (newTime) => {
    const minTimeDistance = calculateMinTimeDistance();
    return constrainTimeInRange(
      newTime,
      mtcv_startTime + minTimeDistance,
      mtcv_endTime - minTimeDistance
    );
  };

  return {
    handleProgressClick: createProgressClickHandler(mtcv_progressContainer, mtcv_videoDuration, constrainFunction),
    handleTouchProgress: createTouchProgressHandler(mtcv_progressContainer, mtcv_videoDuration, constrainFunction)
  };
}

function fitThumbnailToContainer() {
  if (!mtcv_stage || !mtcv_mediaContainer || !APP_STATE.selectedFileInfo) return;

  mtcv_origWidth = APP_STATE.selectedFileInfo.width;
  mtcv_origHeight = APP_STATE.selectedFileInfo.height;

  const stageDims = getMTCVStageDimensions();
  const containerW = stageDims.originalWidth;
  const containerH = stageDims.originalHeight;
  const isVerticalVideo = mtcv_origHeight > mtcv_origWidth;
  let scale;

  if (isVerticalVideo) {
    scale = containerH / mtcv_origHeight;
  } else {
    scale = containerW / mtcv_origWidth;
  }

  mtcv_mediaWidth = Math.round(mtcv_origWidth * scale);
  mtcv_mediaHeight = Math.round(mtcv_origHeight * scale);

  const mtcvThumbnailNotPlayVideo = document.querySelector('.mtcv-thumbnail-not-play-video');
  if (mtcvThumbnailNotPlayVideo) {
    updateElementStyle(mtcvThumbnailNotPlayVideo, {
      width: mtcv_mediaWidth + 'px',
      height: mtcv_mediaHeight + 'px'
    });
  }

  const mediaLeft = Math.round((containerW - mtcv_mediaWidth) / 2);
  const mediaTop = Math.round((containerH - mtcv_mediaHeight) / 2);

  mtcv_mediaOffsetX = mediaLeft;
  mtcv_mediaOffsetY = mediaTop;

  const initialW = Math.round(mtcv_mediaWidth * 0.5);
  const initialH = Math.round(mtcv_mediaHeight * 0.5);

  mtcv_box.w = initialW;
  mtcv_box.h = initialH;
  mtcv_box.x = Math.round((mtcv_mediaWidth - mtcv_box.w) / 2);
  mtcv_box.y = Math.round((mtcv_mediaHeight - mtcv_box.h) / 2);
  mtcv_box.visible = mtcv_showCropBox;

  updateCropBoxUI('fitThumbnailToContainer 972');
}

function setupCropRatiosDragScroll() {
  const cropRatiosContainer = document.querySelector('.mtcv-crop-ratios');
  if (!cropRatiosContainer) return;
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;
  cropRatiosContainer.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('mtcv-ratio-btn')) return;
    isDragging = true;
    cropRatiosContainer.style.cursor = 'grabbing';
    startX = e.pageX - cropRatiosContainer.offsetLeft;
    scrollLeft = cropRatiosContainer.scrollLeft;
  });

  cropRatiosContainer.addEventListener('mouseleave', () => {
    isDragging = false;
    cropRatiosContainer.style.cursor = 'grab';
  });

  cropRatiosContainer.addEventListener('mouseup', () => {
    isDragging = false;
    cropRatiosContainer.style.cursor = 'grab';
  });

  cropRatiosContainer.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - cropRatiosContainer.offsetLeft;
    const walk = (x - startX) * 2;
    cropRatiosContainer.scrollLeft = scrollLeft - walk;
  });
  cropRatiosContainer.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('mtcv-ratio-btn')) return;
    isDragging = true;
    startX = e.touches[0].pageX - cropRatiosContainer.offsetLeft;
    scrollLeft = cropRatiosContainer.scrollLeft;
  });

  cropRatiosContainer.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.touches[0].pageX - cropRatiosContainer.offsetLeft;
    const walk = (x - startX) * 2;
    cropRatiosContainer.scrollLeft = scrollLeft - walk;
  });

  cropRatiosContainer.addEventListener('touchend', () => {
    isDragging = false;
  });
  cropRatiosContainer.style.cursor = 'grab';
}

function showCropBox() {
  mtcv_showCropBox = true;
  mtcv_box.visible = true;
  updateCropBoxUI('showCropBox 1029');
}

function hideCropBox() {
  mtcv_showCropBox = false;
  mtcv_box.visible = false;
  updateCropBoxUI('hideCropBox 1035');
}

function toggleVertical() {
  const checkbox = document.getElementById('vertical-toggle-checkbox');
  if (checkbox) {
    mtcv_flipState.vertical = checkbox.checked;
    mtcv_showVerticalFlip = checkbox.checked;
    applyFlipToVideo();
    updateCropConfig('flip');
  }
}

function toggleHorizontal() {
  const checkbox = document.getElementById('horizontal-toggle-checkbox');
  if (checkbox) {
    mtcv_flipState.horizontal = checkbox.checked;
    mtcv_showHorizontalFlip = checkbox.checked;
    applyFlipToVideo();
    updateCropConfig('flip');
  }
}

function toggleTrimVideo() {
  const checkbox = document.getElementById('trim-video-toggle-checkbox');
  if (checkbox) {
    mtcv_showTrimVideo = checkbox.checked;
    const timelineTrack = document.querySelector('.mtcv-timeline-track');
    if (timelineTrack) {
      timelineTrack.classList.toggle('mtcv-timeline-track-disabled', !checkbox.checked);
      if (!checkbox.checked) {
        mtcv_startTime = 0;
        mtcv_endTime = mtcv_videoDuration || 0;
        updateTimeDisplay();
        updateProgressBar();
        resetCropConfig('trimVideo');
      } else {
        updateCropConfig('trimVideo');
      }
    }
  }
}

function restoreCheckboxStates() {
  const cropCheckbox = document.getElementById('crop-toggle-checkbox');
  if (cropCheckbox) {
    cropCheckbox.checked = mtcv_showCropBox;
    
    if (mtcv_showCropBox) {
      updateCropBoxUI('restoreCheckboxStates 1092');
      enableRatioButtons();
    } else {
      mtcv_box.visible = false;
      updateCropBoxUI('restoreCheckboxStates 1094');
      disableRatioButtons();
      
      updateElementText(mtcv_dimensionWidth, 0);
      updateElementText(mtcv_dimensionHeight, 0);
      updateElementText(mtcv_dimensionX, 0);
      updateElementText(mtcv_dimensionY, 0);
      
      const ratioButtons = getEls('.mtcv-ratio-btn');
      toggleClassForElements(ratioButtons, 'mtcv-crop-ratios-active', false);
      
      const overlays = [mtcv_overlayTop, mtcv_overlayLeft, mtcv_overlayRight, mtcv_overlayBottom];
      overlays.forEach(o => {
        if (o) o.style.display = 'none';
      });
    }
  }

  const trimCheckbox = document.getElementById('trim-video-toggle-checkbox');
  if (trimCheckbox) {
    trimCheckbox.checked = mtcv_showTrimVideo;
    const timelineTrack = document.querySelector('.mtcv-timeline-track');
    if (timelineTrack) {
      timelineTrack.classList.toggle('mtcv-timeline-track-disabled', !mtcv_showTrimVideo);
    }
  }

  const verticalCheckbox = document.getElementById('vertical-toggle-checkbox');
  if (verticalCheckbox) {
    verticalCheckbox.checked = mtcv_showVerticalFlip;
    mtcv_flipState.vertical = mtcv_showVerticalFlip;
    applyFlipToVideo();
  }

  const horizontalCheckbox = document.getElementById('horizontal-toggle-checkbox');
  if (horizontalCheckbox) {
    horizontalCheckbox.checked = mtcv_showHorizontalFlip;
    mtcv_flipState.horizontal = mtcv_showHorizontalFlip;
    applyFlipToVideo();
  }
}