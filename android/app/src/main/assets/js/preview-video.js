function showVideoPreview(selected_file_info) {
  console.log('selected_file_info', selected_file_info);

  const videoTitle = getElementBySelectorByUI({
    app: '.video-title',
    desktop: '.desktop-video-title'
  });
  if (videoTitle) videoTitle.textContent = selected_file_info.name;

  const videoThumbnail = getElementBySelectorByUI({
    app: '.video-thumbnail',
    desktop: '.desktop-video-thumbnail'
  });
  if (videoThumbnail) {
    videoThumbnail.style.backgroundImage = `url(${selected_file_info.thumbnail})`;
    videoThumbnail.style.backgroundPosition = 'center';
    videoThumbnail.style.backgroundSize = 'contain';
    videoThumbnail.style.backgroundRepeat = 'no-repeat';
  }

  const videoDetails = getElementBySelectorByUI({
    app: '.video-details',
    desktop: '.desktop-video-details'
  });
  if (videoDetails) videoDetails.innerHTML = `
      <div class="container-list-selected-info" style="display: flex; flex-direction: column;">
        <div class="container-selected-info" style="display: flex; justify-content: space-between;">
          <span>${selected_file_info.width}x${selected_file_info.height}</span>
          <span>${selected_file_info.displaySize}</span> 
        </div>
        <div class="container-selected-info" style="display: flex; justify-content: space-between;">
          <span>${formatDuration(selected_file_info.duration)}</span>
          <span>${selected_file_info.videoCodec}</span>
        </div>
      </div>
  `;

  const videoPreview = __getElementByIdByUI('videoPreview');
  if (videoPreview) {
    videoPreview.classList.add('show');
    videoPreview.style.display = 'flex';
  }
  
  const desktopUI = isDisplayed('.desktop-app-container');
  if (desktopUI) {
    const uploadArea = document.getElementById('uploadFileDesktop');
    if (uploadArea) {
      uploadArea.classList.add('hidden');
    }
  }
}

function formatDuration(duration) {
  if (!duration || !isFinite(duration)) return '0:00';

  const days = Math.floor(duration / 86400); // 1 ngày = 86400 giây
  const hours = Math.floor((duration % 86400) / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);

  let result = '';

  if (days > 0) {
    result += `${days.toString().padStart(2, '0')}:`;
  }

  if (hours > 0 || days > 0) {
    result += `${hours.toString().padStart(2, '0')}:`;
  }

  result += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (minutes === 0 && hours === 0 && days === 0) {
    const fraction = Math.round((duration % 1) * 100);
    if (fraction > 0) {
      result += `.${fraction.toString().padStart(2, '0')}`;
    }
  }

  return result.trim();
}

function onCloseVideoPreview() {
  const videoPreview = __getElementByIdByUI('videoPreview');
  const desktopUI = isDisplayed('.desktop-app-container');
  const appUI = isDisplayed('.app--container');
  
  if (videoPreview) {
    videoPreview.classList.remove('show');
    videoPreview.style.display = 'none';
    localStorage.removeItem('convert_settings');
  }
  
  if (desktopUI) {
    const uploadArea = document.getElementById('uploadFileDesktop');
    if (uploadArea) {
      uploadArea.classList.remove('hidden');
      uploadArea.style.display = 'flex';
    }
    
    const inputFile = document.getElementById('inputFileDesktop');
    if (inputFile) inputFile.value = null;
  } else if (appUI) {
    const uploadArea = document.getElementById('upload-trigger-app');
    if (uploadArea) {
      uploadArea.style.display = 'flex';
    }
    
    const inputFile = document.getElementById('inputFileApp');
    if (inputFile) inputFile.value = null;
  }
  
  APP_STATE.selectedFileInfo = null;
  APP_STATE.selectedFile = null;
  APP_STATE.modalTrimCrop = null;
  APP_STATE.configConvertVideo = null;
  set("selectedFile", null);
  resetConvertInfo();
  updateConvertButtonState();
  resetTimelineVariables();
  resetFormatSelect();
  populateFormatOptions();
  updateResolutionOptions();
}

function selectedQualityOptions() {
  const selectEl = __getSelectByKey("quality");
  if (!selectEl) return;

  const value = selectEl.dataset.value || "";

  APP_STATE.qualitySelect = value;
  saveSettings();
}

function resetConvertInfo() {
  const formatSelect = __getSelectByKey("format");
  const targetSizeSelect = __getSelectByKey("target-size");
  const resolutionSelect = __getSelectByKey("resolution");
  const fpsSelect = __getSelectByKey("fps");

  if (formatSelect) setCustomSelectValue(formatSelect, "");
  if (targetSizeSelect) setCustomSelectValue(targetSizeSelect, "");
  
  if (resolutionSelect) {
    const optionsBox = resolutionSelect.querySelector('.custom-options');
    const trigger = resolutionSelect.querySelector('.custom-select-trigger');

    optionsBox.innerHTML = "";

    const opt = document.createElement("div");
    opt.className = "custom-option";
    opt.dataset.value = "";
    opt.textContent = "None";
    optionsBox.appendChild(opt);

    resolutionSelect.dataset.value = "";
    trigger.textContent = "None";
  }
  
  populateQualityOptions('None');
  
  if (fpsSelect) setCustomSelectValue(fpsSelect, "original");
  
  setCustomSelectValue(__getSelectByKey("volume"), "100%");

  APP_STATE.volumeSelect = 100;

  APP_STATE.modalTrimCrop = null;
  APP_STATE.selectedFileInfo = null;
  APP_STATE.selectedFile = null;
  APP_STATE.urlVideo = null;
  APP_STATE.configConvertVideo = null;
  APP_STATE.ratioOfWeb = 1;  
  APP_STATE.formatSelect = null;
  APP_STATE.targetSize = null;
  APP_STATE.resolutionSelect = null;
  APP_STATE.volumeSelect = 100;
  APP_STATE.fpsSelect = null;
  APP_STATE.qualitySelect = null;

  mtcv_mediaLoaded = false;
  mtcv_origWidth = 0, mtcv_origHeight = 0;
  mtcv_mediaWidth = 0, mtcv_mediaHeight = 0;
  mtcv_mediaOffsetX = 0, mtcv_mediaOffsetY = 0;
  mtcv_box = { x: 0, y: 0, w: 150, h: 150, visible: false };
  mtcv_action = null;
  mtcv_pointerStart = { x: 0, y: 0 };
  mtcv_boxStart = null;

  mtcv_play = null;
  mtcv_progressContainer = null;
  mtcv_isDragging = false;
  mtcv_dragTarget = null;
  mtcv_startTime = 0;
  mtcv_endTime = 0;
  mtcv_videoDuration = 0;
  mtcv_wasPlaying = false;

  mtcv_initialMouseX = 0
  mtcv_initialMouseY = 0;

  mtcv_currentRatio = null;
  mtcv_minSize = 40;
  mtcv_widthAtMax = false;
  mtcv_heightAtMax = false;
  mtcv_flipState = {
    vertical: false,
    horizontal: false
  };
  mtcv_showCropBox = false;
  mtcv_showTrimVideo = false;
  mtcv_showVerticalFlip = false;
  mtcv_showHorizontalFlip = false;

  hideDisableOverlay();
  setTrimCropFlipInfo();
}

function resetTimelineVariables() {
  if (typeof mtcv_startTime !== 'undefined') mtcv_startTime = 0;
  if (typeof mtcv_endTime !== 'undefined') mtcv_endTime = 0;
  if (typeof mtcv_videoDuration !== 'undefined') mtcv_videoDuration = 0;
  if (typeof mtcv_wasPlaying !== 'undefined') mtcv_wasPlaying = false;
  if (typeof mtcv_isDragging !== 'undefined') mtcv_isDragging = false;
  if (typeof mtcv_dragTarget !== 'undefined') mtcv_dragTarget = null;
}
