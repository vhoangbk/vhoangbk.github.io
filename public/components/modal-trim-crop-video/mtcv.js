let mtcv_mediaLoaded = false;
let mtcv_origWidth = 0, mtcv_origHeight = 0;
let mtcv_mediaWidth = 0, mtcv_mediaHeight = 0;
let mtcv_mediaOffsetX = 0, mtcv_mediaOffsetY = 0;
let mtcv_box = { x: 0, y: 0, w: 150, h: 150, visible: false };
let mtcv_action = null;
let mtcv_pointerStart = { x: 0, y: 0 };
let mtcv_boxStart = null;

let mtcv_play = null;
let mtcv_progressContainer = null;
let mtcv_isDragging = false;
let mtcv_dragTarget = null;
let mtcv_startTime = 0;
let mtcv_endTime = 0;
let mtcv_videoDuration = 0;
let mtcv_wasPlaying = false;

let mtcv_initialMouseX = 0
let mtcv_initialMouseY = 0;

let mtcv_currentRatio = null;
let mtcv_minSize = 40;
let mtcv_widthAtMax = false;
let mtcv_heightAtMax = false;
let mtcv_flipState = {
  vertical: false,
  horizontal: false
};

let mtcv_displayedVideo, mtcv_stage, mtcv_cropBox, mtcv_mediaContainer;
let mtcv_overlayTop, mtcv_overlayLeft, mtcv_overlayRight, mtcv_overlayBottom;
let mtcv_dimensionWidth, mtcv_dimensionHeight, mtcv_dimensionX, mtcv_dimensionY;

function initializeDOMElementsForMTCV() {
  mtcv_displayedVideo = document.getElementById('mtcvDisplayedVideo');
  mtcv_stage = document.getElementById('mtcvStage');
  mtcv_cropBox = document.getElementById('mtcvCropBox');
  mtcv_mediaContainer = document.getElementById('mtcvMediaContainer');
  mtcv_overlayTop = document.getElementById('mtcvOverlayTop');
  mtcv_overlayLeft = document.getElementById('mtcvOverlayLeft');
  mtcv_overlayRight = document.getElementById('mtcvOverlayRight');
  mtcv_overlayBottom = document.getElementById('mtcvOverlayBottom');

  mtcv_dimensionWidth = document.querySelector('[data-dimension="width"]');
  mtcv_dimensionHeight = document.querySelector('[data-dimension="height"]');
  mtcv_dimensionX = document.querySelector('[data-dimension="x"]');
  mtcv_dimensionY = document.querySelector('[data-dimension="y"]');

  mtcv_play = document.getElementById('mtcv-play');
  mtcv_pause = document.getElementById('mtcv-pause');
  mtcv_progressContainer = document.getElementById('progressContainer');
  mtcv_selectedRange = document.getElementById('selectedRange');
  mtcv_currentTimeMarker = document.getElementById('currentTimeMarker');
  mtcv_currentTimeLine = document.getElementById('currentTimeLine');

  mtcv_startHandleByID = document.getElementById('startHandle');
  mtcv_endHandleByID = document.getElementById('endHandle');

  mtcv_startTimeLabel = document.getElementById('startTimeLabel');
  mtcv_endTimeLabel = document.getElementById('endTimeLabel');
  
  if (!mtcv_displayedVideo || !mtcv_stage || !mtcv_cropBox || !mtcv_mediaContainer) {
    return false;
  }
  
  setupEventListeners();
  loadVideoFromUrl(APP_STATE.urlVideo);
  initializeMTCVTimeline();
  setupRatioButtons();
  setupFlipControls();
  setupScaleListener();
  setTimeout(() => {
    populateModalFromConfig();
  }, 100);
  return true;
}

function populateModalFromConfig() {
  if (!APP_STATE.configConvertVideo) {
    console.log('No config data available');
    return;
  }
  const config = APP_STATE.configConvertVideo;
  populateDimensionsInfo(config);
  populateCropRatios(config.ratio);
  populateFlipControls(config.flip);
  populateTimeline(config.startTime, config.endTime);
  populateCropBox(config);
}

function populateDimensionsInfo(config) {
  if (mtcv_dimensionWidth) mtcv_dimensionWidth.textContent = config.width;
  if (mtcv_dimensionHeight) mtcv_dimensionHeight.textContent = config.height;
  if (mtcv_dimensionX) mtcv_dimensionX.textContent = config.x;
  if (mtcv_dimensionY) mtcv_dimensionY.textContent = config.y;
}

function populateCropRatios(ratio) {
  const ratioButtons = document.querySelectorAll('.mtcv-ratio-btn');
  console.log("ratio", ratio);
  ratioButtons.forEach(btn => btn.classList.remove('mtcv-crop-ratios-active'));
  let targetRatio = 'custom';
  if (ratio.width === 1 && ratio.height === 1) {
    targetRatio = '1:1';
  } else if (ratio.width === 9 && ratio.height === 16) {
    targetRatio = '9:16';
  } else if (ratio.width === 16 && ratio.height === 9) {
    targetRatio = '16:9';
  } else if (ratio.width === 4 && ratio.height === 3) {
    targetRatio = '4:3';
  }
  let ratioTemp = parseRatio(targetRatio);
  const position = calculateCropBoxPosition(ratioTemp);
  console.log("position", position);
  if (position) {
    updateCropBoxWithRatio(position, ratioTemp);
    ratioButtons.forEach(btn => {
      btn.classList.remove('mtcv-crop-ratios-active');
    });
    const targetButton = document.querySelector(`[data-ratio="${targetRatio}"]`);
    if (targetButton) {
      targetButton.classList.add('mtcv-crop-ratios-active');
    }
  }
}

function populateFlipControls(flip) {
  const flipButtons = document.querySelectorAll('.mtcv-flip-btn');
  flipButtons.forEach(btn => btn.classList.remove('mtcv-flip-btn-active'));
  
  if (flip.vertical) {
    const verticalBtn = document.querySelector('[data-flip="vertical"]');
    if (verticalBtn) verticalBtn.classList.add('mtcv-flip-btn-active');
  }
  
  if (flip.horizontal) {
    const horizontalBtn = document.querySelector('[data-flip="horizontal"]');
    if (horizontalBtn) horizontalBtn.classList.add('mtcv-flip-btn-active');
  }
  applyFlipToVideo();
}

function populateTimeline(startTime, endTime) {
  console.log("populateTimeline", startTime, endTime );
  const startSeconds = timeStringToSeconds(startTime);
  const endSeconds = timeStringToSeconds(endTime);
  
  if (typeof mtcv_startTime !== 'undefined') {
    mtcv_startTime = startSeconds;
  }
  if (typeof mtcv_endTime !== 'undefined') {
    mtcv_endTime = endSeconds;
  }
  
  if (typeof updateDisplays === 'function') {
    updateDisplays();
  }
  console.log(endSeconds, "populateTimeline", mtcv_endTime);
  console.log("updateProgressBar", mtcv_endTime, mtcv_videoDuration);
  if (typeof updateProgressBar === 'function') {
    updateProgressBar();
  }
}

function populateCropBox(config) {
  if (!mtcv_cropBox) return;
  
  // Lấy scale factors hiện tại
  const scaleX = mtcv_mediaWidth / mtcv_origWidth;
  const scaleY = mtcv_mediaHeight / mtcv_origHeight;
  
  // Chuyển đổi từ original coordinates sang scaled coordinates
  const scaledX = Math.round(config.x * scaleX);
  const scaledY = Math.round(config.y * scaleY);
  const scaledWidth = Math.round(config.width * scaleX);
  const scaledHeight = Math.round(config.height * scaleY);
  
  console.log("populateCropBox - Original:", config.x, config.y, config.width, config.height);
  console.log("populateCropBox - Scaled:", scaledX, scaledY, scaledWidth, scaledHeight);
  
  // Cập nhật mtcv_box object với scaled coordinates
  mtcv_box.x = scaledX;
  mtcv_box.y = scaledY;
  mtcv_box.w = scaledWidth;
  mtcv_box.h = scaledHeight;
  mtcv_box.visible = true;
  
  // Sử dụng hàm updateCropBoxUI() có sẵn để cập nhật UI
  updateCropBoxUI();
}

function updateOverlays(config) {
  if (mtcv_overlayTop) {
    mtcv_overlayTop.style.top = '0';
    mtcv_overlayTop.style.left = '0';
    mtcv_overlayTop.style.width = '100%';
    mtcv_overlayTop.style.height = config.y + 'px';
  }
  
  if (mtcv_overlayLeft) {
    mtcv_overlayLeft.style.top = config.y + 'px';
    mtcv_overlayLeft.style.left = '0';
    mtcv_overlayLeft.style.width = config.x + 'px';
    mtcv_overlayLeft.style.height = config.height + 'px';
  }
  
  if (mtcv_overlayRight) {
    mtcv_overlayRight.style.top = config.y + 'px';
    mtcv_overlayRight.style.left = (config.x + config.width) + 'px';
    mtcv_overlayRight.style.width = (config.originalWidth - config.x - config.width) + 'px';
    mtcv_overlayRight.style.height = config.height + 'px';
  }
  
  if (mtcv_overlayBottom) {
    mtcv_overlayBottom.style.top = (config.y + config.height) + 'px';
    mtcv_overlayBottom.style.left = '0';
    mtcv_overlayBottom.style.width = '100%';
    mtcv_overlayBottom.style.height = (config.originalHeight - config.y - config.height) + 'px';
  }
}

function getScaledMouseDelta(ev) {
  const stageDims = getMTCVStageDimensions();
  const scaleRatio = stageDims.scaleRatio;
  const dx = (ev.clientX - mtcv_pointerStart.x) / scaleRatio;
  const dy = (ev.clientY - mtcv_pointerStart.y) / scaleRatio;
  return { dx: Math.round(dx), dy: Math.round(dy) };
}

function snapHandleToCorner(corner, threshold = 20) {
  if (!mtcv_mediaContainer) return;
  const mediaW = mtcv_mediaWidth;
  const mediaH = mtcv_mediaHeight;
  const nearTop = mtcv_box.y < threshold;
  const nearBottom = mtcv_box.y + mtcv_box.h > mediaH - threshold;
  const nearLeft = mtcv_box.x < threshold;
  const nearRight = mtcv_box.x + mtcv_box.w > mediaW - threshold;
  
  switch(corner) {
    case 'tl': // Top-Left
      if (nearTop) mtcv_box.y = 0;
      if (nearLeft) mtcv_box.x = 0;
      break;
      
    case 'tr': // Top-Right
      if (nearTop) mtcv_box.y = 0;
      if (nearRight) mtcv_box.x = mediaW - mtcv_box.w;
      break;
      
    case 'bl': // Bottom-Left
      if (nearBottom) mtcv_box.y = mediaH - mtcv_box.h;
      if (nearLeft) mtcv_box.x = 0;
      break;
      
    case 'br': // Bottom-Right
      if (nearBottom) mtcv_box.y = mediaH - mtcv_box.h;
      if (nearRight) mtcv_box.x = mediaW - mtcv_box.w;
      break;
  }
  
  // Đảm bảo không bị âm
  if (mtcv_box.x < 0) mtcv_box.x = 0;
  if (mtcv_box.y < 0) mtcv_box.y = 0;
  if (mtcv_box.x + mtcv_box.w > mediaW) mtcv_box.x = mediaW - mtcv_box.w;
  if (mtcv_box.y + mtcv_box.h > mediaH) mtcv_box.y = mediaH - mtcv_box.h;
}

function setupEventListeners() {
  if (!mtcv_cropBox) return;
  
  mtcv_cropBox.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    
    const handle = ev.target.dataset.handle;
    mtcv_pointerStart = { x: ev.clientX, y: ev.clientY };
    mtcv_boxStart = { x: mtcv_box.x, y: mtcv_box.y, w: mtcv_box.w, h: mtcv_box.h };
    
    if (handle) { 
      mtcv_action = 'resize-' + handle;
      document.body.style.cursor = getCursorForHandle(handle);
    } else { 
      mtcv_action = 'move';
      document.body.style.cursor = 'move';
    }
    ev.target.setPointerCapture(ev.pointerId);
  });

  document.addEventListener('pointermove', (ev) => {
    if (!mtcv_action) return;
    
    ev.preventDefault();
    
    // Sử dụng scaled coordinates
    const { dx, dy } = getScaledMouseDelta(ev);

    if (mtcv_action === 'move') {
      mtcv_box.x = mtcv_boxStart.x + dx;
      mtcv_box.y = mtcv_boxStart.y + dy;
      constrainBox();
      updateCropBoxUI();
    } else if (mtcv_action.startsWith('resize-')) {
      const corner = mtcv_action.split('-')[1];
      
      if (corner === 'tl') {
        mtcv_box.x = mtcv_boxStart.x + dx;
        mtcv_box.y = mtcv_boxStart.y + dy;
        mtcv_box.w = mtcv_boxStart.w - dx;
        mtcv_box.h = mtcv_boxStart.h - dy;
      } else if (corner === 'tr') {
        mtcv_box.y = mtcv_boxStart.y + dy;
        mtcv_box.w = mtcv_boxStart.w + dx;
        mtcv_box.h = mtcv_boxStart.h - dy;
      } else if (corner === 'bl') {
        mtcv_box.x = mtcv_boxStart.x + dx;
        mtcv_box.w = mtcv_boxStart.w - dx;
        mtcv_box.h = mtcv_boxStart.h + dy;
      } else if (corner === 'br') {
        // Handle br: chỉ thay đổi width và height
        const newW = mtcv_boxStart.w + dx;
        const newH = mtcv_boxStart.h + dy;
        
        // Đảm bảo không vượt quá giới hạn
        mtcv_box.w = Math.min(newW, mtcv_mediaWidth - mtcv_boxStart.x);
        mtcv_box.h = Math.min(newH, mtcv_mediaHeight - mtcv_boxStart.y);
        
        // Đảm bảo không nhỏ hơn minSize
        if (mtcv_box.w < mtcv_minSize) {
          mtcv_box.w = mtcv_minSize;
        }
        if (mtcv_box.h < mtcv_minSize) {
          mtcv_box.h = mtcv_minSize;
        }
      }
      
      if (mtcv_currentRatio) {
        applyRatioConstraints();
      }
      
      constrainBox();
      updateCropBoxUI();
    }
  });

  document.addEventListener('pointerup', (ev) => {
    if (mtcv_action && mtcv_action.startsWith('resize-')) {
      const corner = mtcv_action.split('-')[1];
      
      // Kiểm tra nếu handle đã được kéo ra ngoài vùng
      const isOutsideBounds = (
        mtcv_box.x < 0 || 
        mtcv_box.y < 0 || 
        mtcv_box.x + mtcv_box.w > mtcv_mediaWidth || 
        mtcv_box.y + mtcv_box.h > mtcv_mediaHeight
      );
      
      if (isOutsideBounds) {
        // Snap về góc tương ứng
        snapHandleToCorner(corner);
        updateCropBoxUI();
      }
    }
    
    document.body.style.cursor = '';
    mtcv_action = null;
  });
}

function getCursorForHandle(handle) {
  switch(handle) {
    case 'tl': return 'nw-resize';
    case 'tr': return 'ne-resize';
    case 'bl': return 'sw-resize';
    case 'br': return 'se-resize';
    default: return 'default';
  }
}

function applyRatioConstraints() {
  if (!mtcv_currentRatio) return;

  const aspectRatio = mtcv_currentRatio.width / mtcv_currentRatio.height;
  const videoWidth = mtcv_mediaWidth;
  const videoHeight = mtcv_mediaHeight;

  let newWidth = mtcv_box.w;
  let newHeight = mtcv_box.h;

  if (newWidth > videoWidth) {
    newWidth = videoWidth;
    newHeight = newWidth / aspectRatio;
  }
  if (newHeight > videoHeight) {
    newHeight = videoHeight;
    newWidth = newHeight * aspectRatio;
  }

  if (newWidth <= videoWidth && newHeight <= videoHeight) {
    const currentRatio = newWidth / newHeight;
    if (currentRatio > aspectRatio) {
      newHeight = newWidth / aspectRatio;
    } else {
      newWidth = newHeight * aspectRatio;
    }
  }

  const minWidth = mtcv_minSize;
  const minHeight = minWidth / aspectRatio;

  if (newWidth < minWidth) {
    newWidth = minWidth;
    newHeight = minWidth / aspectRatio;
  }
  if (newHeight < minHeight) {
    newHeight = minHeight;
    newWidth = minHeight * aspectRatio;
  }

  if (newWidth > videoWidth) {
    newWidth = videoWidth;
    newHeight = newWidth / aspectRatio;
  }
  if (newHeight > videoHeight) {
    newHeight = videoHeight;
    newWidth = newHeight * aspectRatio;
  }

  mtcv_box.w = Math.round(newWidth);
  mtcv_box.h = Math.round(newHeight);
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
  
  mtcv_displayedVideo.onerror = () => {
    alert('Không thể đọc file video.');
  };
    
  mtcv_displayedVideo.src = videoUrl;
  mtcv_displayedVideo.load();
}

function getMTCVStageDimensions() {
  if (!mtcv_stage) {
    return { 
      originalWidth: 0, 
      originalHeight: 0, 
      scaleRatio: 1,
      scaledWidth: 0,
      scaledHeight: 0
    };
  }
  
  const scalableContent = document.querySelector('.scalable-content');
  if (!scalableContent) {
    return { 
      originalWidth: 0, 
      originalHeight: 0, 
      scaleRatio: 1,
      scaledWidth: 0,
      scaledHeight: 0
    };
  }
  
  // Lấy kích thước đã được scale và làm tròn thành số nguyên
  const scaledRect = mtcv_stage.getBoundingClientRect();
  const scaledWidth = Math.round(scaledRect.width);
  const scaledHeight = Math.round(scaledRect.height);
  
  // Lấy scale ratio từ scalable-content
  const transform = window.getComputedStyle(scalableContent).transform;
  let scaleRatio = 1;
  
  if (transform !== 'none') {
    const matrix = transform.match(/matrix\(([^)]+)\)/);
    if (matrix) {
      scaleRatio = parseFloat(matrix[1].split(',')[0]);
    }
  }
  
  // Tính kích thước gốc và làm tròn thành số nguyên
  const originalWidth = Math.round(scaledWidth / scaleRatio);
  const originalHeight = Math.round(scaledHeight / scaleRatio);
  
  return {
    originalWidth: originalWidth,
    originalHeight: originalHeight,
    scaleRatio: scaleRatio,
    scaledWidth: scaledWidth,
    scaledHeight: scaledHeight
  };
}

function fitMediaToContainer() {
  if (!mtcv_stage || !mtcv_displayedVideo || !mtcv_mediaContainer) return;
  
  // Lấy kích thước gốc của mtcv-stage
  const stageDims = getMTCVStageDimensions();
  const containerW = stageDims.originalWidth;
  const containerH = stageDims.originalHeight;
  
  // Tính tỷ lệ scale để video fit hoàn toàn trong container
  const scaleX = containerW / mtcv_origWidth;
  const scaleY = containerH / mtcv_origHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Tính kích thước video hiển thị
  mtcv_mediaWidth = Math.round(mtcv_origWidth * scale);
  mtcv_mediaHeight = Math.round(mtcv_origHeight * scale);
  
  // Set video size
  mtcv_displayedVideo.style.width = mtcv_mediaWidth + 'px';
  mtcv_displayedVideo.style.height = mtcv_mediaHeight + 'px';
  
  // Tính offset để center video trong container
  const mediaLeft = Math.round((containerW - mtcv_mediaWidth) / 2);
  const mediaTop = Math.round((containerH - mtcv_mediaHeight) / 2);
  
  mtcv_mediaOffsetX = mediaLeft;
  mtcv_mediaOffsetY = mediaTop;
  
  // Khởi tạo crop box
  const initialW = Math.round(mtcv_mediaWidth * 0.5);
  const initialH = Math.round(mtcv_mediaHeight * 0.5);
  
  mtcv_box.w = initialW;
  mtcv_box.h = initialH;
  mtcv_box.x = Math.round((mtcv_mediaWidth - mtcv_box.w) / 2);
  mtcv_box.y = Math.round((mtcv_mediaHeight - mtcv_box.h) / 2);
  mtcv_box.visible = true;
  
  updateCropBoxUI();
}

function showEditorAfterLoad() {
  if (!mtcv_cropBox || !mtcv_mediaContainer) return;
  
  mtcv_cropBox.style.display = 'block';
  
  [mtcv_overlayTop, mtcv_overlayLeft, mtcv_overlayRight, mtcv_overlayBottom].forEach(o => {
    if (o) o.style.display = 'block';
  });
}

function updateCropBoxUI() {
  if (!mtcv_box.visible || !mtcv_cropBox) { 
    if (mtcv_cropBox) mtcv_cropBox.style.display = 'none'; 
    return; 
  }
  console.log("updateCropBoxUI", mtcv_box, mtcv_cropBox);
  
  // Cập nhật cropbox position
  mtcv_cropBox.style.display = 'block';
  mtcv_cropBox.style.width = mtcv_box.w + 'px';
  mtcv_cropBox.style.height = mtcv_box.h + 'px';
  mtcv_cropBox.style.left = (mtcv_mediaOffsetX + mtcv_box.x) + 'px';
  mtcv_cropBox.style.top = (mtcv_mediaOffsetY + mtcv_box.y) + 'px';
  
  // Tính toán original dimensions
  const scaleX = mtcv_mediaWidth / mtcv_origWidth;
  const scaleY = mtcv_mediaHeight / mtcv_origHeight;
  let origW = 0;
  let origH = 0;
  
  if (mtcv_currentRatio && mtcv_currentRatio.height && mtcv_currentRatio.width) {
    if (mtcv_currentRatio.height === mtcv_currentRatio.width) {
      if (mtcv_box.w < mtcv_box.h) {
        origW = Math.max(1, Math.round(mtcv_box.w / scaleX));
        origH = Math.max(1, Math.round(mtcv_box.h / scaleX));
      } else {
        origW = Math.max(1, Math.round(mtcv_box.w / scaleY));
        origH = Math.max(1, Math.round(mtcv_box.h / scaleY));
      }
    } else {
      origW = Math.max(1, Math.round(mtcv_box.w / scaleX));
      origH = Math.max(1, Math.round(mtcv_box.h / scaleY));
    }
  } else {
    origW = Math.max(1, Math.round(mtcv_box.w / scaleX));
    origH = Math.max(1, Math.round(mtcv_box.h / scaleY));
  }
  
  const origX = Math.max(0, Math.round(mtcv_box.x / scaleX));
  const origY = Math.max(0, Math.round(mtcv_box.y / scaleY));
  
  // Cập nhật UI
  if (mtcv_dimensionWidth) mtcv_dimensionWidth.textContent = origW;
  if (mtcv_dimensionHeight) mtcv_dimensionHeight.textContent = origH;
  if (mtcv_dimensionX) mtcv_dimensionX.textContent = origX;
  if (mtcv_dimensionY) mtcv_dimensionY.textContent = origY;
  
  updateOverlays();
}

function constrainBox() {
  if (!mtcv_currentRatio) {
    if (mtcv_box.w < mtcv_minSize) mtcv_box.w = mtcv_minSize;
    if (mtcv_box.h < mtcv_minSize) mtcv_box.h = mtcv_minSize;
  }

  // Giới hạn kích thước
  if (mtcv_box.w > mtcv_mediaWidth) mtcv_box.w = mtcv_mediaWidth;
  if (mtcv_box.h > mtcv_mediaHeight) mtcv_box.h = mtcv_mediaHeight;

  // Giới hạn vị trí
  if (mtcv_box.x < 0) mtcv_box.x = 0;
  if (mtcv_box.y < 0) mtcv_box.y = 0;

  // Đảm bảo crop box không vượt ra ngoài media
  if (mtcv_box.x + mtcv_box.w > mtcv_mediaWidth) {
    mtcv_box.x = Math.max(0, mtcv_mediaWidth - mtcv_box.w);
  }
  if (mtcv_box.y + mtcv_box.h > mtcv_mediaHeight) {
    mtcv_box.y = Math.max(0, mtcv_mediaHeight - mtcv_box.h);
  }
}

function updateOverlays() {
  if (!mtcv_stage || !mtcv_overlayTop || !mtcv_overlayLeft || !mtcv_overlayRight || !mtcv_overlayBottom) return;
  
  // Lấy kích thước gốc của mtcv-stage
  const stageDims = getMTCVStageDimensions();
  const stageW = stageDims.originalWidth;
  const stageH = stageDims.originalHeight;
  
  // Tính toán crop positions chính xác
  const cropTop = mtcv_mediaOffsetY + mtcv_box.y;
  const cropLeft = mtcv_mediaOffsetX + mtcv_box.x;
  const cropRight = cropLeft + mtcv_box.w;
  const cropBottom = cropTop + mtcv_box.h;
  
  // Tính toán overlay positions chính xác
  // Top overlay: từ đầu stage đến đầu crop box
  mtcv_overlayTop.style.left = '0px';
  mtcv_overlayTop.style.top = '0px';
  mtcv_overlayTop.style.width = stageW + 'px';
  mtcv_overlayTop.style.height = Math.max(0, cropTop) + 'px';
  
  // Bottom overlay: từ cuối crop box đến cuối stage
  mtcv_overlayBottom.style.left = '0px';
  mtcv_overlayBottom.style.top = Math.max(0, cropBottom) + 'px';
  mtcv_overlayBottom.style.width = stageW + 'px';
  mtcv_overlayBottom.style.height = Math.max(0, stageH - cropBottom) + 'px';
  
  // Left overlay: từ trái stage đến trái crop box, chiều cao = crop box height
  mtcv_overlayLeft.style.left = '0px';
  mtcv_overlayLeft.style.top = Math.max(0, cropTop) + 'px';
  mtcv_overlayLeft.style.width = Math.max(0, cropLeft) + 'px';
  mtcv_overlayLeft.style.height = Math.max(0, mtcv_box.h) + 'px';
  
  // Right overlay: từ phải crop box đến phải stage, chiều cao = crop box height
  mtcv_overlayRight.style.left = Math.max(0, cropRight) + 'px';
  mtcv_overlayRight.style.top = Math.max(0, cropTop) + 'px';
  mtcv_overlayRight.style.width = Math.max(0, stageW - cropRight) + 'px';
  mtcv_overlayRight.style.height = Math.max(0, mtcv_box.h) + 'px';
  
  const show = mtcv_box.visible && mtcv_mediaLoaded;
  [mtcv_overlayTop, mtcv_overlayLeft, mtcv_overlayRight, mtcv_overlayBottom].forEach(o => {
    if (o) o.style.display = show ? 'block' : 'none';
  });
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

function resizeCropBox(newWidth, newHeight, ratio) {
  if (!mtcv_displayedVideo) return { width: newWidth, height: newHeight };
  
  // Sử dụng kích thước video hiển thị thực tế
  const maxWidth = mtcv_mediaWidth;
  const maxHeight = mtcv_mediaHeight;
  
  mtcv_widthAtMax = false;
  mtcv_heightAtMax = false;
  
  if (ratio) {
    const aspectRatio = ratio.width / ratio.height;
    
    if (newWidth >= maxWidth) {
      mtcv_widthAtMax = true;
      newWidth = maxWidth;
      newHeight = Math.round(newWidth / aspectRatio);
    } else if (newHeight >= maxHeight) {
      mtcv_heightAtMax = true;
      newHeight = maxHeight;
      newWidth = Math.round(newHeight * aspectRatio);
    } else {
      if (newWidth / newHeight > aspectRatio) {
        newHeight = Math.round(newWidth / aspectRatio);
      } else {
        newWidth = Math.round(newHeight * aspectRatio);
      }
    }
    
    const minWidth = mtcv_minSize;
    const minHeight = Math.round(minWidth / aspectRatio);
    
    if (newWidth < minWidth) {
      newWidth = minWidth;
      newHeight = Math.round(minWidth / aspectRatio);
    }
    if (newHeight < minHeight) {
      newHeight = minHeight;
      newWidth = Math.round(minHeight * aspectRatio);
    }
    
  } else {
    if (newWidth < mtcv_minSize) newWidth = mtcv_minSize;
    if (newHeight < mtcv_minSize) newHeight = mtcv_minSize;
    if (newWidth > maxWidth) newWidth = maxWidth;
    if (newHeight > maxHeight) newHeight = maxHeight;
  }
  
  return { width: newWidth, height: newHeight };
}

function updateCropBoxWithRatio(position, ratio) {
  console.log("updateCropBoxWithRatio", position, ratio);
  if (!position || !mtcv_cropBox) return;
  mtcv_currentRatio = ratio;
  mtcv_box.x = position.x;
  mtcv_box.y = position.y;
  mtcv_box.w = position.width;
  mtcv_box.h = position.height;
  mtcv_box.visible = true;
  
  updateCropBoxUI();
}

function setupRatioButtons() {
  const ratioButtons = document.querySelectorAll('[data-ratio]');
  
  ratioButtons.forEach(button => {
    button.addEventListener('click', function() {
      const ratio = parseRatio(this.dataset.ratio);
      console.log("ratio", ratio);
      const position = calculateCropBoxPosition(ratio);
      if (position) {
        updateCropBoxWithRatio(position, ratio);
        ratioButtons.forEach(btn => {
          btn.classList.remove('mtcv-crop-ratios-active');
        });
        this.classList.add('mtcv-crop-ratios-active');
      }
    });
  });
}

function setupFlipControls() {
  const flipButtons = document.querySelectorAll('[data-flip]');
  
  flipButtons.forEach(button => {
    button.addEventListener('click', function() {
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

function applyFlipToVideo() {
  if (!mtcv_displayedVideo) return;
  
  let transform = '';
  
  if (mtcv_flipState.vertical) {
    transform += 'scaleY(-1) ';
  }
  if (mtcv_flipState.horizontal) {
    transform += 'scaleX(-1) ';
  }
  
  mtcv_displayedVideo.style.transform = transform.trim();
}

function saveTrimCrop() {
  if (!mtcv_mediaLoaded) {
    return;
  }
  
  const scaleX = mtcv_mediaWidth / mtcv_origWidth;
  const scaleY = mtcv_mediaHeight / mtcv_origHeight;
  
  const origW = Math.max(1, Math.round(mtcv_box.w / scaleX));
  const origH = Math.max(1, Math.round(mtcv_box.h / scaleY));
  const origX = Math.max(0, Math.round(mtcv_box.x / scaleX));
  const origY = Math.max(0, Math.round(mtcv_box.y / scaleY));
  
  const cropData = {
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
  console.log("saveTrimCrop", cropData);
  APP_STATE.configConvertVideo = cropData;
  cancelTrimCropModal();
}

function cancelTrimCropModal() {
  const modal = document.querySelector('.mtcv-container');
  const advancedBtn = document.querySelector('.config-advenced-button');

  if (modal) {
    modal.classList.remove('mtcv-show');
    document.documentElement.classList.remove('mtcv-open');
    setTimeout(() => modal.style.display = 'none', 300);
  }
  if (advancedBtn) {
    advancedBtn.classList.remove('advance-btn-active');
  }
}

function setupScaleListener() {
  window.addEventListener('resize', () => {
    if (mtcv_mediaLoaded && mtcv_box.visible) {
      setTimeout(() => {
        fitMediaToContainer();
        updateCropBoxUI();
      }, 350);
    }
  });
}
