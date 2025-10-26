let mtcv_minPixelDistance = 18;
function preventDefault(e) {
  e.preventDefault();
  e.stopPropagation();
}

function isTimelineDisabled() {
  const timelineTrack = document.querySelector('.mtcv-timeline-track');
  return timelineTrack && timelineTrack.classList.contains('mtcv-timeline-track-disabled');
}

function updateTimeDisplay() {
  updateElementStyle(mtcv_startTimeLabel, { textContent: formatTime(mtcv_startTime) });
  updateElementStyle(mtcv_endTimeLabel, { textContent: formatTime(mtcv_endTime) });
}

function updateProgressBar(location) {
  if (!mtcv_videoDuration) return;

  const currentTime = mtcv_displayedVideo.currentTime;
  const progressPercent = timeToPercent(currentTime, mtcv_videoDuration);
  const startPercent = timeToPercent(mtcv_startTime, mtcv_videoDuration);
  const endPercent = timeToPercent(mtcv_endTime, mtcv_videoDuration);
  
  const elements = {
    currentTimeLine: mtcv_currentTimeLine,
    selectedRange: mtcv_selectedRange,
    startHandle: mtcv_startHandleByID,
    endHandle: mtcv_endHandleByID
  };
  
  const percentages = {
    currentPercent: progressPercent,
    startPercent,
    endPercent
  };
  
  updateProgressElements(elements, percentages);
}

function createDragHandlers() {
  const calculateTime = (clientX) => calculateTimeFromPosition(clientX, mtcv_progressContainer, mtcv_videoDuration);
  
  return {
    handleDrag: createDragHandler(calculateTime, updateDragPosition),
    handleTouchDrag: createTouchDragHandler(calculateTime, updateDragPosition)
  };
}

let mtcv_seekThrottleTimer = null;
let mtcv_isVideoSeeking = false;

function seekVideoToTime(time) {
  if (!mtcv_displayedVideo || mtcv_isVideoSeeking) return;
  
  if (mtcv_seekThrottleTimer) {
    clearTimeout(mtcv_seekThrottleTimer);
  }
  
  mtcv_seekThrottleTimer = setTimeout(() => {
    if (mtcv_displayedVideo && !mtcv_isVideoSeeking) {
      mtcv_isVideoSeeking = true;
      mtcv_displayedVideo.currentTime = time;
      
      setTimeout(() => {
        mtcv_isVideoSeeking = false;
      }, 100);
    }
  }, 50);
}

function updateDragPosition(newTime) {
  if (isTimelineDisabled()) {
    return;
  }
  
  const minTimeDistance = calculateMinTimeDistance();
  
  const handlers = {
    start: () => handleStartDrag(newTime, minTimeDistance),
    end: () => handleEndDrag(newTime, minTimeDistance)
  };
  
  if (handlers[mtcv_dragTarget]) {
    handlers[mtcv_dragTarget]();
  }
  
  // Thêm logic seek video theo vị trí handle
  if (mtcv_dragTarget === 'start') {
    seekVideoToTime(mtcv_startTime);
  } else if (mtcv_dragTarget === 'end') {
    seekVideoToTime(mtcv_endTime);
  }
  
  updateTimeDisplay();
  updateProgressBar();
  
  // Cập nhật trimVideo config khi kéo timeline
  updateCropConfig('trimVideo');
}

// Sửa function handleStartDrag để tối ưu
function handleStartDrag(newTime, minTimeDistance) {
  mtcv_startTime = constrainTimeInRange(newTime, 0, mtcv_endTime - minTimeDistance);
  
  if (mtcv_startHandleByID) {
    const startPercent = timeToPercent(mtcv_startTime, mtcv_videoDuration);
    updateElementStyle(mtcv_startHandleByID, { left: `${startPercent}%` });
  }
  
  // Loại bỏ logic seek cũ vì đã có trong updateDragPosition
}

// Sửa function handleEndDrag để tối ưu  
function handleEndDrag(newTime, minTimeDistance) {
  mtcv_endTime = constrainTimeInRange(newTime, mtcv_startTime + minTimeDistance, mtcv_videoDuration);
  
  if (mtcv_endHandleByID) {
    const endPercent = timeToPercent(mtcv_endTime, mtcv_videoDuration);
    updateElementStyle(mtcv_endHandleByID, { left: `${endPercent}%` });
  }
  
  // Loại bỏ logic seek cũ vì đã có trong updateDragPosition
}

function createProgressHandlers() {
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

// Thêm function để pause video khi bắt đầu drag (optional)
function startDragging(type) {
  if (isTimelineDisabled()) {
    return;
  }
  
  mtcv_isDragging = true;
  mtcv_dragTarget = type;
  
  if (mtcv_displayedVideo && !mtcv_displayedVideo.paused) {
    mtcv_displayedVideo.pause();
  }
  
  const { handleDrag, handleTouchDrag } = createDragHandlers();
  
  setupElementEvents(document, [
    { event: 'mousemove', handler: handleDrag },
    { event: 'mouseup', handler: stopDragging },
    { event: 'touchmove', handler: handleTouchDrag, options: { passive: false } },
    { event: 'touchend', handler: stopDragging }
  ]);
}

function stopDragging() {
  mtcv_isDragging = false;
  mtcv_dragTarget = null;
}

function setupTimelineDragEvents() {
  const dragStartHandler = (e, type) => {
    if (isTimelineDisabled()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    startDragging(type);
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
    const { handleProgressClick, handleTouchProgress } = createProgressHandlers();
    
    setupElementEvents(mtcv_progressContainer, [
      { 
        event: 'mousedown', 
        handler: (e) => {
          if (isTimelineDisabled()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          
          if (!e.target.closest('.progress-handle-icon')) {
            handleProgressClick.call({ isDragging: mtcv_isDragging }, e);
          }
        }
      },
      { 
        event: 'touchstart', 
        handler: (e) => {
          if (isTimelineDisabled()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          
          if (!e.target.closest('.progress-handle-icon')) {
            handleTouchProgress.call({ isDragging: mtcv_isDragging }, e);
          }
        }, 
        options: { passive: false } 
      }
    ]);
  }
}

function calculateMinTimeDistance() {
  if (!mtcv_progressContainer || !mtcv_videoDuration || mtcv_videoDuration <= 0) {
    console.warn('Invalid inputs for calculateMinTimeDistance:', {
      container: !!mtcv_progressContainer,
      duration: mtcv_videoDuration
    });
    return 0.1;
  }
  
  const containerWidth = mtcv_progressContainer.offsetWidth;
  if (containerWidth <= 0) {
    console.warn('Invalid container width:', containerWidth);
    return 0.1;
  }
  
  const progressHandleWidth = getProgressHandleWidthPx('.start-handle');
  return (progressHandleWidth / containerWidth) * mtcv_videoDuration;
}

function setupVideoEvents() {
  if (!mtcv_displayedVideo) return;
  
  const eventHandlers = {
    loadedmetadata: handleVideoLoaded,
    timeupdate: handleTimeUpdate
  };
  
  setupVideoEventListeners(mtcv_displayedVideo, eventHandlers);
}

function setupVideoEventListeners(video, eventHandlers) {
  const cleanupFunctions = [];
  
  Object.entries(eventHandlers).forEach(([event, handler]) => {
    video.addEventListener(event, handler);
    cleanupFunctions.push(() => video.removeEventListener(event, handler));
  });
  
  return () => cleanupFunctions.forEach(cleanup => cleanup());
}

function handleVideoLoaded() {
  mtcv_videoDuration = mtcv_displayedVideo.duration;
  mtcv_endTime = mtcv_videoDuration;
  if (mtcv_startHandleByID) {
    updateElementStyle(mtcv_startHandleByID, { left: '0%' });
  }
  if (mtcv_endHandleByID) {
    updateElementStyle(mtcv_endHandleByID, { left: '100%' });
  }
  
  updateTimeDisplay();
  updateProgressBar();
}

function handleTimeUpdate() {
  updateTimeDisplay();
  updateProgressBar();
  
  if (mtcv_displayedVideo.currentTime >= mtcv_endTime) {
    mtcv_displayedVideo.pause();
  }
}

function initializeMTCVTimeline() {
  if (!mtcv_displayedVideo) return;
  
  setupVideoEvents();
  setupTimelineDragEvents();
}

document.addEventListener('dragstart', (e) => {
  e.preventDefault();
  e.stopPropagation();
});