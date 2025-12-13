function populateFormatOptions() {
  const formatSelect = __getElementByIdByUI('formatSelect');
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
        displayName = 'MP4 (H.265)';
        break;
      case 'av1':
        displayName = 'MP4 (AV1)';
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

function resetFormatSelect() {
  const formatSelect = __getElementByIdByUI('formatSelect');
  if (!formatSelect) return;

  formatSelect.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Select Format...';
  placeholderOption.disabled = true;
  placeholderOption.selected = true;

  formatSelect.appendChild(placeholderOption);
}


function populateQualityOptions(selectedFormat) {
  const qualitySelect = __getElementByIdByUI('qualitySelect');
  if (!qualitySelect || !selectedFormat) return;
  const defaultOptions = ['None', 'Low', 'Medium', 'High'];
  qualitySelect.innerHTML = '';

  defaultOptions.forEach(quality => {
    const option = document.createElement('option');
    option.value = quality;
    option.textContent = quality;
    qualitySelect.appendChild(option);
  });
  qualitySelect.value = 'None';
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
  const blobUrl = URL.createObjectURL(blob);
  blobUrlMap[url] = blobUrl;
  return blobUrl;
}

function cleanupBlobUrlMap() {
  if (typeof blobUrlMap !== 'undefined') {
    Object.values(blobUrlMap).forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    blobUrlMap = {};
  }
}

// async function loadWasmLib() {
//   return getBlobUrl(WASM_LIB_URL);
// }

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

function parseRatio(ratioString) {
  if (ratioString === 'custom') return null;
  
  const [width, height] = ratioString.split(':').map(Number);
  return { width, height };
}

function showNotification(message) {
  const notification = Object.assign(document.createElement('div'), {
      textContent: message,
      className: 'bee-notification'
  });

  document.body.appendChild(notification);

  notification.style.zIndex = '999999';
  notification.style.pointerEvents = 'auto';
  setTimeout(() => notification.classList.add('show'), 100);

  setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('hide');
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
  }, 3000);
}

/**
 * Helper function để lấy element theo ID dựa trên UI mode
 * @param {string} baseId - ID cơ bản (ví dụ: 'formatSelect', 'targetSize')
 * @param {Object} options - Options với suffix cho từng UI mode
 * @param {string} options.app - Suffix cho app UI (default: 'App')
 * @param {string} options.desktop - Suffix cho desktop (default: 'Desktop')
 * @returns {HTMLElement|null} Element được tìm thấy hoặc null
 */
function __getElementByIdByUI(baseId, options = {}) {
  const appUI = isDisplayed('.app--container');
  const desktopUI = isDisplayed('.desktop-app-container');
  
  const appSuffix = options.app !== undefined ? options.app : 'App';
  const desktopSuffix = options.desktop !== undefined ? options.desktop : 'Desktop';
  
  let elementId;
  if (appUI) {
    elementId = baseId + appSuffix;
  } else if (desktopUI) {
    elementId = baseId + desktopSuffix;
  } else {
    // Fallback: thử desktop trước, nếu không có thì app
    const desktopId = baseId + desktopSuffix;
    const appId = baseId + appSuffix;
    const desktopEl = document.getElementById(desktopId);
    elementId = desktopEl ? desktopId : appId;
  }
  
  return document.getElementById(elementId);
}

/**
 * Helper function để lấy element bằng querySelector dựa trên UI mode
 * @param {Object} selectors - Object chứa selector cho từng UI mode
 * @param {string} selectors.app - Selector cho app UI
 * @param {string} selectors.desktop - Selector cho desktop
 * @returns {HTMLElement|null} Element được tìm thấy hoặc null
 */
function getElementBySelectorByUI(selectors) {
  const appUI = isDisplayed('.app--container');
  const desktopUI = isDisplayed('.desktop-app-container');
  
  let selector;
  if (appUI && selectors.app) {
    selector = selectors.app;
  } else if (desktopUI && selectors.desktop) {
    selector = selectors.desktop;
  } else if (selectors.desktop) {
    // Fallback: thử desktop
    selector = selectors.desktop;
  } else if (selectors.app) {
    // Fallback: thử app
    selector = selectors.app;
  }
  
  return selector ? document.querySelector(selector) : null;
}

if (typeof handler === 'undefined') {
  window.handler = async function(payload) {
    console.warn('Default handler called with:', payload);
    return null;
  };
}
