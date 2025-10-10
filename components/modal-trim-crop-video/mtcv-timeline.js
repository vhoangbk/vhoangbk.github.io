function preventDefault(e) {
  e.preventDefault();
  e.stopPropagation();
}
// document.addEventListener('contextmenu', preventDefault); // Chặn click chuộc
document.addEventListener('dragstart', preventDefault);
let mtcv_handleWidth = 16; // Chiều rộng handle
let mtcv_minPixelDistance = mtcv_handleWidth; // 7px

function calculateMinTimeDistance() {
  const containerWidth = mtcv_progressContainer.offsetWidth;
  return (mtcv_minPixelDistance / containerWidth) * mtcv_videoDuration;
}

function initializeMTCVTimeline() {
  if (!mtcv_displayedVideo || !mtcv_play) {
    console.log('Timeline elements chưa được khởi tạo');
    return;
  }
  mtcv_displayedVideo.addEventListener('loadedmetadata', function () {
    mtcv_videoDuration = mtcv_displayedVideo.duration;
    mtcv_endTime = mtcv_videoDuration;
    if (mtcv_startHandleByID) {
      mtcv_startHandleByID.style.left = '0%';
    }
    if (mtcv_endHandleByID) {
      mtcv_endHandleByID.style.left = '100%';
    }
    updateDisplays();
    updateProgressBar();
  });
  mtcv_displayedVideo.addEventListener('timeupdate', function () {
    updateDisplays();
    updateProgressBar();
    if (mtcv_displayedVideo.currentTime >= mtcv_endTime) {
      mtcv_displayedVideo.pause();
      updatePlayPauseUI();
    }
  });
  mtcv_displayedVideo.addEventListener('play', function () {
    updatePlayPauseUI();
  });
  mtcv_displayedVideo.addEventListener('pause', function () {
    updatePlayPauseUI();
  });
  if (mtcv_play) {
    mtcv_play.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePlayPause();
    });
  }
  const pauseButton = document.getElementById('mtcv-pause');
  if (pauseButton) {
    pauseButton.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePlayPause();
    });
  }
  setupTimelineDragEvents();
}

function setupTimelineDragEvents() {
  if (mtcv_startHandleByID) {
    mtcv_startHandleByID.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      startDragging('start');
    });
    mtcv_startHandleByID.addEventListener('touchstart', function (e) {
      e.stopPropagation();
      e.preventDefault();
      startDragging('start');
    }, { passive: false });
  }
  
  if (mtcv_endHandleByID) {
    mtcv_endHandleByID.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      startDragging('end');
    });
    mtcv_endHandleByID.addEventListener('touchstart', function (e) {
      e.stopPropagation();
      e.preventDefault();
      startDragging('end');
    }, { passive: false });
  }
  
  // Đảm bảo currentTimeMarker có thể drag được
  if (mtcv_currentTimeMarker) {
    mtcv_currentTimeMarker.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      console.log('Current time marker mousedown'); // Debug log
      startDragging('marker');
      mtcv_wasPlaying = !mtcv_displayedVideo.paused;
      mtcv_displayedVideo.pause();
    });
    
    mtcv_currentTimeMarker.addEventListener('touchstart', function (e) {
      e.stopPropagation();
      e.preventDefault();
      console.log('Current time marker touchstart'); // Debug log
      startDragging('marker');
      mtcv_wasPlaying = !mtcv_displayedVideo.paused;
      mtcv_displayedVideo.pause();
    }, { passive: false });
  }
  
  if (mtcv_progressContainer) {
    mtcv_progressContainer.addEventListener('mousedown', function (e) {
      // Chỉ xử lý click nếu không phải trên các handle
      if (!e.target.closest('.progress-handle-icon') && !e.target.closest('.current-time-marker')) {
        handleProgressClick(e);
      }
    });
    mtcv_progressContainer.addEventListener('touchstart', function (e) {
      if (!e.target.closest('.progress-handle-icon') && !e.target.closest('.current-time-marker')) {
        handleTouchProgress(e);
      }
    }, { passive: false });
  }
}

function updatePlayPauseUI() {
  if (!mtcv_play || !mtcv_pause) return;
  if (mtcv_displayedVideo.paused) {
    mtcv_play.style.display = 'block';
    mtcv_pause.style.display = 'none';
  } else {
    mtcv_play.style.display = 'none';
    mtcv_pause.style.display = 'block';
  }
}

function togglePlayPause() {
  if (mtcv_displayedVideo.paused) {
    const minTimeDistance = calculateMinTimeDistance();
    
    if (mtcv_displayedVideo.currentTime >= mtcv_endTime || mtcv_displayedVideo.currentTime < mtcv_startTime) {
      mtcv_displayedVideo.currentTime = mtcv_startTime + minTimeDistance;
    }
    mtcv_displayedVideo.play().catch(function (e) {
      console.log('Error playing video:', e);
    });
  } else {
    mtcv_displayedVideo.pause();
  }
}

function updateDisplays() {
  mtcv_startTimeLabel.textContent = formatTime(mtcv_startTime);
  mtcv_endTimeLabel.textContent = formatTime(mtcv_endTime);
}

function updateProgressBar(startPercent$, endPercent$) {
  if (!mtcv_videoDuration) return;

  const currentTime = mtcv_displayedVideo.currentTime;
  const progressPercent = (currentTime / mtcv_videoDuration) * 100;
  const startPercent = (startPercent$ ? startPercent$ :mtcv_startTime / mtcv_videoDuration) * 100;
  const endPercent = (endPercent$ ? endPercent$ : mtcv_endTime / mtcv_videoDuration) * 100;
  // Tính toán khoảng cách tối thiểu nhất quán
  const minTimeDistance = calculateMinTimeDistance();
  const minPercentDistance = (minTimeDistance / mtcv_videoDuration) * 100;
  
  // Cập nhật current time marker - KHÔNG được chồng lên start/end
  if (mtcv_currentTimeMarker && mtcv_dragTarget !== 'marker') {
    const constrainedPercent = Math.max(
      startPercent + minPercentDistance, 
      Math.min(progressPercent, endPercent - minPercentDistance)
    );
    mtcv_currentTimeMarker.style.left = `${constrainedPercent}%`;
  }
  
  // Cập nhật current time line
  if (mtcv_currentTimeLine) {
    mtcv_currentTimeLine.style.left = `${progressPercent}%`;
  }
  
  // Cập nhật selected range
  if (mtcv_selectedRange) {
    mtcv_selectedRange.style.left = `${startPercent}%`;
    mtcv_selectedRange.style.width = `${endPercent - startPercent}%`;
  }
  
  // Cập nhật vị trí các handle
  if (mtcv_startHandleByID) {
    console.log("updateProgressBar", startPercent);
    mtcv_startHandleByID.style.left = `${startPercent}%`;
  }
  if (mtcv_endHandleByID) {
    console.log("updateProgressBar", endPercent);
    mtcv_endHandleByID.style.left = `calc(${endPercent}%)`;
  }
}

function handleDrag(e) {
  if (!mtcv_isDragging) return;
  
  const rect = mtcv_progressContainer.getBoundingClientRect();
  const dragX = e.clientX - rect.left;
  
  // Tính toán chính xác với offset của handle
  const handleOffset = 7; // Nửa chiều rộng handle
  const adjustedX = Math.max(handleOffset, Math.min(dragX, rect.width - handleOffset));
  const dragPercent = ((adjustedX - handleOffset) / (rect.width - handleOffset * 2)) * 100;
  const newTime = (dragPercent / 100) * mtcv_videoDuration;
  
  updateDragPosition(newTime);
}

function handleTouchDrag(e) {
  if (!mtcv_isDragging) return;
  
  e.preventDefault();
  const touch = e.touches[0];
  const rect = mtcv_progressContainer.getBoundingClientRect();
  const dragX = touch.clientX - rect.left;
  
  // Tính toán chính xác với offset của handle
  const handleOffset = 7;
  const adjustedX = Math.max(handleOffset, Math.min(dragX, rect.width - handleOffset));
  const dragPercent = ((adjustedX - handleOffset) / (rect.width - handleOffset * 2)) * 100;
  const newTime = (dragPercent / 100) * mtcv_videoDuration;
  
  updateDragPosition(newTime);
}

function updateDragPosition(newTime) {
  const minTimeDistance = calculateMinTimeDistance();
  
  if (mtcv_dragTarget === 'start') {
    mtcv_startTime = Math.max(0, Math.min(newTime, mtcv_endTime - minTimeDistance));
    
    if (mtcv_startHandleByID) {
      const startPercent = (mtcv_startTime / mtcv_videoDuration) * 100;
      mtcv_startHandleByID.style.left = `${startPercent}%`;
    }
    
    // Điều chỉnh current time nếu cần
    if (mtcv_displayedVideo.currentTime < mtcv_startTime) {
      mtcv_displayedVideo.currentTime = mtcv_startTime + minTimeDistance;
    }
    
  } else if (mtcv_dragTarget === 'end') {
    mtcv_endTime = Math.min(mtcv_videoDuration, Math.max(newTime, mtcv_startTime + minTimeDistance));
    
    if (mtcv_endHandleByID) {
      const endPercent = (mtcv_endTime / mtcv_videoDuration) * 100;
      mtcv_endHandleByID.style.left = `${endPercent}%`;
    }
    
    // Điều chỉnh current time nếu cần
    if (mtcv_displayedVideo.currentTime > mtcv_endTime) {
      mtcv_displayedVideo.currentTime = mtcv_endTime - minTimeDistance;
    }
    
  } else if (mtcv_dragTarget === 'marker') {
    const constrainedTime = Math.max(
      mtcv_startTime + minTimeDistance, 
      Math.min(newTime, mtcv_endTime - minTimeDistance)
    );
    mtcv_displayedVideo.currentTime = constrainedTime;
    
    if (mtcv_currentTimeMarker) {
      const markerPercent = (constrainedTime / mtcv_videoDuration) * 100;
      mtcv_currentTimeMarker.style.left = `${markerPercent}%`;
    }
  }
  
  updateDisplays();
  updateProgressBar();
}

function handleProgressClick(e) {
  if (mtcv_isDragging) return;
  
  const rect = mtcv_progressContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickPercent = (clickX / rect.width) * 100;
  const newTime = (clickPercent / 100) * mtcv_videoDuration;
  
  const minTimeDistance = calculateMinTimeDistance();
  const constrainedTime = Math.max(
    mtcv_startTime + minTimeDistance, 
    Math.min(newTime, mtcv_endTime - minTimeDistance)
  );
  mtcv_displayedVideo.currentTime = constrainedTime;
}

function handleTouchProgress(e) {
  if (mtcv_isDragging) return;
  
  e.preventDefault();
  const touch = e.touches[0];
  const rect = mtcv_progressContainer.getBoundingClientRect();
  const clickX = touch.clientX - rect.left;
  const clickPercent = (clickX / rect.width) * 100;
  const newTime = (clickPercent / 100) * mtcv_videoDuration;
  
  const minTimeDistance = calculateMinTimeDistance();
  const constrainedTime = Math.max(
    mtcv_startTime + minTimeDistance, 
    Math.min(newTime, mtcv_endTime - minTimeDistance)
  );
  mtcv_displayedVideo.currentTime = constrainedTime;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function startDragging(type) {
  mtcv_isDragging = true;
  mtcv_dragTarget = type;
  
  if (type === 'marker') {
    mtcv_wasPlaying = !mtcv_displayedVideo.paused;
    if (mtcv_wasPlaying) mtcv_displayedVideo.pause();
  }
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDragging);
  document.addEventListener('touchmove', handleTouchDrag, { passive: false });
  document.addEventListener('touchend', stopDragging);
}

function stopDragging() {
  mtcv_isDragging = false;
  mtcv_dragTarget = null;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDragging);
  document.removeEventListener('touchmove', handleTouchDrag);
  document.removeEventListener('touchend', stopDragging);
  if (mtcv_wasPlaying) {
    mtcv_displayedVideo.play();
    mtcv_wasPlaying = false;
  }
}

function resetRange() {
  mtcv_startTime = 0;
  mtcv_endTime = mtcv_videoDuration;
  const minDistance = 0.05;
  if (mtcv_displayedVideo.currentTime < mtcv_startTime) {
    mtcv_displayedVideo.currentTime = mtcv_startTime + minDistance;
  }
  updateDisplays();
  updateProgressBar();
}