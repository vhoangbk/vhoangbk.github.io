function updateVolume(value) {
  const volumeText = document.querySelector('.volume-config-value');
  const volumeSlider = document.querySelector('.volume-control-slider');
  const numValue = Math.max(0, Math.min(300, parseInt(value)));

  if (volumeText) volumeText.textContent = numValue + '%';

  if (volumeSlider) {
    const percentage = (numValue / 300) * 100;
    volumeSlider.style.setProperty('--volume-percentage', percentage + '%');
    volumeSlider.classList.add('volume-slider-track');

    volumeSlider.value = numValue;
    APP_STATE.volumeSelect = numValue;
  }
}

function updateResolutionOptions() {
  const formatSelect = document.getElementById('formatSelect');
  const resolutionSelect = document.getElementById('resolutionSelect');

  if (!formatSelect || !resolutionSelect || !window.app_settings) {
    return;
  }
  const currentSelection = resolutionSelect.value;
  APP_STATE.formatSelect = formatSelect.value;
  const selectedFormat = formatSelect.value;
  if (!window.app_settings[selectedFormat]) {
    return;
  }
  const codecData = window.app_settings[selectedFormat];
  if (!codecData['Main'] || !codecData['Main'] || !codecData['Main'].supported_resolution) {
    return;
  }
  let videoDimensions = getCurrentVideoDimensions();

  if (videoDimensions == null) {
    videoDimensions = {
      ...originalVideoSize
    }
  }
  let isLandscape = true; // Default to landscape
  if (videoDimensions && videoDimensions.width && videoDimensions.height) {
    isLandscape = videoDimensions.width >= videoDimensions.height;
  } else {
  }
  const resolutionSet = isLandscape ?
    codecData['Main'].supported_resolution.landscape :
    codecData['Main'].supported_resolution.portrait;
  const filteredResolutions = getOptimalResolutions(resolutionSet, videoDimensions);
  resolutionSelect.innerHTML = '';
  const originalOpt = document.createElement('option');
  originalOpt.value = '';
  originalOpt.textContent = videoDimensions ?
    `Original (${videoDimensions.width}x${videoDimensions.height})` :
    'Original';
  resolutionSelect.appendChild(originalOpt);
  filteredResolutions.forEach(resolution => {
    const [width, height] = resolution;
    const option = document.createElement('option');
    option.value = `${width}x${height}`;
    option.textContent = `${width}x${height}`;
    resolutionSelect.appendChild(option);
  });

  if (currentSelection) {
    const optionExists = Array.from(resolutionSelect.options).some(opt => opt.value === currentSelection);
    if (optionExists) {
      resolutionSelect.value = currentSelection;
    } else {
      resolutionSelect.value = '';
    }
  } else {
    resolutionSelect.value = '';
  }
  populateQualityOptions(selectedFormat);
}

function selectedResolutionOptions() {
  const selectEl = document.getElementById('resolutionSelect');
  const value = selectEl?.value;

  if (!value || typeof value !== 'string' || !value.includes("x")) {
    APP_STATE.resolutionSelect = undefined;
    return;
  }

  const [width, height] = value.split("x").map(Number);

  if (isNaN(width) || isNaN(height)) {
    APP_STATE.resolutionSelect = undefined;
    return;
  }

  APP_STATE.resolutionSelect = { width, height };
}

function selectedFpsOptions() {
  APP_STATE.fpsSelect = document.getElementById('fpsSelect').value;
}

function selectedQualityOptions() {
  APP_STATE.qualitySelect = document.getElementById('qualitySelect').value;
}

function getCurrentVideoDimensions() {
  console.log("APP_STATE.selectedFileInfo", document.querySelector('video'));
  if (APP_STATE.selectedFileInfo) {
    return {
      width: APP_STATE.selectedFileInfo.width,
      height: APP_STATE.selectedFileInfo.height
    };
  }
  return null;
}

function updateConvertButtonState() {
  const convertBtn = document.querySelector('.convert-button');
  if (!convertBtn) return;
  const hasVideo = APP_STATE.selectedFileInfo;
  convertBtn.disabled = !hasVideo;
}

function clickSelectVideoUrl() {
  const selectVideoEl = document.getElementById('select-video-url');
  if (selectVideoEl) {
    const url = selectVideoEl.value.trim();
    if (url.length > 0) {
      showLoadingDialog("Loading video infomation....");
      APP_STATE.selectedFileInfo = getFileInfo(url).then(info => {
        hideLoadingDialog();
        if (info) {
          APP_STATE.selectedFile = null;
          APP_STATE.selectedFileInfo = info;
          APP_STATE.selectedFileInfo.name = selectVideoEl.textContent || 'noName';
          updateConvertButtonState();
          showVideoPreview(APP_STATE.selectedFileInfo);
          document.getElementById('videoPreview').classList.add('show');
          const uploadArea = document.getElementById('uploadFileConvert');
          if (uploadArea) {
            uploadArea.style.display = 'none';
          }
          populateFormatOptions()
        } else {
          showAppError("Failed to load video from the provided URL. Please check the URL and try again.");
        }
      }).catch(err => {
        hideLoadingDialog();
      });

      setTimeout(() => {
        hideLoadingDialog();
      }, 10000);
    }
  }
}

function blockDoubleTapZoom() {
  let lastTap = 0;
    document.querySelector('html').addEventListener('touchend', function(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      event.preventDefault();
    }
    lastTap = currentTime;
  }, { passive: false });

  document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });
}
