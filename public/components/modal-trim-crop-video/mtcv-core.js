let isRestoringCropBox = false;
let dualRange = null;
let mtcv_lastOriginalCrop = null;

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

  // SỬA: Restore states TRƯỚC khi load video
  // Điều này đảm bảo mtcv_showCropBox được set đúng trước khi fitMediaToContainer chạy
  restoreStatesFromConfig();

  setupEventListeners();
  loadVideoFromUrl(APP_STATE.urlVideo);
  initializeMTCVTimeline();
  setupRatioButtons();
  setupFlipControls();
  setupScaleListener();
  setupCropRatiosDragScroll();
  
  restoreCheckboxStates();
  
  // Chỉ populate flip controls ngay (không cần video load)
  if (APP_STATE.configConvertVideo) {
    populateFlipControls(APP_STATE.configConvertVideo.flip);
  }
  return true;
}

function restoreStatesFromConfig() {
  if (!APP_STATE.configConvertVideo) {
    return;
  }
  
  const config = APP_STATE.configConvertVideo;
  
  if (config.cropCheck === true) {
    mtcv_showCropBox = true;
  } else {
    mtcv_showCropBox = false;
  }
  
  if (config.trimCheck === true) {
    mtcv_showTrimVideo = true;
    if (config.startTime !== undefined) {
      mtcv_startTime = typeof config.startTime === 'string' 
        ? timeStringToSeconds(config.startTime) 
        : config.startTime;
    } else {
      mtcv_startTime = 0;
    }
    
    if (config.endTime !== undefined) {
      const videoDuration = APP_STATE.selectedFileInfo?.duration || mtcv_videoDuration || 0;
      mtcv_endTime = typeof config.endTime === 'string' 
        ? timeStringToSeconds(config.endTime) 
        : config.endTime;
      if (mtcv_endTime > videoDuration) {
        mtcv_endTime = videoDuration;
      }
    } else {
      const videoDuration = APP_STATE.selectedFileInfo?.duration || mtcv_videoDuration || 0;
      mtcv_endTime = videoDuration;
    }
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
  
  // Luôn đồng bộ ratio; nếu không có thì reset về null để tránh giữ ratio cũ
  mtcv_currentRatio = config.ratio ? config.ratio : null;
}

function populateModalFromConfig() {
  if (!APP_STATE.configConvertVideo) {
    return;
  }
  const config = APP_STATE.configConvertVideo;
  
  if (mtcv_showCropBox && mtcv_mediaLoaded && mtcv_mediaWidth && mtcv_mediaHeight) {
    populateDimensionsInfo(config);
    populateCropRatios(config.ratio);
    populateCropBox(config);
  }
  
  populateFlipControls(config.flip);
  
  if (config.trimCheck && config.startTime !== undefined && config.endTime !== undefined && mtcv_videoDuration) {
    populateTimeline(config.startTime, config.endTime);
  }
}

function populateDimensionsInfo(config) {
  const safeNum = (v, fallback = 0) => (typeof v === 'number' && !isNaN(v) ? v : fallback);
  updateElementStyle(mtcv_dimensionWidth, { textContent: safeNum(config.width) });
  updateElementStyle(mtcv_dimensionHeight, { textContent: safeNum(config.height) });
  updateElementStyle(mtcv_dimensionX, { textContent: safeNum(config.x) });
  updateElementStyle(mtcv_dimensionY, { textContent: safeNum(config.y) });
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
  
  // ✅ CRITICAL: Nếu config tồn tại, đó là SOURCE OF TRUTH - restore chính xác
  if (!config || 
      typeof config.width !== 'number' || 
      typeof config.height !== 'number' ||
      typeof config.x !== 'number' ||
      typeof config.y !== 'number' ||
      config.width <= 0 ||
      config.height <= 0) {
    // Không có valid config → không restore
    return;
  }
  
  isRestoringCropBox = true;

  // ✅ Sanitize config values để tránh NaN
  const safeNum = (v, fallback = 0) => (typeof v === 'number' && !isNaN(v) ? v : fallback);
  const cfg = {
    x: safeNum(config.x),
    y: safeNum(config.y),
    width: safeNum(config.width),
    height: safeNum(config.height),
  };

  // ✅ Restore EXACTLY từ config (không tính toán lại, không làm tròn)
  const { scaleX, scaleY } = calculateScaleFactors(mtcv_mediaWidth, mtcv_mediaHeight, mtcv_origWidth, mtcv_origHeight);
  const { x: scaledX, y: scaledY, width: scaledWidth, height: scaledHeight } = originalToScaled(
    cfg.x, cfg.y, cfg.width, cfg.height, scaleX, scaleY
  );

  // ✅ Áp dụng chính xác giá trị từ config (UI space - không làm tròn)
  mtcv_box.x = scaledX;
  mtcv_box.y = scaledY;
  mtcv_box.w = scaledWidth;
  mtcv_box.h = scaledHeight;
  mtcv_box.visible = mtcv_showCropBox;
  updateCropBoxUI();
  
  // ✅ Sync ratio buttons UI
  const ratioButtons = getEls('.mtcv-ratio-btn');
  toggleClassForElements(ratioButtons, 'mtcv-crop-ratios-active', false);
  
  let targetRatio = 'custom';
  if (mtcv_currentRatio) {
    if (mtcv_currentRatio.width === 1 && mtcv_currentRatio.height === 1) {
      targetRatio = '1:1';
    } else if (mtcv_currentRatio.width === 9 && mtcv_currentRatio.height === 16) {
      targetRatio = '9:16';
    } else if (mtcv_currentRatio.width === 16 && mtcv_currentRatio.height === 9) {
      targetRatio = '16:9';
    } else if (mtcv_currentRatio.width === 4 && mtcv_currentRatio.height === 3) {
      targetRatio = '4:3';
    }
  }
  
  const targetButton = getEl(`[data-ratio="${targetRatio}"]`);
  if (targetButton) {
    targetButton.classList.add('mtcv-crop-ratios-active');
  }
  
  setTimeout(() => {
    isRestoringCropBox = false;
  }, 100);
}

function setupEventListeners() {
  if (!mtcv_cropBox) return;

  mtcv_cropBox.addEventListener('pointerdown', (ev) => {
    const isVideoControl = ev.target.closest('video') ||
      ev.target.tagName === 'VIDEO' ||
      ev.target.classList.contains('video-controls') ||
      ev.target.closest('.video-controls');

    if (isVideoControl) return;

    let isResizeHandle = null;
    if (ev.target.classList.contains('mtcv-handle')) {
      isResizeHandle = ev.target;
    } else {
      isResizeHandle = ev.target.closest('.mtcv-handle');
    }
    
    if (isResizeHandle) {
      const handle = isResizeHandle.dataset.handle;
      if (handle && handle !== 'move') {
        ev.preventDefault();
        ev.stopPropagation();

        mtcv_pointerStart = { x: ev.clientX, y: ev.clientY };
        mtcv_boxStart = { x: mtcv_box.x, y: mtcv_box.y, w: mtcv_box.w, h: mtcv_box.h };
        mtcv_action = 'resize-' + handle;
        document.body.style.cursor = getCursorForHandle(handle);

        isResizeHandle.setPointerCapture(ev.pointerId);
        return;
      }
    }
    
    ev.preventDefault();
    ev.stopPropagation();

    mtcv_action = 'move';
    document.body.style.cursor = 'move';
    mtcv_pointerStart = { x: ev.clientX, y: ev.clientY };
    mtcv_boxStart = { x: mtcv_box.x, y: mtcv_box.y, w: mtcv_box.w, h: mtcv_box.h };

    ev.target.setPointerCapture(ev.pointerId);
  });

  let lastMoveEvent = null;
  let animationFrameRequested = false;

  const isModalOpen = () => {
    const modal = document.querySelector('.mtcv-container.mtcv-show');
    return modal !== null;
  };

  const isCropBoxEvent = (ev) => {
    const target = ev.target;
    const cropBox = target.closest('.mtcv-crop-box, .mtcv-stage, .mtcv-handle');
    return cropBox !== null;
  };

  const handlePointerMove = (ev) => {
    if (!mtcv_action || !isModalOpen()) {
      return;
    }
    
    ev.preventDefault();
    ev.stopPropagation();
    
    lastMoveEvent = ev;

    if (!animationFrameRequested) {
      animationFrameRequested = true;
      requestAnimationFrame(() => {
        if (lastMoveEvent && mtcv_action && isModalOpen()) {
          handlePointerMoveInternal(lastMoveEvent);
        }
        animationFrameRequested = false;
        lastMoveEvent = null;
      });
    }
  };

  document.addEventListener('pointermove', handlePointerMove, { passive: false });

  const handlePointerUp = (ev) => {
    if (!mtcv_action || !isModalOpen()) {
      return;
    }
    
    ev.preventDefault();
    ev.stopPropagation();
    
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
        updateCropBoxUI();
      }
    }

    // Flush UI -> state ngay khi kết thúc kéo để không lưu giá trị cũ
    try {
      updateCropBoxUI();
      updateCropConfig('cropBox');
    } catch (e) {
      console.warn('Flush crop config on pointerup failed:', e);
    }

    document.body.style.cursor = '';
    mtcv_action = null;
    lastMoveEvent = null;
    animationFrameRequested = false;
  };

  document.addEventListener('pointerup', handlePointerUp, { passive: false });

  const handleWheel = (ev) => {
    if (mtcv_action && isModalOpen()) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  document.addEventListener('wheel', handleWheel, { passive: false });

  const handleTouchMove = (ev) => {
    if (mtcv_action && isModalOpen()) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  document.addEventListener('touchmove', handleTouchMove, { passive: false });

  const handleTouchEnd = (ev) => {
    if (mtcv_action && isModalOpen()) {
      mtcv_action = null;
      document.body.style.cursor = '';
      lastMoveEvent = null;
      animationFrameRequested = false;
    }
  };

  document.addEventListener('touchend', handleTouchEnd, { passive: false });
  document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function handlePointerMoveInternal(ev) {
  const stageDims = getMTCVStageDimensions();
  const { dx, dy } = getScaledMouseDelta(ev, mtcv_pointerStart, stageDims);

  if (mtcv_action === 'move') {
    // ==================
    // MOVE CROP-BOX
    // ==================
    mtcv_box.x = mtcv_boxStart.x + dx;
    mtcv_box.y = mtcv_boxStart.y + dy;

    constrainCropBox(
      mtcv_box,
      mtcv_mediaWidth,
      mtcv_mediaHeight,
      mtcv_minSize,
      mtcv_origWidth,
      mtcv_origHeight
    );

    if (mtcv_box.x + mtcv_box.w > mtcv_mediaWidth) {
      mtcv_box.x = mtcv_mediaWidth - mtcv_box.w;
      if (mtcv_box.x < 0) {
        mtcv_box.x = 0;
        mtcv_box.w = mtcv_mediaWidth;
      }
    }
    if (mtcv_box.y + mtcv_box.h > mtcv_mediaHeight) {
      mtcv_box.y = mtcv_mediaHeight - mtcv_box.h;
      if (mtcv_box.y < 0) {
        mtcv_box.y = 0;
        mtcv_box.h = mtcv_mediaHeight;
      }
    }

    updateCropBoxUI();
    return;
  }

  // ==================
  // RESIZE CROP-BOX (CLEAN ANCHOR-BASED IMPLEMENTATION)
  // ==================
  if (mtcv_action && mtcv_action.startsWith('resize-')) {
    const corner = mtcv_action.split('-')[1];
    const isRatioMode = !!mtcv_currentRatio;

    // ============================================
    // STEP 1: DETERMINE ANCHOR CORNER (FIXED)
    // ============================================
    // Anchor corner is the OPPOSITE corner from the dragged handle
    // Anchor MUST NEVER move, NEVER be adjusted
    let anchorX, anchorY;
    
    switch (corner) {
      case 'tl':  // Top-Left dragged → Bottom-Right is anchor
        anchorX = mtcv_boxStart.x + mtcv_boxStart.w;
        anchorY = mtcv_boxStart.y + mtcv_boxStart.h;
        break;
      case 'tr':  // Top-Right dragged → Bottom-Left is anchor
        anchorX = mtcv_boxStart.x;
        anchorY = mtcv_boxStart.y + mtcv_boxStart.h;
        break;
      case 'bl':  // Bottom-Left dragged → Top-Right is anchor
        anchorX = mtcv_boxStart.x + mtcv_boxStart.w;
        anchorY = mtcv_boxStart.y;
        break;
      case 'br':  // Bottom-Right dragged → Top-Left is anchor
        anchorX = mtcv_boxStart.x;
        anchorY = mtcv_boxStart.y;
        break;
    }

    // ============================================
    // STEP 2: CALCULATE CURSOR POSITION FROM DELTA
    // ============================================
    let cursorStartX, cursorStartY;
    switch (corner) {
      case 'tl':
        cursorStartX = mtcv_boxStart.x;
        cursorStartY = mtcv_boxStart.y;
        break;
      case 'tr':
        cursorStartX = mtcv_boxStart.x + mtcv_boxStart.w;
        cursorStartY = mtcv_boxStart.y;
        break;
      case 'bl':
        cursorStartX = mtcv_boxStart.x;
        cursorStartY = mtcv_boxStart.y + mtcv_boxStart.h;
        break;
      case 'br':
        cursorStartX = mtcv_boxStart.x + mtcv_boxStart.w;
        cursorStartY = mtcv_boxStart.y + mtcv_boxStart.h;
        break;
    }

    let cursorX = cursorStartX + dx;
    let cursorY = cursorStartY + dy;

    // ============================================
    // STEP 3: CLAMP CURSOR - PREVENT CROSSING ANCHOR
    // ============================================
    // CRITICAL: Cursor MUST NEVER cross anchor
    // This prevents flip/invert
    switch (corner) {
      case 'tl':  // Cursor must stay LEFT and ABOVE anchor
        cursorX = Math.max(0, Math.min(cursorX, anchorX));
        cursorY = Math.max(0, Math.min(cursorY, anchorY));
        break;
      case 'tr':  // Cursor must stay RIGHT and ABOVE anchor
        cursorX = Math.max(anchorX, Math.min(cursorX, mtcv_mediaWidth));
        cursorY = Math.max(0, Math.min(cursorY, anchorY));
        break;
      case 'bl':  // Cursor must stay LEFT and BELOW anchor
        cursorX = Math.max(0, Math.min(cursorX, anchorX));
        cursorY = Math.max(anchorY, Math.min(cursorY, mtcv_mediaHeight));
        break;
      case 'br':  // Cursor must stay RIGHT and BELOW anchor
        cursorX = Math.max(anchorX, Math.min(cursorX, mtcv_mediaWidth));
        cursorY = Math.max(anchorY, Math.min(cursorY, mtcv_mediaHeight));
        break;
    }

    // ============================================
    // STEP 4: COMPUTE DESIRED WIDTH/HEIGHT
    // ============================================
    // Calculate from anchor → cursor (NO Math.abs - we know direction)
    let desiredW, desiredH;
    switch (corner) {
      case 'tl':
        desiredW = anchorX - cursorX;
        desiredH = anchorY - cursorY;
        break;
      case 'tr':
        desiredW = cursorX - anchorX;
        desiredH = anchorY - cursorY;
        break;
      case 'bl':
        desiredW = anchorX - cursorX;
        desiredH = cursorY - anchorY;
        break;
      case 'br':
        desiredW = cursorX - anchorX;
        desiredH = cursorY - anchorY;
        break;
    }

    // ============================================
    // STEP 5: RATIO-AWARE MINIMUM SIZE
    // ============================================
    let minW, minH;
    if (isRatioMode && mtcv_currentRatio) {
      // Ratio mode: min size must satisfy ratio
      minW = mtcv_minSize;
      minH = calculateDimensionFromRatio(minW, mtcv_currentRatio, true);
      // Ensure both dimensions meet minimum
      if (minH < mtcv_minSize) {
        minH = mtcv_minSize;
        minW = calculateDimensionFromRatio(minH, mtcv_currentRatio, false);
      }
    } else {
      // Free mode: independent minimums
      minW = mtcv_minSize;
      minH = mtcv_minSize;
    }

    // ============================================
    // STEP 6: ENFORCE MINIMUM SIZE
    // ============================================
    // If size is too small, adjust cursor to meet minimum
    // This may push cursor away from anchor, but NEVER past anchor
    if (desiredW < minW) {
      switch (corner) {
        case 'tl':
        case 'bl':
          cursorX = anchorX - minW;
          cursorX = Math.max(0, Math.min(cursorX, anchorX));
          break;
        case 'tr':
        case 'br':
          cursorX = anchorX + minW;
          cursorX = Math.max(anchorX, Math.min(cursorX, mtcv_mediaWidth));
          break;
      }
      // Recalculate desiredW
      switch (corner) {
        case 'tl':
        case 'bl':
          desiredW = anchorX - cursorX;
          break;
        case 'tr':
        case 'br':
          desiredW = cursorX - anchorX;
          break;
      }
    }

    if (desiredH < minH) {
      switch (corner) {
        case 'tl':
        case 'tr':
          cursorY = anchorY - minH;
          cursorY = Math.max(0, Math.min(cursorY, anchorY));
          break;
        case 'bl':
        case 'br':
          cursorY = anchorY + minH;
          cursorY = Math.max(anchorY, Math.min(cursorY, mtcv_mediaHeight));
          break;
      }
      // Recalculate desiredH
      switch (corner) {
        case 'tl':
        case 'tr':
          desiredH = anchorY - cursorY;
          break;
        case 'bl':
        case 'br':
          desiredH = cursorY - anchorY;
          break;
      }
    }

    // ============================================
    // STEP 7: RATIO MODE - LOCK RATIO STRICTLY
    // ============================================
    if (isRatioMode && mtcv_currentRatio) {
      const targetRatio = mtcv_currentRatio.width / mtcv_currentRatio.height;
      
      // Calculate which dimension to use as base (use larger movement)
      const deltaX = Math.abs(cursorX - anchorX);
      const deltaY = Math.abs(cursorY - anchorY);
      
      // Calculate size with ratio constraint
      if (deltaX * mtcv_currentRatio.height >= deltaY * mtcv_currentRatio.width) {
        // Width-based: use desiredW, calculate desiredH to maintain ratio
        desiredH = desiredW / targetRatio;
        
        // Recalculate cursor Y to match desiredH
        switch (corner) {
          case 'tl':
          case 'tr':
            cursorY = anchorY - desiredH;
            break;
          case 'bl':
          case 'br':
            cursorY = anchorY + desiredH;
            break;
        }
      } else {
        // Height-based: use desiredH, calculate desiredW to maintain ratio
        desiredW = desiredH * targetRatio;
        
        // Recalculate cursor X to match desiredW
        switch (corner) {
          case 'tl':
          case 'bl':
            cursorX = anchorX - desiredW;
            break;
          case 'tr':
          case 'br':
            cursorX = anchorX + desiredW;
            break;
        }
      }
      
      // Clamp cursor to bounds and prevent crossing anchor
      switch (corner) {
        case 'tl':
          cursorX = Math.max(0, Math.min(cursorX, anchorX));
          cursorY = Math.max(0, Math.min(cursorY, anchorY));
          break;
        case 'tr':
          cursorX = Math.max(anchorX, Math.min(cursorX, mtcv_mediaWidth));
          cursorY = Math.max(0, Math.min(cursorY, anchorY));
          break;
        case 'bl':
          cursorX = Math.max(0, Math.min(cursorX, anchorX));
          cursorY = Math.max(anchorY, Math.min(cursorY, mtcv_mediaHeight));
          break;
        case 'br':
          cursorX = Math.max(anchorX, Math.min(cursorX, mtcv_mediaWidth));
          cursorY = Math.max(anchorY, Math.min(cursorY, mtcv_mediaHeight));
          break;
      }
      
      // Recalculate desired size from clamped cursor with ratio constraint
      // This ensures ratio is ALWAYS maintained
      let tempW, tempH;
      switch (corner) {
        case 'tl':
          tempW = anchorX - cursorX;
          tempH = anchorY - cursorY;
          break;
        case 'tr':
          tempW = cursorX - anchorX;
          tempH = anchorY - cursorY;
          break;
        case 'bl':
          tempW = anchorX - cursorX;
          tempH = cursorY - anchorY;
          break;
        case 'br':
          tempW = cursorX - anchorX;
          tempH = cursorY - anchorY;
          break;
      }
      
      // Apply ratio constraint to temp size
      const tempRatio = tempW / tempH;
      if (Math.abs(tempRatio - targetRatio) > 0.001) {
        // Choose dimension that gives larger result
        const heightFromWidth = tempW / targetRatio;
        const widthFromHeight = tempH * targetRatio;
        
        if (heightFromWidth <= tempH) {
          desiredW = tempW;
          desiredH = heightFromWidth;
        } else {
          desiredW = widthFromHeight;
          desiredH = tempH;
        }
      } else {
        desiredW = tempW;
        desiredH = tempH;
      }
      
      // Ensure minimum size with ratio
      if (desiredW < minW || desiredH < minH) {
        if (desiredW < minW) {
          desiredW = minW;
          desiredH = calculateDimensionFromRatio(minW, mtcv_currentRatio, true);
        }
        if (desiredH < minH) {
          desiredH = minH;
          desiredW = calculateDimensionFromRatio(minH, mtcv_currentRatio, false);
        }
      }
    }

    // ============================================
    // STEP 8: REBUILD CROP BOX FROM ANCHOR + SIZE
    // ============================================
    // Calculate box position from anchor corner
    let finalX, finalY, finalW, finalH;
    
    switch (corner) {
      case 'tl':  // Anchor is bottom-right
        finalW = desiredW;
        finalH = desiredH;
        finalX = anchorX - finalW;
        finalY = anchorY - finalH;
        break;
      case 'tr':  // Anchor is bottom-left
        finalW = desiredW;
        finalH = desiredH;
        finalX = anchorX;
        finalY = anchorY - finalH;
        break;
      case 'bl':  // Anchor is top-right
        finalW = desiredW;
        finalH = desiredH;
        finalX = anchorX - finalW;
        finalY = anchorY;
        break;
      case 'br':  // Anchor is top-left
        finalW = desiredW;
        finalH = desiredH;
        finalX = anchorX;
        finalY = anchorY;
        break;
    }

    // ============================================
    // STEP 9: CLAMP TO MEDIA BOUNDS (CURSOR STOPS, ANCHOR NEVER MOVES)
    // ============================================
    // If box exceeds bounds, adjust size (cursor stops)
    // Anchor position NEVER changes
    // In ratio mode, maintain ratio while clamping
    
    if (finalX < 0) {
      // Box extends past left edge - reduce width
      switch (corner) {
        case 'tl':
        case 'bl':
          // Cursor is on left, reduce width
          finalW = finalW + finalX;  // Reduce by overflow
          finalX = 0;
          // In ratio mode, adjust height to maintain ratio
          if (isRatioMode && mtcv_currentRatio) {
            finalH = finalW / (mtcv_currentRatio.width / mtcv_currentRatio.height);
            // Recalculate Y to maintain anchor
            switch (corner) {
              case 'tl':
                finalY = anchorY - finalH;
                break;
              case 'bl':
                finalY = anchorY;
                break;
            }
          }
          break;
        case 'tr':
        case 'br':
          // Anchor is on left, reduce width
          finalW = finalW + finalX;
          finalX = 0;
          // In ratio mode, adjust height to maintain ratio
          if (isRatioMode && mtcv_currentRatio) {
            finalH = finalW / (mtcv_currentRatio.width / mtcv_currentRatio.height);
            switch (corner) {
              case 'tr':
                finalY = anchorY - finalH;
                break;
              case 'br':
                finalY = anchorY;
                break;
            }
          }
          break;
      }
    }
    
    if (finalY < 0) {
      // Box extends past top edge - reduce height
      switch (corner) {
        case 'tl':
        case 'tr':
          // Cursor is on top, reduce height
          finalH = finalH + finalY;
          finalY = 0;
          // In ratio mode, adjust width to maintain ratio
          if (isRatioMode && mtcv_currentRatio) {
            finalW = finalH * (mtcv_currentRatio.width / mtcv_currentRatio.height);
            switch (corner) {
              case 'tl':
                finalX = anchorX - finalW;
                break;
              case 'tr':
                finalX = anchorX;
                break;
            }
          }
          break;
        case 'bl':
        case 'br':
          // Anchor is on top, reduce height
          finalH = finalH + finalY;
          finalY = 0;
          // In ratio mode, adjust width to maintain ratio
          if (isRatioMode && mtcv_currentRatio) {
            finalW = finalH * (mtcv_currentRatio.width / mtcv_currentRatio.height);
            switch (corner) {
              case 'bl':
                finalX = anchorX - finalW;
                break;
              case 'br':
                finalX = anchorX;
                break;
            }
          }
          break;
      }
    }
    
    if (finalX + finalW > mtcv_mediaWidth) {
      // Box extends past right edge - reduce width
      const overflowRight = (finalX + finalW) - mtcv_mediaWidth;
      finalW = finalW - overflowRight;
      // In ratio mode, adjust height to maintain ratio
      if (isRatioMode && mtcv_currentRatio) {
        finalH = finalW / (mtcv_currentRatio.width / mtcv_currentRatio.height);
        // Recalculate Y to maintain anchor
        switch (corner) {
          case 'tl':
            finalY = anchorY - finalH;
            break;
          case 'tr':
            finalY = anchorY - finalH;
            break;
          case 'bl':
            finalY = anchorY;
            break;
          case 'br':
            finalY = anchorY;
            break;
        }
      }
    }
    
    if (finalY + finalH > mtcv_mediaHeight) {
      // Box extends past bottom edge - reduce height
      const overflowBottom = (finalY + finalH) - mtcv_mediaHeight;
      finalH = finalH - overflowBottom;
      // In ratio mode, adjust width to maintain ratio
      if (isRatioMode && mtcv_currentRatio) {
        finalW = finalH * (mtcv_currentRatio.width / mtcv_currentRatio.height);
        // Recalculate X to maintain anchor
        switch (corner) {
          case 'tl':
            finalX = anchorX - finalW;
            break;
          case 'tr':
            finalX = anchorX;
            break;
          case 'bl':
            finalX = anchorX - finalW;
            break;
          case 'br':
            finalX = anchorX;
            break;
        }
      }
    }

    // ============================================
    // STEP 10: FINAL MINIMUM SIZE CHECK
    // ============================================
    if (finalW < minW) finalW = minW;
    if (finalH < minH) finalH = minH;

    // ============================================
    // STEP 11: APPLY TO UI (NO ROUNDING)
    // ============================================
    mtcv_box.x = finalX;
    mtcv_box.y = finalY;
    mtcv_box.w = finalW;
    mtcv_box.h = finalH;

    updateCropBoxUI();
  }
}

function loadVideoFromUrl(videoUrl) {
  if (!videoUrl || !mtcv_displayedVideo) return;

  const mtcvThumbnailNotPlayVideo = document.querySelector('.mtcv-thumbnail-not-play-video');
  if (mtcvThumbnailNotPlayVideo) {
    mtcvThumbnailNotPlayVideo.style.display = 'none';
  }
  
  mtcv_displayedVideo.style.display = 'block';
  mtcv_displayedVideo.style.visibility = 'visible';
  mtcv_displayedVideo.style.opacity = '1';

  const checkAndFitVideo = () => {
    if (mtcv_displayedVideo.videoWidth > 0 && mtcv_displayedVideo.videoHeight > 0) {
      mtcv_origWidth = mtcv_displayedVideo.videoWidth;
      mtcv_origHeight = mtcv_displayedVideo.videoHeight;
      mtcv_mediaLoaded = true;
      
      // ✅ Ẩn warning container khi video load thành công
      const warningContainer = document.querySelector('.desktop-not-supported__message-warning-container');
      if (warningContainer) {
        warningContainer.style.display = 'none';
      }
      
      // ✅ Hiển thị control video khi video load thành công
      const controlVideo = document.getElementById('id-control-video');
      if (controlVideo) {
        controlVideo.style.display = '';
      }
      
      fitMediaToContainer();
      setTimeout(() => {
        if (APP_STATE.configConvertVideo) {
          const config = APP_STATE.configConvertVideo;
          const hasValidConfig = config.cropCheck === true &&
            typeof config.width === 'number' &&
            typeof config.height === 'number' &&
            typeof config.x === 'number' &&
            typeof config.y === 'number' &&
            config.width > 0 &&
            config.height > 0;
          
          if (mtcv_showCropBox && mtcv_mediaWidth && mtcv_mediaHeight && hasValidConfig) {
            populateModalFromConfig();
          } else if (mtcv_showCropBox && !hasValidConfig) {
            console.log('Config invalid or missing, using default cropbox');
          }
          
          if (config.trimCheck && config.startTime !== undefined && config.endTime !== undefined) {
            populateTimeline(config.startTime, config.endTime);
          }
        } else if (mtcv_showCropBox) {
          console.log('No config found, using default cropbox');
        }
      }, 200);
      
      showEditorAfterLoad();
      return true;
    }
    return false;
  };

  const useFileInfoFallback = () => {
    if (APP_STATE.selectedFileInfo && APP_STATE.selectedFileInfo.width && APP_STATE.selectedFileInfo.height) {
      console.log('Using fileInfo fallback for video dimensions');
      mtcv_origWidth = APP_STATE.selectedFileInfo.width;
      mtcv_origHeight = APP_STATE.selectedFileInfo.height;
      mtcv_mediaLoaded = true;
      
      // ✅ Ẩn warning container khi video load thành công (fallback)
      const warningContainer = document.querySelector('.desktop-not-supported__message-warning-container');
      if (warningContainer) {
        warningContainer.style.display = 'none';
      }
      
      // ✅ Hiển thị control video khi video load thành công (fallback)
      const controlVideo = document.getElementById('id-control-video');
      if (controlVideo) {
        controlVideo.style.display = '';
      }
      
      fitMediaToContainer();
      
      setTimeout(() => {
        if (APP_STATE.configConvertVideo) {
          const config = APP_STATE.configConvertVideo;
          const hasValidConfig = config.cropCheck === true &&
            typeof config.width === 'number' &&
            typeof config.height === 'number' &&
            typeof config.x === 'number' &&
            typeof config.y === 'number' &&
            config.width > 0 &&
            config.height > 0;
          
          if (mtcv_showCropBox && mtcv_mediaWidth && mtcv_mediaHeight && hasValidConfig) {
            console.log('Restoring cropbox from config (fallback):', config);
            populateModalFromConfig();
          } else if (mtcv_showCropBox && !hasValidConfig) {
            console.log('Config invalid or missing, using default cropbox (fallback)');
          }
          
          if (config.trimCheck && config.startTime !== undefined && config.endTime !== undefined) {
            populateTimeline(config.startTime, config.endTime);
          }
        } else if (mtcv_showCropBox) {
          console.log('No config found, using default cropbox (fallback)');
        }
      }, 200);
      
      showEditorAfterLoad();
      return true;
    }
    return false;
  };

  mtcv_displayedVideo.onloadedmetadata = () => {
    console.log('onloadedmetadata fired, videoWidth:', mtcv_displayedVideo.videoWidth, 'videoHeight:', mtcv_displayedVideo.videoHeight);
    
    mtcv_displayedVideo.style.display = 'block';
    mtcv_displayedVideo.style.visibility = 'visible';
    
    if (checkAndFitVideo()) {
      return;
    }
    
    setTimeout(() => {
      if (!checkAndFitVideo()) {
        if (!useFileInfoFallback()) {
          console.error('Cannot get video dimensions from video element or fileInfo');
        }
      }
    }, 100);
  };

  mtcv_displayedVideo.addEventListener('loadeddata', () => {
    mtcv_displayedVideo.removeAttribute("poster");
    console.log('loadeddata fired, videoWidth:', mtcv_displayedVideo.videoWidth, 'videoHeight:', mtcv_displayedVideo.videoHeight);
    mtcv_displayedVideo.style.display = 'block';
    mtcv_displayedVideo.style.visibility = 'visible';
    
    if (!mtcv_mediaLoaded && mtcv_displayedVideo.videoWidth > 0 && mtcv_displayedVideo.videoHeight > 0) {
      if (checkAndFitVideo()) {
        return;
      }
    }
  });

  mtcv_displayedVideo.addEventListener('canplay', () => {
    console.log('canplay fired, videoWidth:', mtcv_displayedVideo.videoWidth, 'videoHeight:', mtcv_displayedVideo.videoHeight);
    
    mtcv_displayedVideo.style.display = 'block';
    mtcv_displayedVideo.style.visibility = 'visible';
    if (!mtcv_mediaLoaded && mtcv_displayedVideo.videoWidth > 0 && mtcv_displayedVideo.videoHeight > 0) {
      if (checkAndFitVideo()) {
        return;
      }
    }
  });

  const mtcvTimeMarker = document.querySelector('.current-time-marker');
  if (mtcvTimeMarker) {
    mtcvTimeMarker.style.display = 'block';
  }

  mtcv_displayedVideo.onerror = () => {
    const mtcvThumbnailNotPlayVideo = document.querySelector('.mtcv-thumbnail-not-play-video');
    const mtcvDisplayedVideo = document.querySelector('.mtcv-displayed-video');
    const mtcvTimeMarker = document.querySelector('.current-time-marker');
    const warningContainer = document.querySelector('.desktop-not-supported__message-warning-container');
    const controlVideo = document.getElementById('id-control-video');
    
    if (mtcvTimeMarker) {
      mtcvTimeMarker.style.display = 'none';
    }
    
    // ✅ Hiển thị warning message
    if (warningContainer) {
      warningContainer.style.display = 'flex';
    }
    
    // ✅ Ẩn control video
    if (controlVideo) {
      controlVideo.style.display = 'none';
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
  
  const scaleW = containerW / mtcv_origWidth;
  const scaleH = containerH / mtcv_origHeight;
  const scale = Math.min(scaleW, scaleH);

  let scaledWidth = mtcv_origWidth * scale;
  let scaledHeight = mtcv_origHeight * scale;
  
  // ✅ Sửa: Dùng roundToEven thay vì Math.round để đảm bảo số chẵn
  mtcv_mediaWidth = roundToEven(scaledWidth);
  mtcv_mediaHeight = roundToEven(scaledHeight);

  const mediaLeft = Math.floor((containerW - mtcv_mediaWidth) / 2);
  const mediaTop = Math.floor((containerH - mtcv_mediaHeight) / 2);

  const videoWrapper = mtcv_displayedVideo.parentElement;
  if (videoWrapper && videoWrapper.classList.contains('mtcv-video-wrapper')) {
    updateElementStyle(videoWrapper, {
      left: mediaLeft + 'px',
      top: mediaTop + 'px',
      width: mtcv_mediaWidth + 'px',
      height: mtcv_mediaHeight + 'px',
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      boxSizing: 'border-box'
    });
    
    if (APP_STATE.selectedFileInfo && APP_STATE.selectedFileInfo.thumbnail) {
      videoWrapper.style.backgroundImage = `url(${APP_STATE.selectedFileInfo.thumbnail})`;
      videoWrapper.style.backgroundSize = 'cover';
      videoWrapper.style.backgroundPosition = 'center';
      videoWrapper.style.backgroundRepeat = 'no-repeat';
    } else {
      videoWrapper.style.backgroundImage = 'none';
      videoWrapper.style.backgroundColor = '#f0f0f0';
    }
    
    updateElementStyle(mtcv_displayedVideo, {
      width: mtcv_mediaWidth + 'px',
      height: mtcv_mediaHeight + 'px',
      left: '0',
      top: '0',
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      objectFit: 'contain',
      boxSizing: 'border-box'
    });
    
    requestAnimationFrame(() => {
      const actualRect = videoWrapper.getBoundingClientRect();
      const actualVideoRect = mtcv_displayedVideo.getBoundingClientRect();
      console.log('Video wrapper actual:', {
        width: actualRect.width,
        height: actualRect.height,
        left: actualRect.left,
        top: actualRect.top
      });
      console.log('Video element actual:', {
        width: actualVideoRect.width,
        height: actualVideoRect.height,
        left: actualVideoRect.left,
        top: actualVideoRect.top
      });
      console.log('Expected:', {
        width: mtcv_mediaWidth,
        height: mtcv_mediaHeight,
        left: mediaLeft,
        top: mediaTop
      });
      
      if (Math.abs(actualRect.width - mtcv_mediaWidth) > 1 || Math.abs(actualRect.height - mtcv_mediaHeight) > 1) {
        console.warn('Video wrapper dimensions mismatch, adjusting...');
        mtcv_mediaWidth = Math.round(actualRect.width);
        mtcv_mediaHeight = Math.round(actualRect.height);
        mtcv_mediaOffsetX = Math.round(actualRect.left - mtcv_stage.getBoundingClientRect().left);
        mtcv_mediaOffsetY = Math.round(actualRect.top - mtcv_stage.getBoundingClientRect().top);
        updateCropBoxUI();
      }
    });
  } else {
    updateElementStyle(mtcv_displayedVideo, {
      width: mtcv_mediaWidth + 'px',
      height: mtcv_mediaHeight + 'px',
      left: mediaLeft + 'px',
      top: mediaTop + 'px',
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      objectFit: 'contain',
      boxSizing: 'border-box'
    });
  }

  mtcv_mediaOffsetX = mediaLeft;
  mtcv_mediaOffsetY = mediaTop;

  const hasValidConfig = APP_STATE.configConvertVideo && 
    APP_STATE.configConvertVideo.cropCheck === true &&
    typeof APP_STATE.configConvertVideo.width === 'number' &&
    typeof APP_STATE.configConvertVideo.height === 'number' &&
    typeof APP_STATE.configConvertVideo.x === 'number' &&
    typeof APP_STATE.configConvertVideo.y === 'number' &&
    APP_STATE.configConvertVideo.width > 0 &&
    APP_STATE.configConvertVideo.height > 0;

  // ✅ CRITICAL: If valid config exists, DO NOT initialize default crop box
  // Only restore via populateCropBox() - DO NOT modify mtcv_box or APP_STATE here
  if (mtcv_showCropBox && hasValidConfig) {
    // Valid config exists - DO NOT create default crop, DO NOT modify state
    // Crop box will be restored by populateCropBox() called from loadVideoFromUrl
    mtcv_box.visible = mtcv_showCropBox;
  } else if (mtcv_showCropBox && !hasValidConfig) {
    // Only create default crop if NO valid config exists
    const initialW = Math.round(mtcv_mediaWidth * 0.5);
    const initialH = Math.round(mtcv_mediaHeight * 0.5);

    mtcv_box.w = initialW;
    mtcv_box.h = initialH;
    mtcv_box.x = Math.round((mtcv_mediaWidth - mtcv_box.w) / 2);
    mtcv_box.y = Math.round((mtcv_mediaHeight - mtcv_box.h) / 2);
    mtcv_box.visible = mtcv_showCropBox;

    // ✅ UI render only - NO state persistence
    updateCropBoxUI();
  } else {
    mtcv_box.visible = mtcv_showCropBox;
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

function updateCropBoxUI() {
  if (!mtcv_box.visible || !mtcv_cropBox) {
    if (mtcv_cropBox) mtcv_cropBox.style.display = 'none';
    updateOverlays();
    updateElementText(mtcv_dimensionWidth, 0);
    updateElementText(mtcv_dimensionHeight, 0);
    updateElementText(mtcv_dimensionX, 0);
    updateElementText(mtcv_dimensionY, 0);
    if (!mtcv_showCropBox) disableRatioButtons();
    return;
  }
  
  if (mtcv_showCropBox) enableRatioButtons();
  
  updateElementStyle(mtcv_cropBox, {
    display: 'block',
    width: mtcv_box.w + 'px',
    height: mtcv_box.h + 'px',
    left: (mtcv_mediaOffsetX + mtcv_box.x) + 'px',
    top: (mtcv_mediaOffsetY + mtcv_box.y) + 'px'
  });
  
  const hasStoredCrop =
    APP_STATE.configConvertVideo &&
    typeof APP_STATE.configConvertVideo.width === 'number' &&
    typeof APP_STATE.configConvertVideo.height === 'number' &&
    typeof APP_STATE.configConvertVideo.x === 'number' &&
    typeof APP_STATE.configConvertVideo.y === 'number';

  let finalWidth;
  let finalHeight;
  let finalX;
  let finalY;

  if (isRestoringCropBox && hasStoredCrop) {
    finalWidth = APP_STATE.configConvertVideo.width;
    finalHeight = APP_STATE.configConvertVideo.height;
    finalX = APP_STATE.configConvertVideo.x;
    finalY = APP_STATE.configConvertVideo.y;
  } else {
    const { scaleX, scaleY } = calculateScaleFactors(
      mtcv_mediaWidth,
      mtcv_mediaHeight,
      mtcv_origWidth,
      mtcv_origHeight
    );

  let { x: origX, y: origY, width: origW, height: origH } = scaledToOriginal(
      mtcv_box.x,
      mtcv_box.y,
      mtcv_box.w,
      mtcv_box.h,
      scaleX,
      scaleY,
      mtcv_origWidth,
      mtcv_origHeight
  );
  
  if (mtcv_currentRatio) {
    const ratioCorrected = ensureExactRatio(origW, origH, mtcv_currentRatio, origW >= origH);
    origW = ratioCorrected.width;
    origH = ratioCorrected.height;
  }
  
    finalWidth = Math.min(origW, mtcv_origWidth);
    finalHeight = Math.min(origH, mtcv_origHeight);
  
  if (mtcv_currentRatio) {
    if (finalWidth < origW) {
      finalHeight = calculateDimensionFromRatio(finalWidth, mtcv_currentRatio, true);
      if (finalHeight > mtcv_origHeight) {
        finalHeight = mtcv_origHeight;
        finalWidth = calculateDimensionFromRatio(finalHeight, mtcv_currentRatio, false);
      }
      } else if (finalHeight < origH) {
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
  
  finalWidth = roundToEven(finalWidth, mtcv_origWidth);
  finalHeight = roundToEven(finalHeight, mtcv_origHeight);
  
  if (finalWidth > mtcv_origWidth) {
    finalWidth = mtcv_origWidth % 2 === 0 ? mtcv_origWidth : mtcv_origWidth - 1;
  }
  if (finalHeight > mtcv_origHeight) {
    finalHeight = mtcv_origHeight % 2 === 0 ? mtcv_origHeight : mtcv_origHeight - 1;
  }
  
    finalX = Math.min(origX, Math.max(0, mtcv_origWidth - finalWidth));
    finalY = Math.min(origY, Math.max(0, mtcv_origHeight - finalHeight));
  }
  
  // ✅ STATE FLOW FIX: UI render code MUST NOT persist state
  // updateCropConfig() removed - state persistence only in pointerup and saveTrimCropModal()
  
  updateElementText(mtcv_dimensionWidth, finalWidth);
  updateElementText(mtcv_dimensionHeight, finalHeight);
  updateElementText(mtcv_dimensionX, finalX);
  updateElementText(mtcv_dimensionY, finalY);

  mtcv_lastOriginalCrop = {
    width: finalWidth,
    height: finalHeight,
    x: finalX,
    y: finalY
  };

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
    if (mtcv_mediaLoaded && mtcv_mediaWidth && mtcv_mediaHeight) {
      const hasConfig = APP_STATE.configConvertVideo && 
                       APP_STATE.configConvertVideo.width !== undefined && 
                       APP_STATE.configConvertVideo.height !== undefined &&
                       APP_STATE.configConvertVideo.x !== undefined &&
                       APP_STATE.configConvertVideo.y !== undefined;
      
      if (!hasConfig) {
        const initialW = Math.round(mtcv_mediaWidth * 0.5);
        const initialH = Math.round(mtcv_mediaHeight * 0.5);
        mtcv_box.w = initialW;
        mtcv_box.h = initialH;
        mtcv_box.x = Math.round((mtcv_mediaWidth - mtcv_box.w) / 2);
        mtcv_box.y = Math.round((mtcv_mediaHeight - mtcv_box.h) / 2);
        mtcv_box.visible = true;
        const ratioButtons = document.querySelectorAll('[data-ratio]');
        ratioButtons.forEach(btn => btn.classList.remove('mtcv-crop-ratios-active'));
        const freeBtn = document.querySelector('[data-ratio="custom"]');
        if (freeBtn) freeBtn.classList.add('mtcv-crop-ratios-active');
      }
    }
    // ✅ UI render only - NO state persistence here
    updateCropBoxUI();
    // ✅ STATE FLOW FIX: updateCropConfig removed - only persist in pointerup and saveTrimCropModal
    enableRatioButtons();
  } else {
    // ✅ STATE FLOW FIX: When disabling crop, reset config immediately (explicit user action)
    updateCropBoxUI();
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
    case 'cropBox': {
      let w, h, x, y;
    
      if (mtcv_lastOriginalCrop) {
        w = mtcv_lastOriginalCrop.width;
        h = mtcv_lastOriginalCrop.height;
        x = mtcv_lastOriginalCrop.x;
        y = mtcv_lastOriginalCrop.y;
      } else {
        // fallback nếu chưa render cropBoxUI
        w = Number(mtcv_dimensionWidth?.textContent || 0);
        h = Number(mtcv_dimensionHeight?.textContent || 0);
        x = Number(mtcv_dimensionX?.textContent || 0);
        y = Number(mtcv_dimensionY?.textContent || 0);
      }
    
      APP_STATE.configConvertVideo.originalWidth = mtcv_origWidth;
      APP_STATE.configConvertVideo.originalHeight = mtcv_origHeight;
      APP_STATE.configConvertVideo.width = w;
      APP_STATE.configConvertVideo.height = h;
      APP_STATE.configConvertVideo.x = x;
      APP_STATE.configConvertVideo.y = y;
      APP_STATE.configConvertVideo.ratio = mtcv_currentRatio;
      APP_STATE.configConvertVideo.cropCheck = mtcv_showCropBox;
      break;
    }

    case 'trimVideo': {
      APP_STATE.configConvertVideo.startTime = mtcv_startTime;
      APP_STATE.configConvertVideo.endTime = mtcv_endTime;
      APP_STATE.configConvertVideo.trimCheck = mtcv_showTrimVideo;
      break;
    }

    case 'flip': {
      APP_STATE.configConvertVideo.flip = {
        vertical: mtcv_flipState.vertical,
        horizontal: mtcv_flipState.horizontal
      }
      APP_STATE.configConvertVideo.flipVerticalCheck = mtcv_showVerticalFlip;
      APP_STATE.configConvertVideo.flipHorizontalCheck = mtcv_showHorizontalFlip;
      break;
    }

    case 'all':
    default: {
      const allCropData = getCurrentCropConfig(
        mtcv_box, mtcv_mediaWidth, mtcv_mediaHeight, mtcv_origWidth, mtcv_origHeight,
        mtcv_startTime, mtcv_endTime, mtcv_flipState, mtcv_currentRatio
      );

      APP_STATE.configConvertVideo = {
        ...allCropData,
        width: allCropData.width,
        height: allCropData.height,
        x: allCropData.x,
        y: allCropData.y
      };
      APP_STATE.configConvertVideo.cropCheck = mtcv_showCropBox;
      APP_STATE.configConvertVideo.trimCheck = mtcv_showTrimVideo;
      APP_STATE.configConvertVideo.flipVerticalCheck = mtcv_showVerticalFlip;
      APP_STATE.configConvertVideo.flipHorizontalCheck = mtcv_showHorizontalFlip;
      break;
    }
  }

  if (typeof saveSettings === 'function') {
    saveSettings();
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
  });
}

function enableRatioButtons() {
  const cropCheckbox = document.getElementById('crop-toggle-checkbox');
  if (!cropCheckbox || !cropCheckbox.checked) {
    preventDefault();
    disableRatioButtons();
    return;
  }
  const ratioButtons = getEls('.mtcv-ratio-btn');
  const cropRatiosContainer = document.querySelector('.mtcv-crop-ratios');

  ratioButtons.forEach(btn => {
    btn.style.pointerEvents = 'auto';
    btn.style.cursor = 'pointer';
  });
}

function updateOverlays() {
  if (!mtcv_stage || !mtcv_overlayTop || !mtcv_overlayLeft || !mtcv_overlayRight || !mtcv_overlayBottom) return;

  const stageDims = getMTCVStageDimensions();
  const stageW = stageDims.originalWidth;
  const stageH = stageDims.originalHeight;
  
  const cropTop = Math.floor(mtcv_mediaOffsetY + mtcv_box.y);
  const cropLeft = Math.floor(mtcv_mediaOffsetX + mtcv_box.x);
  const cropRight = Math.floor(cropLeft + mtcv_box.w);
  const cropBottom = Math.floor(cropTop + mtcv_box.h);
  
  const safeCropTop = Math.max(0, Math.min(cropTop, stageH));
  const safeCropLeft = Math.max(0, Math.min(cropLeft, stageW));
  const safeCropRight = Math.max(0, Math.min(cropRight, stageW));
  const safeCropBottom = Math.max(0, Math.min(cropBottom, stageH));
  
  const overlayLeftRightHeight = safeCropBottom - safeCropTop;

  const overlayStyles = {
    top: {
      left: '0px',
      top: '0px',
      width: stageW + 'px',
      height: safeCropTop + 'px'
    },
    bottom: {
      left: '0px',
      top: safeCropBottom + 'px',
      width: stageW + 'px',
      height: Math.max(0, stageH - safeCropBottom) + 'px'
    },
    left: {
      left: '0px',
      top: safeCropTop + 'px',
      width: safeCropLeft + 'px',
      height: Math.max(0, overlayLeftRightHeight) + 'px'
    },
    right: {
      left: safeCropRight + 'px',
      top: safeCropTop + 'px',
      width: Math.max(0, stageW - safeCropRight) + 'px',
      height: Math.max(0, overlayLeftRightHeight) + 'px'
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

  updateCropBoxUI();
}

function saveTrimCropModal() {
  if (mtcv_displayedVideo && !mtcv_displayedVideo.paused) {
    mtcv_displayedVideo.pause();
  }
  
  // ✅ CRITICAL: Flush UI crop box state to config before closing modal
  // This ensures Advanced panel always shows correct W/H/X/Y values
  if (mtcv_showCropBox && mtcv_box.visible) {
    updateCropBoxUI();
    updateCropConfig('cropBox');
  }
  
  closeModal('.mtcv-container', '.config-advenced-button');
  setTrimCropFlipInfo();
  updateResolutionOptions();
  setTimeout(() => {
    const resolutionSelect = __getSelectByKey('resolution');
    if(resolutionSelect && APP_STATE.configConvertVideo && APP_STATE.configConvertVideo.width && APP_STATE.configConvertVideo.height) {
      const taregrSizeSelect = __getSelectByKey('target-size');
      if(!taregrSizeSelect.dataset.value || taregrSizeSelect.dataset.value == '') {
        setCustomSelectValue(resolutionSelect, `${APP_STATE.configConvertVideo.width}x${APP_STATE.configConvertVideo.height}`);
      }
      else {
        disableOption(true);
      }
    }
  })

  // Persist cấu hình đã lưu để lần mở sau giữ nguyên
  try {
    localStorage.setItem('APP_STATE', JSON.stringify(APP_STATE.configConvertVideo || {}));
    localStorage.setItem('ratio', JSON.stringify(typeof mtcv_currentRatio !== "undefined" ? mtcv_currentRatio : null));
  } catch (e) {
    console.warn('Cannot persist trim/crop config:', e);
  }
}

function cancelTrimCropModal() {
  if (mtcv_displayedVideo && !mtcv_displayedVideo.paused) {
    mtcv_displayedVideo.pause();
  }
  closeModal('.mtcv-container', '.config-advenced-button');
  const backup = localStorage.getItem('APP_STATE');
  const backupRatio = localStorage.getItem('ratio');
  if (backup) {
    APP_STATE.configConvertVideo = JSON.parse(backup);
  }
  if (backupRatio) {
    mtcv_currentRatio = JSON.parse(backupRatio);
  }
  populateCropBox(APP_STATE.configConvertVideo);
  setTrimCropFlipInfo();
}

function setTrimCropFlipInfo() {
  const advancedInfoSection = __getElementByIdByUI('AdvancedInfo');
  if(APP_STATE.configConvertVideo) {
    if(advancedInfoSection) {
        advancedInfoSection.style.display = 'flex';
        const advancedInfo = __getElementByIdByUI('AdvancedInfoText');
        advancedInfo.innerHTML = generateAdvancedInfoText(APP_STATE.configConvertVideo);
      }
  }
  else {
    if(advancedInfoSection) {
      advancedInfoSection.style.display = 'none';
    }

  }
}

function generateAdvancedInfoText(config) {
  const strong = v => `<span style="color: #333333bd">${v}</span>`;
  const gap = '&nbsp;';
  const lines = [];

  // ===== CROP =====
  const hasCrop =
    config.cropCheck &&
    config.width !== undefined &&
    config.height !== undefined &&
    config.x !== undefined &&
    config.y !== undefined;

  if (hasCrop) {
    lines.push([
      `W: ${strong(config.width)}`,
      `H: ${strong(config.height)}`,
      `X: ${strong(config.x)}`,
      `Y: ${strong(config.y)}`
    ].join(gap));
  }

  // ===== TRIM =====
  const hasTrim = config.trimCheck === true;
  const trimParts = [];

  if (hasTrim && config.startTime !== undefined) {
    trimParts.push(`Start: ${strong(formatTime(config.startTime))}`);
  }
  if (hasTrim && config.endTime !== undefined) {
    trimParts.push(`End: ${strong(formatTime(config.endTime))}`);
  }

  // ===== FLIP =====
  const hasFlip = config.flipVerticalCheck || config.flipHorizontalCheck;
  let flipText = '';

  if (hasFlip) {
    if (config.flipVerticalCheck && config.flipHorizontalCheck) {
      flipText = `Flip: ${strong('vertical and horizontal')}`;
    } else if (config.flipVerticalCheck) {
      flipText = `Flip: ${strong('vertical')}`;
    } else if (config.flipHorizontalCheck) {
      flipText = `Flip: ${strong('horizontal')}`;
    }
  }

  // ===== SẮP XẾP HÀNG =====
  if (hasCrop) {
    // Crop luôn ở hàng 1, các mục còn lại xuống hàng 2
    const secondLine = [];
    if (trimParts.length) secondLine.push(trimParts.join(gap));
    if (flipText) secondLine.push(flipText);
    if (secondLine.length) {
      lines.push(secondLine.join(gap));
    }
  } else {
    // Không có crop → trim hàng 1, flip hàng 2
    if (trimParts.length) {
      lines.push(trimParts.join(gap));
    }
    if (flipText) {
      lines.push(flipText);
    }
  }

  return lines.join('<br>');
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
        updateCropBoxUI();
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
  
  const scaleW = containerW / mtcv_origWidth;
  const scaleH = containerH / mtcv_origHeight;
  const scale = Math.min(scaleW, scaleH);

  mtcv_mediaWidth = Math.round(mtcv_origWidth * scale);
  mtcv_mediaHeight = Math.round(mtcv_origHeight * scale);

  const mediaLeft = Math.round((containerW - mtcv_mediaWidth) / 2);
  const mediaTop = Math.round((containerH - mtcv_mediaHeight) / 2);

  const mtcvThumbnailNotPlayVideo = document.querySelector('.mtcv-thumbnail-not-play-video');
  if (mtcvThumbnailNotPlayVideo) {
    updateElementStyle(mtcvThumbnailNotPlayVideo, {
      width: mtcv_mediaWidth + 'px',
      height: mtcv_mediaHeight + 'px',
      left: mediaLeft + 'px',
      top: mediaTop + 'px',
      position: 'absolute'
    });
  }

  mtcv_mediaOffsetX = mediaLeft;
  mtcv_mediaOffsetY = mediaTop;

  // ✅ Restore cropbox từ config nếu có, chỉ init mặc định khi chưa từng crop
  const hasValidCropConfig =
    APP_STATE.configConvertVideo &&
    APP_STATE.configConvertVideo.cropCheck === true &&
    typeof APP_STATE.configConvertVideo.width === 'number' &&
    typeof APP_STATE.configConvertVideo.height === 'number' &&
    typeof APP_STATE.configConvertVideo.x === 'number' &&
    typeof APP_STATE.configConvertVideo.y === 'number' &&
    APP_STATE.configConvertVideo.width > 0 &&
    APP_STATE.configConvertVideo.height > 0;

  if (mtcv_showCropBox && hasValidCropConfig) {
    // AVI / thumbnail mode → RESTORE cropbox đã lưu
    populateCropBox(APP_STATE.configConvertVideo);
  } else if (mtcv_showCropBox) {
    // CHỈ init mặc định khi CHƯA có crop trước đó
    const initialW = Math.round(mtcv_mediaWidth * 0.5);
    const initialH = Math.round(mtcv_mediaHeight * 0.5);

    mtcv_box.w = initialW;
    mtcv_box.h = initialH;
    mtcv_box.x = Math.round((mtcv_mediaWidth - mtcv_box.w) / 2);
    mtcv_box.y = Math.round((mtcv_mediaHeight - mtcv_box.h) / 2);
    mtcv_box.visible = true;

    updateCropBoxUI();
  } else {
    mtcv_box.visible = false;
    updateCropBoxUI();
  }
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
  updateCropBoxUI();
}

function hideCropBox() {
  mtcv_showCropBox = false;
  mtcv_box.visible = false;
  updateCropBoxUI();
}

function toggleVertical() {
  const checkbox = document.getElementById('verticalToggleCheckboxWebMobile');
  if (checkbox) {
    mtcv_flipState.vertical = checkbox.checked;
    mtcv_showVerticalFlip = checkbox.checked;
    applyFlipToVideo();
    updateCropConfig('flip');
  }
}

function toggleHorizontal() {
  const checkbox = document.getElementById('horizontalToggleCheckboxWebMobile');
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

    if (!checkbox.checked){
      dualRange && dualRange.updateValue((mtcv_startTime*1000).toFixed(3), (mtcv_endTime*1000).toFixed(3));
    }
  }
}

function restoreCheckboxStates() {
  const cropCheckbox = document.getElementById('crop-toggle-checkbox');
  if (cropCheckbox) {
    cropCheckbox.checked = mtcv_showCropBox;
    
    if (mtcv_showCropBox) {
      updateCropBoxUI();
      enableRatioButtons();
    } else {
      mtcv_box.visible = false;
      updateCropBoxUI();
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

  const verticalCheckbox = document.getElementById('verticalToggleCheckboxWebMobile');
  if (verticalCheckbox) {
    verticalCheckbox.checked = mtcv_showVerticalFlip;
    mtcv_flipState.vertical = mtcv_showVerticalFlip;
    applyFlipToVideo();
  }

  const horizontalCheckbox = document.getElementById('horizontalToggleCheckboxWebMobile');
  if (horizontalCheckbox) {
    horizontalCheckbox.checked = mtcv_showHorizontalFlip;
    mtcv_flipState.horizontal = mtcv_showHorizontalFlip;
    applyFlipToVideo();
  }
}

function roundToEven(value, maxValue = null) {
  const rounded = Math.round(value);

  if (rounded % 2 === 0) {
    return Math.min(rounded, maxValue ?? rounded);
  }

  const lower = rounded - 1;
  const upper = rounded + 1;

  const result = (value - lower < upper - value) ? lower : upper;
  if (maxValue !== null && result > maxValue) {
    return maxValue - (maxValue % 2);
  }

  return result;
}

function constrainCropBox(box, mediaWidth, mediaHeight, minSize, origWidth = null, origHeight = null) {
  // ✅ UI space: KHÔNG làm tròn - chỉ constrain bounds
  if (box.w < minSize) box.w = minSize;
  if (box.h < minSize) box.h = minSize;
  
  if (box.w > mediaWidth) box.w = mediaWidth;
  if (box.h > mediaHeight) box.h = mediaHeight;

  if (box.x < 0) box.x = 0;
  if (box.y < 0) box.y = 0;

  if (box.x + box.w > mediaWidth) {
    box.x = mediaWidth - box.w;
    if (box.x < 0) {
      box.x = 0;
      box.w = mediaWidth;
    }
  }
  if (box.y + box.h > mediaHeight) {
    box.y = mediaHeight - box.h;
    if (box.y < 0) {
      box.y = 0;
      box.h = mediaHeight;
    }
  }
  return box;
}

// ✅ Các hàm handleResize* đã được thay thế bằng anchor-based logic trong handlePointerMoveInternal
// Giữ lại để tránh lỗi nếu có code khác gọi (sẽ không được sử dụng)