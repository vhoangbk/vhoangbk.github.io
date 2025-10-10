function populateFormatOptions() {
  const formatSelect = document.getElementById('formatSelect');
  if (!formatSelect) return;
  isPopulating = true;
  const existingOptions = formatSelect.querySelectorAll('[data-codec-format="true"]');
  if (existingOptions.length > 0) {
    isPopulating = false;
    return;
  }
  formatSelect.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Select Format...';
  placeholderOption.disabled = true;
  formatSelect.appendChild(placeholderOption);
  const formatOptions = Object.keys(window.app_settings);
  formatOptions.forEach(format => {
    const option = document.createElement('option');
    option.value = format;
    let displayName = '';
    switch (format) {
      case 'h264':
        displayName = 'MP4 (H.264)';
        break;
      case 'h265':
        displayName = 'MP4 (H.265/HEVC)';
        break;
      case 'av1':
        displayName = 'WebM (AV1)';
        break;
      case 'vp9':
        displayName = 'WebM (VP9)';
        break;
      default:
        displayName = format.toUpperCase();
    }
    option.textContent = displayName;
    option.setAttribute('data-codec-format', 'true');
    formatSelect.appendChild(option);
  });
  if (formatOptions.length > 0) {
    const defaultFormat = formatOptions.includes('h264') ? 'h264' : formatOptions[0];
    formatSelect.value = defaultFormat;
    updateResolutionOptions();
    populateQualityOptions(defaultFormat);
  }
  isPopulating = false;
}

function populateQualityOptions(selectedFormat) {
  const qualitySelect = document.getElementById('qualitySelect');
  if (!qualitySelect || !selectedFormat) return;
  const defaultOptions = ['Auto', 'Low', 'Medium', 'High'];
  qualitySelect.innerHTML = '';

  defaultOptions.forEach(quality => {
    const option = document.createElement('option');
    option.value = quality;
    option.textContent = quality;
    qualitySelect.appendChild(option);
  });
  qualitySelect.value = 'Auto';
}

async function getBlobUrl(url) {
  if (typeof blobUrlMap === 'undefined') {
    blobUrlMap = {};
  }
  if (blobUrlMap[url]) {
    return blobUrlMap[url];
  }

  let response = await fetch(url);
  let blob = await response.blob();
  blobUrlMap[url] = URL.createObjectURL(blob);
  console.log('blobUrlMap', blobUrlMap[url], blobUrlMap);
  return blobUrlMap[url];
}

async function load_wasm_lib() {
  return getBlobUrl(WASM_LIB_URL);
}

function timeToDecimalMinutes(timeStr) {
  if (!timeStr) return 0;
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return +(minutes + seconds / 60).toFixed(2);
}

function getOptimalResolutions(availableResolutions, videoDimensions) {
  if (!videoDimensions || !availableResolutions) {
    return availableResolutions || [];
  }
  const { width: videoWidth, height: videoHeight } = videoDimensions;

  return availableResolutions.sort(([w1, h1], [w2, h2]) => {
    return (w2 * h2) - (w1 * h1);
  });
}

function timeStringToSeconds(timeStr) {
  const parts = timeStr.split(':');
  const minutes = parseInt(parts[0]) || 0;
  const seconds = parseInt(parts[1]) || 0;
  return minutes * 60 + seconds;
}

function parseRatio(ratioString) {
  if (ratioString === 'custom') return null;
  
  const [width, height] = ratioString.split(':').map(Number);
  return { width, height };
}

function showNotification(message) {
  const notification = Object.assign(document.createElement('div'), {
      textContent: message,
      className: 'notification'
  });

  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('show'), 100);

  setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('hide');
      setTimeout(() => document.body.removeChild(notification), 300);
  }, 3000);
}