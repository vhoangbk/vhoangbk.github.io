if (typeof window !== 'undefined' && typeof window.originalVideoSize === 'undefined') {
  window.originalVideoSize = null;
}

function updateVolume(value) {
  const volumeText = document.querySelector('.volume-value-setup');
  const volumeSlider = document.querySelector('.volume-control-slider-setup');
  const numValue = Math.max(0, Math.min(300, parseInt(value)));

  if (volumeText) volumeText.textContent = numValue + '%';

  if (volumeSlider) {
    const percentage = (numValue / 300) * 100;
    volumeSlider.style.setProperty('--volume-percentage', percentage + '%');
    volumeSlider.classList.add('volume-slider-track');

    volumeSlider.value = numValue;
    APP_STATE.volumeSelect = numValue;
    saveSettings(); // Thêm dòng này
  }
}

function updateResolutionOptions() {
  updateConvertButtonState();
  const formatSelect = __getElementByIdByUI('formatSelect');
  const resolutionSelect = __getElementByIdByUI('resolutionSelect');

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

  if (videoDimensions == null && window.originalVideoSize) {
    videoDimensions = {
      ...window.originalVideoSize
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

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'None';
  resolutionSelect.appendChild(noneOpt);
  
  const originalOpt = document.createElement('option');
  originalOpt.value = `${videoDimensions.width}x${videoDimensions.height}`;
  originalOpt.textContent = videoDimensions ?
    `Original (${videoDimensions.width}x${videoDimensions.height})` :
    'Original';
  resolutionSelect.appendChild(originalOpt);

  // Horizontal (disabled)
  const horizontalOpt = document.createElement('option');
  horizontalOpt.value = 'landscape';
  horizontalOpt.textContent = 'Landscape';
  horizontalOpt.disabled = true;
  horizontalOpt.style.color = '#aaa';
  resolutionSelect.appendChild(horizontalOpt);

  filteredResolutions.forEach(resolution => {
    const [width, height] = resolution;
    const option = document.createElement('option');
    option.value = width > height ? `${width}x${height}` : `${height}x${width}`;
    option.textContent = width > height ? `${width}x${height}` : `${height}x${width}`;
    resolutionSelect.appendChild(option);
  });

  // Vertical (disabled)
  const verticalOpt = document.createElement('option');
  verticalOpt.value = 'portrait';
  verticalOpt.textContent = 'Portrait';
  verticalOpt.disabled = true;
  verticalOpt.style.color = '#aaa';
  resolutionSelect.appendChild(verticalOpt);

  filteredResolutions.forEach(resolution => {
    const [width, height] = resolution;
    const option = document.createElement('option');
    option.value = width < height ? `${width}x${height}` : `${height}x${width}`;
    option.textContent = width < height ? `${width}x${height}` : `${height}x${width}`;
    resolutionSelect.appendChild(option);
  });

  if (currentSelection) {
    const optionExists = Array.from(resolutionSelect.options).some(opt => opt.value === currentSelection);
    if (optionExists) {
      resolutionSelect.value = currentSelection;
    } else {
      resolutionSelect.value = `${videoDimensions.width}x${videoDimensions.height}`;
    }
  } else {
    resolutionSelect.value = `${videoDimensions.width}x${videoDimensions.height}`;
  }
  selectedResolutionOptions();
  populateQualityOptions(selectedFormat);
  
  // SỬA: Lưu formatSelect vào localStorage sau khi update xong (trừ khi đang restore)
  if (!isRestoringSettings && typeof saveSettings === 'function') {
    saveSettings();
  }
}

function selectedResolutionOptions() {
  const selectEl = __getElementByIdByUI('resolutionSelect');
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
  saveSettings();
}

function selectedFpsOptions() {
  APP_STATE.fpsSelect = __getElementByIdByUI('fpsSelect').value;
  saveSettings(); // Thêm dòng này
}

function selectedQualityOptions() {
  APP_STATE.qualitySelect = __getElementByIdByUI('qualitySelect').value;
  saveSettings();
}

function getCurrentVideoDimensions() {
  if (APP_STATE.selectedFileInfo) {
    return {
      width: APP_STATE.selectedFileInfo.width,
      height: APP_STATE.selectedFileInfo.height
    };
  }
  return null;
}

function updateConvertButtonState() {
  const appUI = isDisplayed('.app--container');
  const desktopUI = isDisplayed('.desktop-app-container');
  
  let convertBtn = null;
  if (appUI) {
    convertBtn = document.querySelector('.footer-btn-convert');
  } else if (desktopUI) {
    convertBtn = document.querySelector('.desktop-footer-btn-convert');
  } else {
    // Fallback cho old web UI
    convertBtn = document.querySelector('.desktop-footer-btn-convert') || 
                 document.querySelector('.footer-btn-convert') ||
                 document.querySelector('.convert-button');
  }
  
  if (!convertBtn) {
    console.warn('Convert button not found');
    return;
  }
  
  const hasVideo = APP_STATE.selectedFileInfo;
  const formatSelect = __getElementByIdByUI('formatSelect');

  convertBtn.disabled = !hasVideo || !formatSelect || !formatSelect.value;
}

function clickSelectVideoUrl() {
  const selectVideoEl = document.getElementById('select-video-url');
  if (selectVideoEl) {
    const url = selectVideoEl.value.trim();
    if (url.length > 0) {
      showLoadingDialog("Loading video information...");
      APP_STATE.selectedFileInfo = getFileInfo(url, detectDeviceBySize()).then(info => {
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
  // ✅ Dùng passive: true để không block scroll
  document.querySelector('html').addEventListener('touchend', function(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      event.preventDefault(); // ✅ Chỉ prevent khi double tap
    }
    lastTap = currentTime;
  }, { passive: false }); // ✅ Giữ false vì cần prevent double tap

  // ✅ Tối ưu: chỉ prevent khi có nhiều touch points
  document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
      event.preventDefault(); // ✅ Chỉ prevent pinch zoom
    }
  }, { passive: false }); // ✅ Giữ false vì cần prevent pinch
}

function handleNavigateMenu(target) {
  switch(target) {
    case "home":
      window.location.href = "/";
      break;
    case "history":
      window.location.href = "/history.html";
      break;
    case "policy":
      window.location.href = "/policy.html";
      break;
    case "feedback":
      window.location.href = "/policy.html";
      break;
    case "tutorials":
      window.location.href = "/policy.html";
      break;
    default:
      break;
  }
}

function buyPremium() {
  window.location.href = "/inapp.html";
}

function handleHomeClick(event) {
  const currentPath = window.location.pathname;
  if (currentPath === '/m-index.html') {
    toggleMobileMenu();
    return false;
  }
  return true;
}

function loadConvertFileMemory() {
  return get("listConvertFile").then(listFile => {
    if (listFile) {
      console.log('listFile: ', listFile);
    }
  });
}

// Lưu settings vào localStorage
function saveSettings() {
  // Không lưu nếu đang trong quá trình restore
  if (isRestoringSettings) {
    return;
  }
  
  const settings = {
    formatSelect: APP_STATE.formatSelect,
    targetSize: APP_STATE.targetSize,
    resolutionSelect: APP_STATE.resolutionSelect,
    qualitySelect: APP_STATE.qualitySelect,
    fpsSelect: APP_STATE.fpsSelect,
    volumeSelect: APP_STATE.volumeSelect,
    configConvertVideo: APP_STATE.configConvertVideo
  };
  localStorage.setItem('convert_settings', JSON.stringify(settings));
}

// Restore settings từ localStorage
function restoreSettings() {
  const saved = localStorage.getItem('convert_settings');
  if (!saved) {
    console.log('No saved settings found');
    return;
  }
  
  // Bật flag để tắt saveSettings trong quá trình restore
  isRestoringSettings = true;
  
  try {
    const settings = JSON.parse(saved);
    console.log('Restoring settings from localStorage:', settings);
    
    // Restore vào APP_STATE trước
    if (settings.formatSelect) APP_STATE.formatSelect = settings.formatSelect;
    if (settings.targetSize) APP_STATE.targetSize = settings.targetSize;
    if (settings.resolutionSelect) APP_STATE.resolutionSelect = settings.resolutionSelect;
    if (settings.qualitySelect) APP_STATE.qualitySelect = settings.qualitySelect;
    if (settings.fpsSelect) APP_STATE.fpsSelect = settings.fpsSelect;
    if (settings.volumeSelect) APP_STATE.volumeSelect = settings.volumeSelect;
    if (settings.configConvertVideo) APP_STATE.configConvertVideo = settings.configConvertVideo;
    
    // Áp dụng vào form - đảm bảo các dropdown đã được populate
    const formatSelect = __getElementByIdByUI('formatSelect');
    if (formatSelect && settings.formatSelect && formatSelect.value !== settings.formatSelect) {
      formatSelect.value = settings.formatSelect;
      // Gọi updateResolutionOptions nhưng không save (vì flag đang bật)
      setTimeout(() => updateResolutionOptions(), 100);
    }
    
    const targetSize = __getElementByIdByUI('targetSize');
    if (targetSize && settings.targetSize && settings.targetSize !== 'custom' && settings.targetSize !== '' && settings.targetSize !== '0') {
      const targetSizeValue = String(settings.targetSize);
      const exists = Array.from(targetSize.options).some(opt => opt.value === targetSizeValue);
      
      if (!exists) {
        const option = document.createElement('option');
        option.value = targetSizeValue;
        option.textContent = targetSizeValue + 'MB';
        targetSize.appendChild(option);
      }
      
      targetSize.value = targetSizeValue;
    }
    
    setTimeout(() => {
      const currentTargetSize = __getElementByIdByUI('targetSize');
      const targetSizeValue = currentTargetSize ? currentTargetSize.value : settings.targetSize;
      
      if (targetSizeValue && targetSizeValue !== '' && targetSizeValue !== 'custom') {
        if (typeof disableOption === 'function') {
          disableOption(true);
        }
      } else {
        if (typeof disableOption === 'function') {
          disableOption(false);
        }
      }
    }, 500);
    
    setTimeout(() => {
      const currentTargetSize = __getElementByIdByUI('targetSize');
      const targetSizeValue = currentTargetSize ? currentTargetSize.value : '';
      
      if (!targetSizeValue || targetSizeValue === '' || targetSizeValue === 'custom') {
        const resolutionSelect = __getElementByIdByUI('resolutionSelect');
        if (resolutionSelect && settings.resolutionSelect) {
          const res = settings.resolutionSelect;
          const resValue = typeof res === 'object' ? `${res.width}x${res.height}` : res;
          if (Array.from(resolutionSelect.options).some(opt => opt.value === resValue)) {
            resolutionSelect.value = resValue;
            selectedResolutionOptions();
          }
        }
      }
    }, 600);
    
    setTimeout(() => {
      const currentTargetSize = __getElementByIdByUI('targetSize');
      const targetSizeValue = currentTargetSize ? currentTargetSize.value : '';
      
      if (!targetSizeValue || targetSizeValue === '' || targetSizeValue === 'custom') {
        const qualitySelect = __getElementByIdByUI('qualitySelect');
        if (qualitySelect && settings.qualitySelect && qualitySelect.value !== settings.qualitySelect) {
          qualitySelect.value = settings.qualitySelect;
          selectedQualityOptions();
        }
      }
    }, 600);
    
    setTimeout(() => {
      const currentTargetSize = __getElementByIdByUI('targetSize');
      const targetSizeValue = currentTargetSize ? currentTargetSize.value : '';
      
      if (!targetSizeValue || targetSizeValue === '' || targetSizeValue === 'custom') {
        const fpsSelect = __getElementByIdByUI('fpsSelect');
        if (fpsSelect && settings.fpsSelect && fpsSelect.value !== settings.fpsSelect) {
          fpsSelect.value = settings.fpsSelect;
          selectedFpsOptions();
        }
      }
    }, 600);
    
    if (settings.volumeSelect && settings.volumeSelect !== 100) {
      updateVolume(settings.volumeSelect);
    }
    
    console.log('Settings restored successfully');
  } catch (e) {
    console.error('Error restoring settings:', e);
  } finally {
    setTimeout(() => {
      isRestoringSettings = false;
    }, 1000);
  }
}

function loadBannerImage(imgElement, url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    imgElement.src = url;
  };
  img.onerror = function() {
    console.warn('Failed to load banner image:', url);
    imgElement.style.display = 'none';
  };
  img.src = url;
}

function setupLogoAndTitleClick() {
  const elements = document.querySelectorAll(".desktop-title, .desktop-logo");

  elements.forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => {
      const path = window.location.pathname;
      const isHome = path === "/" || path === "/index.html";
      if (isHome) {
        e.preventDefault();
        return;
      }
      window.location.href = "/";
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  setupLogoAndTitleClick();
  const leftBanner = document.getElementById('leftBanner');
  const rightBanner = document.getElementById('rightBanner');
  
  if (leftBanner) {
    loadBannerImage(leftBanner, 'https://nguyencongpc.vn/media/banner/05_Jul16f179b6a4611d58790bb648850ac4af.jpg');
  }
  
  if (rightBanner) {
    loadBannerImage(rightBanner, 'https://nguyencongpc.vn/media/banner/14_Aug6097e242c275340dc87c88b47997d295.jpg');
  }

  const desktopLogo = document.querySelector('.desktop-logo');
  if (desktopLogo) {
    desktopLogo.addEventListener('click', function () {
      window.location.href = '/';
    });
  }

  const appLogo = document.querySelector('.header-logo--container .logo');
  if (appLogo) {
    appLogo.addEventListener('click', function () {
      window.location.href = '/m';
    });
  }

  document.querySelectorAll('.desktop-menu-modal-item').forEach(item => {
    item.addEventListener('click', function (e) {
      const link = item.querySelector('a');
      if (link) {
        link.click();
      }
    });
  });

  document.querySelectorAll('.desktop-menu-modal-item').forEach(item => {
    const link = item.querySelector('a');
    if (!link) return;

    const isActive = link.getAttribute('href') === window.location.pathname;

    if (isActive) {
      item.classList.add('desktop-menu-modal-item-active');
    } else {
      item.classList.remove('desktop-menu-modal-item-active');
    }

    item.addEventListener('click', function (e) {
      e.preventDefault();

      document.querySelectorAll('.desktop-menu-modal-item')
        .forEach(el => el.classList.remove('desktop-menu-modal-item-active'));

      item.classList.add('desktop-menu-modal-item-active');

      if (isActive) {
        toggleDesktopMenu();
      } else {
        window.location.href = link.getAttribute('href');
      }
    });
  });

  document.querySelectorAll('.desktop-header-nav a').forEach(link => {
    link.addEventListener('click', function (e) {
      if (link.getAttribute('href') === window.location.pathname) {
        e.preventDefault();
      }
    });
  });
});
