function openModalAdvancedConfig() {
  if (!APP_STATE.selectedFileInfo) {
    showNotification('Please upload a video file first');
    return;
  }
  isOpenModalAdvancedConfig = 1;
  const modal = APP_STATE.modals.trimCrop;
  const advancedBtn = document.querySelector('.config-advenced-button');
  
  if (!modal) {
    console.error('Modal trimCrop not found');
    return;
  }
  const isVisible = modal.style.display === 'flex' && modal.classList.contains('mtcv-show');
  if (!isVisible) {
    includeHTML('#modalTrimCropVideoContainer', '/components/modal-trim-crop-video/mtcv.html');
    document.documentElement.classList.add('mtcv-open');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('mtcv-show'), 10);
    setTimeout(() => {
      initializeDOMElementsForMTCV();
    }, 200);
    if (advancedBtn) advancedBtn.classList.add('advance-btn-active');
  } else {
    modal.classList.remove('mtcv-show');
    document.documentElement.classList.remove('mtcv-open');
    setTimeout(() => modal.style.display = 'none', 300);
    if (advancedBtn) advancedBtn.classList.remove('advance-btn-active');
  }
}

