function showVideoPreview(selected_file_info) {
  console.log('selected_file_info', selected_file_info);
  const videoTitle = document.querySelector('.video-title');
  if (videoTitle) videoTitle.textContent = selected_file_info.name;
  const videoThumbnail = document.querySelector('.video-thumbnail');
  if (videoThumbnail) videoThumbnail.style.background = `url(${selected_file_info.thumbnail}) center/cover`;
  const videoDetails = document.querySelector('.video-details');
  if (videoDetails) videoDetails.innerHTML = `
      <div style="display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between;">
          <span>${selected_file_info.width}x${selected_file_info.height}</span>
          <span>${formatSizeToMB(Math.floor(selected_file_info.lengthInMB))}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>${formatDuration(selected_file_info.duration)}</span>
          <span>${selected_file_info.mediaCode}</span>
        </div>
      </div>
  `;
  const videoPreview = document.getElementById('videoPreview');
  videoPreview.classList.add('show');
}

function formatSizeToMB(mb) {
  if (mb < 1024) {
    return `${mb} MB`;
  } else if (mb < 1024 * 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  } else {
    return `${(mb / (1024 * 1024)).toFixed(2)} TB`;
  }
}

function formatDuration(duration) {
  if (!duration || !isFinite(duration)) return '0:00';
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  if (hours > 0) {
    return [hours, minutes, seconds]
      .map(n => n.toString().padStart(2, '0'))
      .join(':');
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

function onCloseVideoPreview() {
  document.getElementById('videoPreview').classList.remove('show');
  document.getElementById('uploadFileConvert').style.display = 'flex';
  document.getElementById("inputFile").value = null;
  APP_STATE.selectedFileInfo = null;
  APP_STATE.selectedFile = null;
  APP_STATE.modalTrimCrop = null;
  APP_STATE.configConvertVideo = null;
  set("selectedFile", null);
  resetConvertInfo();
  updateConvertButtonState();
  resetTimelineVariables();
}

function resetConvertInfo() {
  const formatSelect = document.getElementById('formatSelect');
  const targetSizeSelect = document.getElementById('targetSize');
  const resolutionSelect = document.getElementById('resolutionSelect');
  const fpsSelect = document.getElementById('fpsSelect');
  const volumeSlider = document.getElementById('volume');

  formatSelect.value = '';
  targetSizeSelect.value = '';
  //reset resolution options
  resolutionSelect.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = 'None';
  resolutionSelect.appendChild(opt);
  resolutionSelect.value = '';
  populateQualityOptions('None');
  fpsSelect.value = 'original';
  //Volume
  volumeSlider.value = 100;
  const volumeText = document.querySelector('.volume-config-value');
  if (volumeText) volumeText.textContent = '100%';
  const volumeSliderBg = document.querySelector('.volume-control-slider');
  volumeSliderBg.style.setProperty('--volume-percentage', 33.33 + '%');
  APP_STATE.volumeSelect = 100;

  //reset test video
  const testVideoSelect = document.getElementById('corner-select');
  testVideoSelect.value = '';

  //reset APP_STATE
  APP_STATE.modalTrimCrop = null;
  APP_STATE.selectedFileInfo = null;
  APP_STATE.selectedFile = null;
  APP_STATE.urlVideo = null;
  APP_STATE.configConvertVideo = null;
  APP_STATE.ratioOfWeb = 1;  
  APP_STATE.formatSelect = null;
  APP_STATE.targetSize = null;
  APP_STATE.resolutionSelect = null;
  APP_STATE.volumeSelect = 100;    APP_STATE.fpsSelect = null;
  APP_STATE.qualitySelect = null;

  //reset advanced options
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
}

function resetTimelineVariables() {
  if (typeof mtcv_startTime !== 'undefined') mtcv_startTime = 0;
  if (typeof mtcv_endTime !== 'undefined') mtcv_endTime = 0;
  if (typeof mtcv_videoDuration !== 'undefined') mtcv_videoDuration = 0;
  if (typeof mtcv_wasPlaying !== 'undefined') mtcv_wasPlaying = false;
  if (typeof mtcv_isDragging !== 'undefined') mtcv_isDragging = false;
  if (typeof mtcv_dragTarget !== 'undefined') mtcv_dragTarget = null;
}
