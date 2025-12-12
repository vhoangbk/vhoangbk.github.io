function populateFormatOptions(restore = false) {
  const formatSelect = __getSelectByKey("format");
  if (!formatSelect) return;
  isPopulating = true;
  const existingOptions = formatSelect.querySelectorAll('[data-codec-format="true"]');
  // if (existingOptions.length > 0) {
  //   isPopulating = false;
  //   return;
  // }
  const selectWrapper = __getSelectByKey("format");
  if (!selectWrapper) return;

  const trigger = selectWrapper.querySelector('.custom-select-trigger');
  const optionsContainer = selectWrapper.querySelector('.custom-options');

  if (!trigger || !optionsContainer) {
    return;
  }

  trigger.textContent = 'Select Format...';

  optionsContainer.innerHTML = '';

  const isMobile = window.innerWidth <= 768;
  let displayName = '';
  const formatOptions = window.app_settings ? Object.keys(window.app_settings) : [];

  if (isMobile) {
    const header = document.createElement('div');
    header.className = 'custom-options-header';
    header.textContent = 'Select Format';
    optionsContainer.appendChild(header);
  }

  const list = document.createElement('div');
  list.className = 'custom-options-list';
  optionsContainer.appendChild(list);

  const container = document.createElement('div');
  container.className = 'custom-options-container format-options-container';
  list.appendChild(container);

  // ---- Add options ----
  formatOptions.forEach(format => {
    const option = document.createElement('div');
    option.className = 'custom-option';
    option.dataset.value = format;
    option.dataset.codecFormat = "true";

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
    container.appendChild(option);
  });

  if (formatOptions.length > 0 && APP_STATE.selectedFile && !restore) {
    const defaultFormat = formatOptions.includes('h264') ? 'h264' : formatOptions[0];
    formatSelect.value = defaultFormat;
    setCustomSelectValue(formatSelect, defaultFormat);
    APP_STATE.formatSelect = defaultFormat;
    populateQualityOptions(defaultFormat);
    highlighSelectedOption(formatSelect, defaultFormat);
  }

  isPopulating = false;
}

function resetFormatSelect() {
  const select = __getSelectByKey("format");
  if (!select) return;

  const trigger = select.querySelector(".custom-select-trigger");
  const optionsBox = select.querySelector(".custom-options");

  // Reset text hiển thị về placeholder
  trigger.textContent = "Select Format...";

  // Xóa toàn bộ option cũ
  optionsBox.innerHTML = "";

  // Reset value lưu trong dataset
  select.dataset.value = "";

  // Nếu custom-select đang mở → đóng lại
  select.classList.remove("open");
}

// function populateQualityOptions(selectedFormat) {
//   const qualitySelect = __getElementByIdByUI('qualitySelect');
//   if (!qualitySelect || !selectedFormat) return;
//   const defaultOptions = ['None', 'Low', 'Medium', 'High'];
//   qualitySelect.innerHTML = '';

//   defaultOptions.forEach(quality => {
//     const option = document.createElement('option');
//     option.value = quality;
//     option.textContent = quality;
//     qualitySelect.appendChild(option);
//   });
//   qualitySelect.value = 'None';
// }

function populateQualityOptions(selectedFormat) {
  const isMobile = window.innerWidth <= 768;

  const qualitySelect = __getSelectByKey("quality");
  if (!qualitySelect) return;

  const optionsBox = qualitySelect.querySelector('.custom-options');
  const trigger = qualitySelect.querySelector('.custom-select-trigger');

  optionsBox.innerHTML = "";

  // =====================================================
  // 🔥 CASE: KHÔNG CÓ selectedFormat → CHỈ GEN "None"
  // =====================================================
  if (!selectedFormat) {

    if (isMobile) {
      // HEADER
      const header = document.createElement("div");
      header.className = "custom-options-header";
      header.textContent = "Select Quality";
      optionsBox.appendChild(header);

      // LIST WRAPPER
      const list = document.createElement("div");
      list.className = "custom-options-list";
      optionsBox.appendChild(list);

      // CONTAINER
      const container = document.createElement("div");
      container.className = "custom-options-container";
      list.appendChild(container);

      // ONLY ONE OPTION: NONE
      const opt = document.createElement("div");
      opt.className = "custom-option";
      opt.dataset.value = "None";
      opt.textContent = "None";
      container.appendChild(opt);
    } 
    else {
      // DESKTOP → CHỈ 1 OPTION None
      const opt = document.createElement("div");
      opt.className = "custom-option";
      opt.dataset.value = "None";
      opt.textContent = "None";
      optionsBox.appendChild(opt);
    }

    qualitySelect.dataset.value = "None";
    trigger.textContent = "None";
    highlighSelectedOption(qualitySelect, "None");
    return;
  }

  // =====================================================
  // 🔥 CASE: selectedFormat TỒN TẠI → GEN FULL
  // =====================================================

  const defaultOptions = ['None', 'Low', 'Medium', 'High'];

  if (isMobile) {
    const header = document.createElement("div");
    header.className = "custom-options-header";
    header.textContent = "Select Quality";
    optionsBox.appendChild(header);

    const list = document.createElement("div");
    list.className = "custom-options-list";
    optionsBox.appendChild(list);

    const container = document.createElement("div");
    container.className = "custom-options-container";
    list.appendChild(container);

    defaultOptions.forEach(q => {
      const opt = document.createElement("div");
      opt.className = "custom-option";
      opt.dataset.value = q;
      opt.textContent = q;
      container.appendChild(opt);
    });

  } else {
    defaultOptions.forEach(q => {
      const opt = document.createElement("div");
      opt.className = "custom-option";
      opt.dataset.value = q;
      opt.textContent = q;
      optionsBox.appendChild(opt);
    });
  }

  qualitySelect.dataset.value = "None";
  trigger.textContent = "None";
  highlighSelectedOption(qualitySelect, "None");
}

function populateFPSOptions(restore = false) {
  const selectWrapper = __getSelectByKey("fps");
  if (!selectWrapper) return;

  const optionsContainer = selectWrapper.querySelector('.custom-options');
  const trigger = selectWrapper.querySelector('.custom-select-trigger');
  if (!optionsContainer || !trigger) return;

  // Reset nội dung
  optionsContainer.innerHTML = '';
  trigger.textContent = 'Original';

  const FPS_LIST = ["original", "15", "24", "25", "30", "60"];
  const isMobile = window.innerWidth <= 768;

  if (!isMobile) {
    FPS_LIST.forEach(v => {
      const option = document.createElement('div');
      option.className = 'custom-option';
      option.dataset.value = v;
      option.dataset.codecFormat = "true";
      option.textContent = v === "original" ? "Original" : v;
      optionsContainer.appendChild(option);
    });
  } 
  else {
    const header = document.createElement('div');
    header.className = 'custom-options-header';
    header.textContent = "Select FPS";
    optionsContainer.appendChild(header);

    const list = document.createElement('div');
    list.className = 'custom-options-list';
    optionsContainer.appendChild(list);

    const container = document.createElement('div');
    container.className = 'custom-options-container';
    list.appendChild(container);

    FPS_LIST.forEach(v => {
      const option = document.createElement('div');
      option.className = 'custom-option';
      option.dataset.value = v;
      option.dataset.codecFormat = "true";
      option.textContent = v === "original" ? "Original" : v;
      container.appendChild(option);
    });
  }
  highlighSelectedOption(selectWrapper, "original");
}

function populateVolumeOptions(restore = false) {
  const selectWrapper = __getSelectByKey("volume");
  if (!selectWrapper) return;

  const optionsContainer = selectWrapper.querySelector('.custom-options');
  const trigger = selectWrapper.querySelector('.custom-select-trigger');
  if (!optionsContainer || !trigger) return;

  optionsContainer.innerHTML = '';
  trigger.textContent = '100%';

  const VOLUME_LIST = ["0%", "25%", "50%", "75%", "100%", "125%", "150%", "175%", "200%", "225%", "250%", "300%"];
  const isMobile = window.innerWidth <= 768;

  if (!isMobile) {
    VOLUME_LIST.forEach(v => {
      const option = document.createElement('div');
      option.className = 'custom-option';
      option.dataset.value = v;
      option.dataset.codecFormat = "true";
      option.textContent = v;
      optionsContainer.appendChild(option);
    });
  } 
  else {
    const header = document.createElement('div');
    header.className = 'custom-options-header';
    header.textContent = "Select Volume";
    optionsContainer.appendChild(header);

    const list = document.createElement('div');
    list.className = 'custom-options-list';
    optionsContainer.appendChild(list);

    const container = document.createElement('div');
    container.className = 'custom-options-container';
    list.appendChild(container);

      VOLUME_LIST.forEach(v => {
      const option = document.createElement('div');
      option.className = 'custom-option';
      option.dataset.value = v;
      option.dataset.codecFormat = "true";
      option.textContent = v;
      container.appendChild(option);
    });
  }
  highlighSelectedOption(selectWrapper, "100%");
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

function __getSelectByKey(key) {
  const isApp = isDisplayed('.app--container');
  const isDesktop = isDisplayed('.desktop-app-container');

  if (isApp) {
    return document.querySelector(`.custom-select[data-ui="app"][data-key="${key}"]`);
  }

  if (isDesktop) {
    return document.querySelector(`.custom-select[data-ui="desktop"][data-key="${key}"]`);
  }

  // fallback: thử desktop trước, nếu không có thì app
  return (
    document.querySelector(`.custom-select[data-ui="desktop"][data-key="${key}"]`) ||
    document.querySelector(`.custom-select[data-ui="app"][data-key="${key}"]`)
  );
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
