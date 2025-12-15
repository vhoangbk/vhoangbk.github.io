if (typeof window !== 'undefined' && typeof window.originalVideoSize === 'undefined') {
  window.originalVideoSize = null;
}

function updateVolume(value) {
  if(value) {
    const stringValue = String(value);
    let raw = parseInt(stringValue.replace('%', '').trim());
    const numValue = Math.max(0, Math.min(300, raw));
    APP_STATE.volumeSelect = numValue;
    saveSettings();
  }
}

function toggleOptionsDisplay(optionsEl, shouldShow) {
  if (!optionsEl) return;
  optionsEl.style.display = shouldShow ? "block" : "none";
}

// Function để tắt scroll background (chỉ trên mobile)
let mobileScrollPosition = 0;
function lockMobileScroll() {
  if (window.innerWidth > 768) return; // Chỉ áp dụng trên mobile

  if (!document.body.classList.contains('mobile-scroll-locked')) {
    mobileScrollPosition = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${mobileScrollPosition}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.height = 'auto';

    document.body.classList.add('mobile-scroll-locked');

    // Prevent layout shift while keeping scroll position stable
    document.body.style.transition = 'none';
  }
}

// Function để mở scroll background (chỉ trên mobile)
function unlockMobileScroll() {
  if (window.innerWidth > 768) return; // Chỉ áp dụng trên mobile
  
  if (document.body.classList.contains('mobile-scroll-locked')) {
    const bodyTop = document.body.style.top;
    if (bodyTop && mobileScrollPosition === 0) {
      const parsed = parseInt(bodyTop.replace('px', '').replace('-', ''));
      if (!isNaN(parsed)) {
        mobileScrollPosition = parsed;
      }
    }
    
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.height = '';
    
    document.documentElement.style.overflow = '';
    document.documentElement.style.position = '';
    document.documentElement.style.width = '';
    document.documentElement.style.height = '';
    document.documentElement.style.left = '';
    document.documentElement.style.right = '';
    document.documentElement.style.top = '';
    
    document.body.classList.remove('mobile-scroll-locked');
    document.documentElement.classList.remove('mobile-scroll-locked');
    
    const savedPosition = mobileScrollPosition || 0;
    if (savedPosition > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPosition);
        document.documentElement.scrollTop = savedPosition;
        setTimeout(() => {
          if (window.pageYOffset !== savedPosition) {
            window.scrollTo(0, savedPosition);
          }
        }, 50);
      });
    }
    
    mobileScrollPosition = 0;
  }
}

function updateResolutionOptions(restore = false) {
  updateConvertButtonState();

  const formatSelect = __getSelectByKey("format");
  const resolutionSelect = __getSelectByKey("resolution");
  const selectedOptionEl = resolutionSelect?.querySelector(".custom-option.selected");
  const wasCroppedSelected = Boolean(
    selectedOptionEl &&
    (selectedOptionEl.classList.contains("cropped-item") ||
      (selectedOptionEl.textContent || "").toLowerCase().includes("cropped"))
  );
  const savedResolutionValue = (() => {
    if (!APP_STATE.resolutionSelect) return "";
    if (typeof APP_STATE.resolutionSelect === "object") {
      const { width, height } = APP_STATE.resolutionSelect;
      if (width && height) return `${width}x${height}`;
      return "";
    }
    return APP_STATE.resolutionSelect;
  })();
  const savedResolutionIsCropped = APP_STATE.resolutionSelectIsCropped === true;

  if (!APP_STATE.selectedFile) {
    const fallbackItems = [
      { value: "", text: "None" }
    ];
    fillCustomSelect(resolutionSelect, fallbackItems, restore);

    if (resolutionSelect && !restore) {
      resolutionSelect.dataset.value = "";
      const trigger = resolutionSelect.querySelector(".custom-select-trigger");
      highlighSelectedOption(resolutionSelect, "");
      if (trigger) trigger.textContent = "None";
    }

    return;
  }

  const currentSelection = resolutionSelect.dataset ? (resolutionSelect.dataset.value || "") : "h264";
  const selectedFormat = formatSelect.dataset?.value;
  APP_STATE.formatSelect = selectedFormat;

  if (!window.app_settings[selectedFormat]) {
    // Gen None
    fillCustomSelect(resolutionSelect, [{ value:"", text:"None" }], restore);
    resolutionSelect.dataset.value = "";
    resolutionSelect.querySelector(".custom-select-trigger").textContent = "None";
    return;
  }

  const codecData = window.app_settings[selectedFormat];
  const main = codecData?.Main ?? codecData?.[0];

  if (!main?.supported_resolution) {
    fillCustomSelect(resolutionSelect, [{ value:"", text:"None" }], restore, true);
    return;
  }

  let videoDimensions = getCurrentVideoDimensions();
  if (!videoDimensions && window.originalVideoSize) {
    videoDimensions = { ...window.originalVideoSize };
  }

  let isLandscape = true;
  if (videoDimensions?.width && videoDimensions?.height) {
    isLandscape = videoDimensions.width >= videoDimensions.height;
  }

  const items = [];
  if(!APP_STATE.selectedFile) {
    items.push({ value: "", text: "None" });
  }

  const originalVal = videoDimensions ? `${videoDimensions.width}x${videoDimensions.height}` : "";
  items.push({
    value: originalVal,
    text: videoDimensions ? `Original (${originalVal})` : "Original"
  });

  let cropCheck = false;
  if (APP_STATE.configConvertVideo) {
    cropCheck = APP_STATE.configConvertVideo.cropCheck;
  }

  let croppedVal = null;
  if (cropCheck) {
    const cw = APP_STATE.configConvertVideo.width;
    const ch = APP_STATE.configConvertVideo.height;
    if (cw && ch) {
      croppedVal = `${cw}x${ch}`;
      items.push({
        value: croppedVal,
        text: `Cropped (${croppedVal})`,
        className: "cropped-item"
      });
    }
  }

  const resObj = main?.supported_resolution;

  if (resObj) {
    const { landscape = [], portrait = [] } = resObj;
    // Landscape
    landscape.forEach(([w, h]) => {
      items.push({ value: `${w}x${h}`, text: `${w}x${h}` });
    });
    // Portrait
    portrait.forEach(([w, h]) => {
      items.push({ value: `${w}x${h}`, text: `${w}x${h}` });
    });
  }

  fillCustomSelect(resolutionSelect, items, restore);

  let desiredSelection = currentSelection;
  if (restore) {
    if (savedResolutionIsCropped && croppedVal) {
      desiredSelection = croppedVal;
    } else if (savedResolutionValue) {
      desiredSelection = savedResolutionValue;
    }
  } else if (wasCroppedSelected && croppedVal) {
    desiredSelection = croppedVal;
  } else if (!desiredSelection && savedResolutionValue) {
    desiredSelection = savedResolutionValue;
  }

  const exists = items.some(i => i.value === desiredSelection);
  if (exists) {
    resolutionSelect.dataset.value = desiredSelection;
    const trigger = resolutionSelect.querySelector(".custom-select-trigger");
    if (trigger) {
      const t = items.find(i => i.value === desiredSelection)?.text ?? desiredSelection;
      trigger.textContent = t;
    }
    highlighSelectedOption(resolutionSelect, desiredSelection);
    if (typeof selectedResolutionOptions === "function") selectedResolutionOptions(desiredSelection);
  } else {
    setCustomSelectValue(resolutionSelect, originalVal);
    const trigger = resolutionSelect.querySelector(".custom-select-trigger");
    if (trigger) trigger.textContent = 'Original (' + originalVal + ')' || "None";
    if (typeof selectedResolutionOptions === "function") selectedResolutionOptions(originalVal);
  }

  populateQualityOptions(selectedFormat);

  if (!isRestoringSettings && typeof saveSettings === 'function') {
    saveSettings();
  }
}

function selectedResolutionOptions() {
  const selectEl = __getSelectByKey("resolution");

  if (!selectEl) {
    APP_STATE.resolutionSelect = undefined;
    APP_STATE.resolutionSelectIsCropped = false;
    saveSettings();
    return;
  }

  const rawVal = selectEl.dataset.value || "";

  if (!rawVal.includes("x")) {
    APP_STATE.resolutionSelect = undefined;
    APP_STATE.resolutionSelectIsCropped = false;
    saveSettings();
    return;
  }

  const [w, h] = rawVal.split("x").map(n => Number(n.trim()));

  if (isNaN(w) || isNaN(h)) {
    APP_STATE.resolutionSelect = undefined;
    APP_STATE.resolutionSelectIsCropped = false;
    saveSettings();
    return;
  }

  const optionEl = selectEl.querySelector(`.custom-option[data-value="${rawVal}"]`);
  APP_STATE.resolutionSelectIsCropped = Boolean(optionEl && optionEl.classList.contains("cropped-item"));
  APP_STATE.resolutionSelect = { width: w, height: h };
  saveSettings();
}

function selectedFpsOptions() {
  const selectEl = __getSelectByKey("fps");
  if (!selectEl) return;

  const value = selectEl.dataset.value || "";

  APP_STATE.fpsSelect = value;
  saveSettings();
}

function selectedQualityOptions() {
  const selectEl = __getSelectByKey("quality");
  if (!selectEl) return;

  const value = selectEl.dataset.value || "";

  APP_STATE.qualitySelect = value;
  saveSettings();
}

function checkDisable() {
  const targetSize = __getSelectByKey("target-size");
  let targetSizeValue = null;
  if(targetSize) {
    targetSizeValue = targetSize.dataset.value || null;
  }
  if(!targetSizeValue) {
    hideDisableOverlay();
  }
  else {
    showDisableOverlay();
  }
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
    convertBtn = document.querySelector('.desktop-footer-btn-convert') || 
                 document.querySelector('.footer-btn-convert') ||
                 document.querySelector('.convert-button');
  }
  
  if (!convertBtn) {
    console.warn('Convert button not found');
    return;
  }
  
  const hasVideo = APP_STATE.selectedFileInfo;
  const formatSelect = __getSelectByKey("format");

  convertBtn.disabled = !hasVideo || !formatSelect || !formatSelect.dataset.value;
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
    resolutionSelectIsCropped: APP_STATE.resolutionSelectIsCropped,
    qualitySelect: APP_STATE.qualitySelect,
    fpsSelect: APP_STATE.fpsSelect,
    volumeSelect: APP_STATE.volumeSelect,
    configConvertVideo: APP_STATE.configConvertVideo
  };
  localStorage.setItem('convert_settings', JSON.stringify(settings));
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

  initCustomSelects();

  // window.addEventListener('resize', function () {
  //   renderTargetSize();
  //   populateFormatOptions();
  //   updateResolutionOptions();
  //   populateQualityOptions();
  //   populateFPSOptions();
  //   populateVolumeOptions();
  // });

  window.addEventListener('load', function () {
    renderTargetSize();
    populateFormatOptions(true);
    updateResolutionOptions(true);
    populateQualityOptions();
    populateFPSOptions(true);
    populateVolumeOptions(true);
  });
});

function initCustomSelects() {
  // init only once
  if (window.__customSelectsInitialized) return;
  window.__customSelectsInitialized = true;

  document.querySelectorAll(".custom-select").forEach(select => {
    const trigger = select.querySelector(".custom-select-trigger");
    const optionsBox = select.querySelector(".custom-options");
    const globalOverlay = document.getElementById("mobileBottomsheetOverlay");
    const overlay =
      document.querySelector(`#overlay${select.id.charAt(0).toUpperCase() + select.id.slice(1)}`) ||
      globalOverlay;

    if (!trigger || !optionsBox) return;

    if (overlay === globalOverlay && overlay && !overlay.dataset.closeSetup) {
      overlay.addEventListener("click", () => {
        closeAllCustomSelects();
        document.body.classList.remove("mobile-sheet-open");
        document.body.classList.remove("desktop-select-open");
      });
      overlay.dataset.closeSetup = "true";
    }

    // mở/đóng khi click trigger
    select.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = select.classList.contains("open");
      const anotherOpen = document.body.classList.contains("custom-options-open") && !wasOpen;
      closeAllCustomSelects();
      if (anotherOpen) return;

      const isOpen = !wasOpen;
      if (isOpen) select.classList.add("open");
      else select.classList.remove("open");
      toggleOptionsDisplay(optionsBox, isOpen);
      
      // Hiển thị overlay nếu mở
      if (isOpen) {
        if (window.innerWidth <= 768) {
          // Mobile: luôn hiển thị overlay và lock scroll
          lockMobileScroll();
          if (globalOverlay) {
            // Đảm bảo overlay luôn cover toàn bộ viewport bất kể scroll position
            globalOverlay.style.position = "fixed";
            globalOverlay.style.top = "0";
            globalOverlay.style.left = "0";
            globalOverlay.style.right = "0";
            globalOverlay.style.bottom = "0";
            globalOverlay.style.width = "100vw";
            globalOverlay.style.height = "100vh";
            globalOverlay.style.display = "block";
            globalOverlay.classList.add("open");
          }
          if (overlay && overlay !== globalOverlay) {
            overlay.style.position = "fixed";
            overlay.style.top = "0";
            overlay.style.left = "0";
            overlay.style.right = "0";
            overlay.style.bottom = "0";
            overlay.style.width = "100vw";
            overlay.style.height = "100vh";
            overlay.style.display = "block";
            overlay.classList.add("open");
          }
        } else {
          // Desktop: hiển thị overlay nếu có
          if (overlay) {
            overlay.classList.add("open");
          }
        }
      } else {
        // Đóng overlay và unlock scroll
        if (window.innerWidth <= 768) {
          unlockMobileScroll();
        }
        if (overlay) {
          overlay.classList.remove("open");
        }
        if (globalOverlay && globalOverlay !== overlay) {
          globalOverlay.style.display = "none";
          globalOverlay.classList.remove("open");
        }
      }
      
      if (window.innerWidth <= 768) { // Mobile: thêm class cho body để sync CSS
        document.body.classList.toggle("mobile-sheet-open", isOpen);
      } else {
        document.body.classList.toggle("desktop-select-open", isOpen);
      }
      document.body.classList.toggle("custom-options-open", isOpen);
    });

    select.addEventListener("touchstart", (e) => {
      e.stopPropagation();
    }, { passive: true });

    optionsBox.addEventListener("click", (e) => {
      e.stopPropagation();

      const opt = e.target.closest(".custom-option");
      if (!opt || opt.classList.contains("disabled")) return;

    const value = opt.dataset.value ?? "";
    const text = opt.textContent.trim();

    // Set dataset value TRƯỚC để đảm bảo các logic khác đọc đúng giá trị
    select.dataset.value = value;
    
    // Đảm bảo cập nhật trigger text chắc chắn - set ngay và giữ nguyên
    const trigger = select.querySelector(".custom-select-trigger");
    if (trigger) {
      trigger.textContent = text;
      // Lưu vào dataset để có thể restore sau nếu bị override
      trigger.dataset.lastSelectedText = text;
    }

      optionsBox.querySelectorAll(".custom-option")
                .forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");

    // Đóng select và overlay - đảm bảo đóng hoàn toàn
    select.classList.remove("open");
    toggleOptionsDisplay(optionsBox, false);
    
    // Đóng overlay (cả global và local) và unlock scroll
    const globalOverlay = document.getElementById("mobileBottomsheetOverlay");
    if (window.innerWidth <= 768) {
      unlockMobileScroll();
    }
    if (overlay) {
      overlay.style.display = "none";
      overlay.classList.remove("open");
    }
    if (globalOverlay && globalOverlay !== overlay) {
      globalOverlay.style.display = "none";
      globalOverlay.classList.remove("open");
    }

    if (window.innerWidth <= 768) {
      document.body.classList.remove("mobile-sheet-open");
    } else {
      document.body.classList.remove("desktop-select-open");
    }

      document.body.classList.remove("custom-options-open");
      toggleOptionsDisplay(optionsBox, false);

      const key = select.dataset.key;

      switch (key) {
        case "format":
          if (typeof updateResolutionOptions === "function") {
            updateResolutionOptions(false);
            checkDisable();
          }
          break;

        case "target-size":
          if (typeof showCustomInput === "function") {
            showCustomInput(value, select);
          }
          break;

        case "resolution":
          // Lưu text vào trigger dataset để có thể restore nếu bị override
          const savedTriggerText = trigger?.dataset.lastSelectedText || text;
          if (typeof selectedResolutionOptions === "function") {
            selectedResolutionOptions(value);
          }
          // Đảm bảo trigger text vẫn đúng sau callback - restore từ dataset nếu bị override
          setTimeout(() => {
            const triggerAfter = select.querySelector(".custom-select-trigger");
            if (triggerAfter) {
              const shouldBeText = triggerAfter.dataset.lastSelectedText || savedTriggerText;
              if (triggerAfter.textContent !== shouldBeText) {
                triggerAfter.textContent = shouldBeText;
              }
            }
          }, 0);
          setTimeout(() => {
            const triggerAfter2 = select.querySelector(".custom-select-trigger");
            if (triggerAfter2) {
              const shouldBeText2 = triggerAfter2.dataset.lastSelectedText || savedTriggerText;
              if (triggerAfter2.textContent !== shouldBeText2) {
                triggerAfter2.textContent = shouldBeText2;
              }
            }
          }, 50);
          break;

        case "quality":
          if (typeof selectedQualityOptions === "function") {
            selectedQualityOptions(value);
          }
          break;

        case "fps":
          if (typeof selectedFpsOptions === "function") {
            selectedFpsOptions(value);
          }
          break;

        case "volume":
          if (typeof updateVolume === "function") {
            updateVolume(value);
          }
          break;

        default:
          break;
      }

      // gọi callback generic nếu set bằng attribute data-onchange="globalFnName"
      const cbName = select.dataset.onchange;
      if (cbName && typeof window[cbName] === "function") {
        window[cbName](value);
      }
    });
  });

  // Track touch movement để phân biệt tap và scroll
  let touchStartX = null;
  let touchStartY = null;
  let touchMoved = false;
  let touchStartInsideSelect = false;
  const TOUCH_MOVE_THRESHOLD = 10; // 10px threshold để phân biệt tap và scroll

  document.addEventListener("touchstart", (e) => {
    if (document.body.classList.contains("custom-options-open")) {
      const isInsideSelect = e.target.closest(".custom-select") || e.target.closest(".custom-options");
      touchStartInsideSelect = !!isInsideSelect;
      
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchMoved = false;
    }
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (document.body.classList.contains("custom-options-open") && touchStartX !== null && touchStartY !== null) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);
      
      // Nếu di chuyển quá threshold, coi như đang scroll
      if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
        touchMoved = true;
      }
    }
  }, { passive: true });

  // đóng khi click ngoài
  document.addEventListener("click", (e) => {
    const isInsideSelect = e.target.closest(".custom-select") || e.target.closest(".custom-options");
    if (isInsideSelect) return;
    if (document.body.classList.contains("custom-options-open")) {
      e.preventDefault();
      e.stopPropagation();
      closeAllCustomSelects();
      return;
    }
  });
  
  document.addEventListener("touchend", (e) => {
    const isInsideSelect = e.target.closest(".custom-select") || e.target.closest(".custom-options");
    
    if (document.body.classList.contains("custom-options-open")) {
      // Không đóng nếu:
      // 1. Touch bắt đầu hoặc kết thúc trong select
      // 2. Đã có movement (scroll)
      if (isInsideSelect || touchStartInsideSelect || touchMoved) {
        // Reset và không đóng
        touchStartX = null;
        touchStartY = null;
        touchMoved = false;
        touchStartInsideSelect = false;
        return;
      }
      
      // Chỉ đóng nếu tap bên ngoài (không có movement, không bắt đầu trong select)
      if (!touchMoved && touchStartX !== null && touchStartY !== null) {
        e.preventDefault();
        e.stopPropagation();
        closeAllCustomSelects();
      }
      
      // Reset sau khi xử lý
      touchStartX = null;
      touchStartY = null;
      touchMoved = false;
      touchStartInsideSelect = false;
      return;
    }
    
    // Reset nếu không có custom-options-open
    touchStartX = null;
    touchStartY = null;
    touchMoved = false;
    touchStartInsideSelect = false;
  }, { passive: false });

  document.addEventListener("wheel", preventScrollWhenSelectOpen, { passive: false });
  document.addEventListener("touchmove", preventScrollWhenSelectOpen, { passive: false });

  // Hàm đóng tất cả
  function closeAllCustomSelects() {
    document.querySelectorAll(".custom-select").forEach(select => {
      select.classList.remove("open");
      const optionsBox = select.querySelector(".custom-options");
      if (optionsBox) {
        toggleOptionsDisplay(optionsBox, false);
      }
      const overlay =
        document.querySelector(`#overlay${select.id.charAt(0).toUpperCase() + select.id.slice(1)}`) ||
        select.nextElementSibling ||
        document.getElementById("mobileBottomsheetOverlay");
      if (overlay) {
        overlay.classList.remove("open");
        overlay.style.display = "none";
      }
    });
    // Đảm bảo global overlay cũng được đóng và unlock scroll
    const globalOverlay = document.getElementById("mobileBottomsheetOverlay");
    if (window.innerWidth <= 768) {
      unlockMobileScroll();
    }
    if (globalOverlay) {
      globalOverlay.style.display = "none";
      globalOverlay.classList.remove("open");
    }
    document.body.classList.remove("mobile-sheet-open");
    document.body.classList.remove("desktop-select-open");
    document.body.classList.remove("custom-options-open");
      checkDisable();
  }
}

function highlighSelectedOption(select, value) {
  const optionsBox = select.querySelector(".custom-options");
  if (optionsBox) {
    optionsBox.querySelectorAll(".custom-option").forEach(o => {
      o.classList.remove("selected");
      if (o.dataset.value === value) {
        o.classList.add("selected");
      }
    });
  }
}

function closeAllCustomSelects() {
  document.querySelectorAll(".custom-select").forEach(select => {
    select.classList.remove("open");
    const optionsBox = select.querySelector(".custom-options");
    if (optionsBox) {
      toggleOptionsDisplay(optionsBox, false);
    }
    const overlay =
      document.querySelector(`#overlay${select.id.charAt(0).toUpperCase() + select.id.slice(1)}`) ||
      select.nextElementSibling ||
      document.getElementById("mobileBottomsheetOverlay");
    if (overlay) {
      overlay.classList.remove("open");
      overlay.style.display = "none";
    }
  });
  // Đảm bảo global overlay cũng được đóng và unlock scroll
  const globalOverlay = document.getElementById("mobileBottomsheetOverlay");
  if (window.innerWidth <= 768) {
    unlockMobileScroll();
  }
  if (globalOverlay) {
    globalOverlay.style.display = "none";
    globalOverlay.classList.remove("open");
  }
  document.body.classList.remove("desktop-select-open");
  document.body.classList.remove("mobile-sheet-open");
  document.body.classList.remove("custom-options-open");
}

function preventScrollWhenSelectOpen(evt) {
  if (!document.body.classList.contains("custom-options-open")) return;

  // ✅ Desktop: Không chặn scroll, cho phép scroll bình thường
  if (window.innerWidth > 768) {
    return; // Không làm gì cả trên desktop
  }

  // ✅ Mobile: Giữ nguyên logic cũ
  // Cho phép scroll trong .custom-options, nhưng chặn lan ra ngoài
  const scrollable = evt.target.closest(".custom-options");
  if (scrollable) {
    // Đặc biệt xử lý cho resolutionSelectDesktop: khi scroll tới cuối, cho phép scroll lan ra background
    const resolutionSelectDesktop = document.getElementById("resolutionSelectDesktop");
    if (resolutionSelectDesktop && scrollable === resolutionSelectDesktop.querySelector(".custom-options")) {
      // Chỉ xử lý cho wheel event (desktop), touchmove đã được xử lý bởi lockMobileScroll trên mobile
      if (evt.type === 'wheel') {
        const optionsBox = scrollable;
        const scrollTop = optionsBox.scrollTop;
        const scrollHeight = optionsBox.scrollHeight;
        const clientHeight = optionsBox.clientHeight;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px threshold
        const isAtTop = scrollTop <= 5; // 5px threshold
        const deltaY = evt.deltaY;
        
        // Nếu đã scroll tới cuối và đang scroll xuống (deltaY > 0), cho phép scroll lan ra background
        if (isAtBottom && deltaY > 0) {
          // Không preventDefault và stopPropagation để cho phép scroll background
          return;
        }
        
        // Nếu đã scroll tới đầu và đang scroll lên (deltaY < 0), cũng cho phép scroll lan ra background
        if (isAtTop && deltaY < 0) {
          // Không preventDefault và stopPropagation để cho phép scroll background
          return;
        }
      }
      
      // Nếu chưa tới cuối hoặc đang scroll lên, chặn lan ra background
      evt.stopPropagation();
      return;
    }
    
    // Với các custom-options khác, chỉ stopPropagation để không ảnh hưởng background
    evt.stopPropagation();
    return;
  }

  // Nếu không phải trong .custom-options, chặn hoàn toàn (đặc biệt trên mobile)
  // Trên mobile, body đã có overflow: hidden và touch-action: none từ CSS
  // Nhưng vẫn cần preventDefault để chắc chắn
  evt.preventDefault();
  evt.stopPropagation();
}

// khởi tạo ngay nếu DOM đã load, hoặc khi bạn load script đặt sau body
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCustomSelects);
} else {
  initCustomSelects();
}

function fillCustomSelect(elOrId, items, restore = false, isInit = false) {
  const isMobile = window.innerWidth <= 768;

  const root = typeof elOrId === "string"
      ? document.getElementById(elOrId) || document.querySelector(`.custom-select[data-key="${elOrId}"]`)
      : elOrId;

  if (!root) return;

  const optionsEl = root.querySelector(".custom-options");
  const trigger = root.querySelector(".custom-select-trigger");
  if (!optionsEl || !trigger) return;

  const formatSelect = __getSelectByKey("format");
  const resolutionSelect = __getSelectByKey("resolution");

  if (isMobile) {

    optionsEl.innerHTML = "";

    // HEADER
    const header = document.createElement("div");
    header.className = "custom-options-header";
    header.textContent = "Select Resolution";
    optionsEl.appendChild(header);

    // WRAPPER
    const list = document.createElement("div");
    list.className = "custom-options-list";
    optionsEl.appendChild(list);

    // Nếu KHÔNG có data → chỉ gen đúng 1 option None vào TOP
    if (!APP_STATE.selectedFile || isInit) {
      const topContainer = document.createElement("div");
      topContainer.className = "custom-options-container";
      list.appendChild(topContainer);

      const none = document.createElement("div");
      none.className = "custom-option";
      none.dataset.value = "";
      none.textContent = "None";
      topContainer.appendChild(none);

      root.dataset.value = "";
      trigger.textContent = "None";
      return;
    }

    // TOP CONTAINER
    const topContainer = document.createElement("div");
    topContainer.className = "custom-options-container-top";
    list.appendChild(topContainer);

    // =============================================================
    // MOBILE ĐỦ DỮ LIỆU (FULL)
    // =============================================================

    // Bỏ landscape/portrait nếu items đến từ resolution
    items = items.filter(i => {
      const t = (i.text || "").toLowerCase();
      return !(t === "landscape" || t === "portrait");
    });

    // GROUP WRAPPER
    const groupsWrapper = document.createElement("div");
    groupsWrapper.className = "custom-groups-wrapper";
    list.appendChild(groupsWrapper);

    // TAB LABEL
    // Xác định orientation file input
    const { width: cw, height: ch } = APP_STATE.selectedFileInfo || {};
    const isPortraitInput = cw && ch && cw < ch;

    // TAB WRAPPER
    const groupsHeader = document.createElement("div");
    groupsHeader.className = "custom-options-groups-header";

    // GROUP LIST WRAPPER
    const groupsContainer = document.createElement("div");
    groupsContainer.className = "custom-options-groups";
    groupsWrapper.appendChild(groupsHeader);
    groupsWrapper.appendChild(groupsContainer);

    // Tạo nhóm
    const landscapeGroup = document.createElement("div");
    landscapeGroup.className = "custom-options-group";
    landscapeGroup.dataset.group = "landscape";

    const portraitGroup = document.createElement("div");
    portraitGroup.className = "custom-options-group";
    portraitGroup.dataset.group = "portrait";

    // Nếu video là PORTRAIT → Portrait đứng trước
    if (isPortraitInput) {
      groupsHeader.innerHTML = `
        <div class="group-tab active" data-group="portrait">Portrait</div>
        <div class="group-tab" data-group="landscape">Landscape</div>
      `;

      portraitGroup.classList.add("active");
      groupsContainer.appendChild(portraitGroup);
      groupsContainer.appendChild(landscapeGroup);

    } else {
      // Video LANDSCAPE → Landscape đứng trước
      groupsHeader.innerHTML = `
        <div class="group-tab active" data-group="landscape">Landscape</div>
        <div class="group-tab" data-group="portrait">Portrait</div>
      `;

      landscapeGroup.classList.add("active");
      groupsContainer.appendChild(landscapeGroup);
      groupsContainer.appendChild(portraitGroup);
    }


    // ADD ITEMS
    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "custom-option";
      if (item.disabled) div.classList.add("disabled");
      if (item.className) div.classList.add(item.className);

      div.dataset.value = item.value ?? "";
      div.textContent = item.text ?? item.value ?? "";

      const txt = (item.text || "").toLowerCase();

      // ORIGINAL + CROPPED
      if (txt.includes("original") || txt.includes("cropped")) {
        topContainer.appendChild(div);
        return;
      }

      // AUTO group
      let group = item.group;
      if (!group) {
        const m = item.value.match(/(\d+)x(\d+)/);
        if (m) {
          const w = Number(m[1]);
          const h = Number(m[2]);
          group = w >= h ? "landscape" : "portrait";
        } else group = "landscape";
      }

      if (group === "portrait") portraitGroup.appendChild(div);
      else landscapeGroup.appendChild(div);
    });

    // Tab switching
    groupsHeader.querySelectorAll(".group-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        groupsHeader.querySelectorAll(".group-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        const g = tab.dataset.group;
        groupsContainer.querySelectorAll(".custom-options-group").forEach(gr => {
          gr.classList.toggle("active", gr.dataset.group === g);
        });
      });
    });

    // Default - chỉ set nếu chưa có giá trị được chọn hoặc đang restore
    if(!restore) {
      const saved = root.dataset.value ?? "";
      const toShow = items.find(i => i.value === saved) || items[0] || { text: "None", value: "" };
      
      // Chỉ auto-select Cropped nếu chưa có giá trị nào được chọn (saved rỗng)
      // và user chưa chọn option nào (không có lastSelectedText)
      const trigger = resolutionSelect?.querySelector(".custom-select-trigger");
      const hasUserSelection = trigger?.dataset.lastSelectedText;
      
      if (!saved && !hasUserSelection) {
        // Chưa có selection, có thể auto-select Cropped nếu có
        const cropItem = items.find(e => e.text.includes("Cropped"));
        if(cropItem) {
          root.dataset.value = cropItem.value;
          if (trigger) {
            trigger.textContent = cropItem.text;
            trigger.dataset.lastSelectedText = cropItem.text;
          }
          setCustomSelectValue(resolutionSelect, cropItem.value);
        } else {
          let videoDimensions = getCurrentVideoDimensions();
          if (!videoDimensions && window.originalVideoSize) {
            videoDimensions = { ...window.originalVideoSize };
          }
          const originalVal = videoDimensions ? `${videoDimensions.width}x${videoDimensions.height}` : "";
          root.dataset.value = originalVal;
          if (trigger) {
            trigger.textContent = videoDimensions ? `Original (${originalVal})` : "Original";
          }
          setCustomSelectValue(resolutionSelect, originalVal);
        }
      } else {
        // Đã có selection, giữ nguyên
        root.dataset.value = toShow.value;
        if (trigger) {
          trigger.textContent = toShow.text;
        }
      }
    }
    return;
  }

  /* ===============================================================
     🔥 DESKTOP VERSION
     =============================================================== */
  optionsEl.innerHTML = "";
  // Tạo group tạm
  const originalGroup = [];   // Original, Cropped (không có label)
  const landscapeGroup = [];
  const portraitGroup = [];

  items.forEach(item => {
    const txt = (item.text || "").toLowerCase();

    // ORIGINAL + CROPPED → Cho lên đầu, không label
    if (txt.includes("original") || txt.includes("cropped")) {
      originalGroup.push(item);
      return;
    }

    // AUTO detect group nếu không có item.group
    let group = item.group;
    if (!group) {
      const m = item.value.match(/(\d+)x(\d+)/);
      if (m) {
        const w = Number(m[1]);
        const h = Number(m[2]);
        group = w >= h ? "landscape" : "portrait";
      } else group = "landscape";
    }

    if (group === "portrait") portraitGroup.push(item);
    else landscapeGroup.push(item);
  });

  // Helper: add label
  function addLabel(text) {
    const lbl = document.createElement("div");
    lbl.className = "custom-option option-label disabled";
    lbl.textContent = text;
    optionsEl.appendChild(lbl);
  }

  // Helper: add actual options
  function addGroup(list) {
    list.forEach(item => {
      const div = document.createElement("div");
      div.className = "custom-option";
      if (item.disabled) div.classList.add("disabled");
      if (item.className) div.classList.add(item.className);

      div.dataset.value = item.value ?? "";
      div.textContent = item.text ?? item.value ?? "";
      optionsEl.appendChild(div);
    });
  }

  // 1) ORIGINAL + CROPPED
  addGroup(originalGroup);

  // ==============================
  // 2) ORDER GROUP BY VIDEO ORIENTATION
  // ==============================

  const { width: cw, height: ch } = APP_STATE.selectedFileInfo || {};
  const isPortraitInput = cw && ch && cw < ch;

  if (isPortraitInput) {
    // VIDEO PORTRAIT → Portrait trước
    if (portraitGroup.length > 0) {
      addLabel("Portrait");
      addGroup(portraitGroup);
    }
    if (landscapeGroup.length > 0) {
      addLabel("Landscape");
      addGroup(landscapeGroup);
    }
  } else {
    // VIDEO LANDSCAPE → Landscape trước
    if (landscapeGroup.length > 0) {
      addLabel("Landscape");
      addGroup(landscapeGroup);
    }
    if (portraitGroup.length > 0) {
      addLabel("Portrait");
      addGroup(portraitGroup);
    }
  }

  const saved = root.dataset.value ?? "";
  const toShow = items.find(i => i.value === saved) || items[0] || { text: "None", value: "" };
  root.dataset.value = toShow.value;
  
  // Respect lastSelectedText nếu có (user đã chọn option)
  // Điều này tránh override trigger text khi user đã chọn một option
  if (trigger.dataset.lastSelectedText) {
    // User đã chọn option, giữ nguyên text đó
    trigger.textContent = trigger.dataset.lastSelectedText;
    // Đảm bảo highlight option đúng với giá trị đã chọn
    const selectedValue = root.dataset.value;
    highlighSelectedOption(resolutionSelect, selectedValue || "");
  } else {
    // Chưa có user selection, dùng giá trị từ toShow
    trigger.textContent = toShow.text || toShow.value || "None";
    highlighSelectedOption(resolutionSelect, saved || "");
  }
}

function setCustomSelectValue(selectEl, value) {
  if (!selectEl) return;

  const opt = selectEl.querySelector(`.custom-option[data-value="${value}"]`);
  if (!opt) return;

  selectEl.dataset.value = value;

  const trigger = selectEl.querySelector('.custom-select-trigger');
  if (trigger) trigger.textContent = opt.textContent;

  highlighSelectedOption(selectEl, value);

  if (selectEl.dataset?.key === "resolution" && typeof selectedResolutionOptions === "function") {
    selectedResolutionOptions();
  }
}

if (typeof TARGET_SIZE_ITEMS === "undefined") {
  window.TARGET_SIZE_ITEMS = [
    { value: "", text: "None" },
    { value: "custom", text: "Custom" },
    { value: "1", text: "1MB" },
    { value: "2", text: "2MB" },
    { value: "5", text: "5MB" },
    { value: "8", text: "8MB" },
    { value: "10", text: "10MB" },
    { value: "15", text: "15MB" },
    { value: "20", text: "20MB" },
    { value: "50", text: "50MB" },
    { value: "100", text: "100MB" },
    { value: "200", text: "200MB" },
    { value: "500", text: "500MB" },
    { value: "800", text: "800MB" },
    { value: "1000", text: "1GB" }
  ];
}

function renderTargetSize() {
  const root = document.querySelector('.custom-select[data-key="target-size"]');
  if (!root) return;

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    renderMobileSelect(root, TARGET_SIZE_ITEMS);
  } else {
    renderDesktopSelect(root, TARGET_SIZE_ITEMS);
  }
  const taregrSizeSelect = __getSelectByKey("target-size");
  highlighSelectedOption(taregrSizeSelect, taregrSizeSelect.dataset.value || "");
}

function renderMobileSelect(root, items) {
  const options = root.querySelector(".custom-options");
  options.innerHTML = "";

  // Header
  const header = document.createElement("div");
  header.className = "custom-options-header";
  header.textContent = "Select Target Size";
  options.appendChild(header);

  // list wrapper
  const list = document.createElement("div");
  list.className = "custom-options-list";
  options.appendChild(list);

  // Top items
  const top = document.createElement("div");
  top.className = "custom-options-container-top";
  list.appendChild(top);

  // Bottom group
  const container = document.createElement("div");
  container.className = "custom-options-container";
  list.appendChild(container);

  items.forEach(i => {
    const div = document.createElement("div");
    div.className = "custom-option";
    div.dataset.value = i.value;
    div.textContent = i.text;

    if (i.value === "" || i.value === "custom" || i.value === undefined || i.value === null) {
      top.appendChild(div);
    } else {
      container.appendChild(div);
    }
  });
}

function renderDesktopSelect(root, items) {
  const options = root.querySelector(".custom-options");
  options.innerHTML = "";

  items.forEach(i => {
    const div = document.createElement("div");
    div.className = "custom-option";
    div.dataset.value = i.value;
    div.textContent = i.text;
    options.appendChild(div);
  });
}




