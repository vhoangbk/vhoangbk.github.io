let clickCount = 0;
const resolutionOverlay = document.getElementById('overlayResolution');
const qualitynOverlay = document.getElementById('overlayQuality');
const fpsOverlay = document.getElementById('overlayFps');

function openModalAdvancedConfig() {
  if (!APP_STATE.selectedFileInfo) {
    clickCount++;
    if (clickCount > 1) {
      return;
    }
    showNotification('Please upload a video file first');
    setTimeout(() => {
      clickCount = 0;
    }, 2000);
    return;
  }
  const modal = APP_STATE.modalTrimCrop;
  const advancedBtn = document.querySelector('.config-advenced-button');
  
  if (!modal) {
    console.error('Modal trimCrop not found');
    return;
  }
  const isVisible = modal.style.display === 'flex' && modal.classList.contains('mtcv-show');
  if (!isVisible) {
    const modalContainer = document.getElementById('modalTrimCropVideoContainer');
    includeHTML('#modalTrimCropVideoContainer', '/api/templates?file=mtcv.html')
      .then(() => {
        document.documentElement.classList.add('mtcv-open');
        modalContainer.style.display = 'flex';
        setTimeout(() => modalContainer.classList.add('mtcv-show'), 10);
        setTimeout(() => {
          initializeDOMElementsForMTCV();
        }, 500);
      })
      .catch(error => {
        console.error('Error loading modal template:', error);
        document.documentElement.classList.add('mtcv-open');
        modalContainer.style.display = 'flex';
        setTimeout(() => modalContainer.classList.add('mtcv-show'), 10);
      });
    if (advancedBtn) advancedBtn.classList.add('advance-btn-active');
  } else {
    modal.classList.remove('mtcv-show');
    document.documentElement.classList.remove('mtcv-open');
    setTimeout(() => modal.style.display = 'none', 300);
    if (advancedBtn) advancedBtn.classList.remove('advance-btn-active');
  }
}

function showDisableOverlay() {
  resolutionOverlay.style.display = 'block';
  qualitynOverlay.style.display = 'block';
  fpsOverlay.style.display = 'block';
}

function hideDisableOverlay() {
  resolutionOverlay.style.display = 'none';
  qualitynOverlay.style.display = 'none';
  fpsOverlay.style.display = 'none';
}
