const APP_STATE = {
  modalTrimCrop: null,
  selectedFileInfo: null,
  selectedFile: null,
  urlVideo: null,
  configConvertVideo: null,
  ratioOfWeb: 1,
  formatSelect: null,
  targetSize: null,
  resolutionSelect: null,
  volumeSelect: 100,
  fpsSelect: null,
  qualitySelect: null,
  itemInfoFile: null
};

const VIDEO_STATE = {
  trimCropVideo: null,
  videoDuration: 0,
  playPromise: null
};

let inAppPurchased = false

showAside = false;
const isDisplayed = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return false;
  return window.getComputedStyle(el).display !== 'none';
};

function includeHTML(selector, url) {
  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(html => {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Element with selector "${selector}" not found`);
      }
      element.innerHTML = html;
      return html;
    })
    .catch(error => {
      console.error('Error including HTML:', error);
      throw error;
    });
}

document.addEventListener('DOMContentLoaded', () => {
  detectDeviceAndLayout();
  // Apply responsive aspect ratio based on actual viewport height/width (accounts for ads)
  applyAspectRatioByHeight();
  setTimeout(applyAspectRatioByHeight, 500);
  setTimeout(applyAspectRatioByHeight, 1500);
  APP_STATE.modalTrimCrop = document.querySelector('.mtcv-container');
  // blockDoubleTapZoom();
});
window.addEventListener('resize', () => {
  detectDeviceAndLayout();
  applyAspectRatioByHeight();
});

// Dynamically apply aspect ratio classes based on actual viewport height/width
function applyAspectRatioByHeight() {
  const browserHeight = window.innerHeight;
  const browserWidth = window.innerWidth;
  const appContainer = document.querySelector('.app--container');
  if (!appContainer) return;

  appContainer.classList.remove(
    'aspect-320-600',
    'aspect-375-667',
    'aspect-360-740',
    'aspect-384-721',
    'aspect-750-780',
    'aspect-700-750'
  );

  if (browserWidth === 320 && browserHeight >= 590 && browserHeight <= 610) {
    appContainer.classList.add('aspect-320-600');
  } else if (browserWidth === 375 && browserHeight >= 657 && browserHeight <= 677) {
    appContainer.classList.add('aspect-375-667');
  } else if (browserWidth === 360 && browserHeight >= 730 && browserHeight <= 750) {
    appContainer.classList.add('aspect-360-740');
  } else if (browserWidth === 384 && browserHeight >= 711 && browserHeight <= 731) {
    appContainer.classList.add('aspect-384-721');
  } else if (browserHeight >= 750 && browserHeight <= 780) {
    appContainer.classList.add('aspect-750-780');
  } else if (browserHeight >= 700 && browserHeight <= 740) {
    appContainer.classList.add('aspect-700-750');
  } else if (browserHeight >= 741 && browserHeight <= 760) {
    appContainer.classList.add('aspect-741-760');
  }
}

function getFontSizeBody() {
  const style = getComputedStyle(document.body);
  const fontSize = parseFloat(style.fontSize);
  return fontSize;
}

function createVideoOptions(options = {}) {
  return {
    input_url: options.input_url,
    format_name: options.format_name,
    trim: options.trim ?? undefined,
    crop: options.crop ?? undefined,
    hflip: options.hflip ?? undefined,
    vflip: options.vflip ?? undefined,
    volume_level: options.volume_level ?? undefined,
    fps: options.fps ?? undefined,
    quality: options.quality ?? undefined,
    target_size: options.target_size ?? undefined,
    resolution: options.resolution ?? undefined,
    audioBitrate: options.audioBitrate ?? '128k'
  };
}

function timeStringToSeconds(timeStr) {
  if (!timeStr) return 0;

  const parts = timeStr.split(':').map(Number);
  let seconds = 0;

  switch (parts.length) {
    case 1: { // ss
      const [s] = parts;
      seconds = s;
      break;
    }
    case 2: { // mm:ss
      const [m, s] = parts;
      seconds = m * 60 + s;
      break;
    }
    case 3: { // hh:mm:ss
      const [h, m, s] = parts;
      seconds = h * 3600 + m * 60 + s;
      break;
    }
    default:
      return 0;
  }

  return seconds;
}


function detectDeviceAndLayout() {
  const browserWidth = window.innerWidth;
  const browserHeight = window.innerHeight;
  let baseFontSize = 18;
  let showAside = false;

  const root = document.documentElement;
  const appUI = isDisplayed('.app--container');
  const desktopUI = isDisplayed('.desktop-app-container');

  if (!appUI && !desktopUI) {
    return;
  }

  if (appUI) {
    return;
  }

  if (desktopUI) {
    return;
  }
}
function detectDeviceBySize() {
  const width = window.innerWidth;

  let device = "DESKTOP";

  if (width <= 767) {
    device = "MOBILE";
  } 
  else if (width <= 1023) {
    device = "TABLET";
  } 
  else {
    device = "DESKTOP";
  }

  return device;
}


function toggleMobileMenu() {
  const modal = document.getElementById('mobileMenuModal');
  const hamburger = document.querySelector('.menu-toggle__icon');

  if (modal) {
    if (modal.classList.contains('active')) {
      modal.classList.add('closing');
      
      setTimeout(() => {
        modal.classList.remove('active', 'closing');
        document.body.style.overflow = '';
      }, 300);
    } else {
      modal.classList.remove('closing');
      
      void modal.offsetWidth;
      
      requestAnimationFrame(() => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }
  }
  
  if (hamburger) {
    hamburger.classList.toggle('active');
  }
}

function buyPremium() {
  const overlay = document.getElementById('premiumOverlay');
  if(!overlay) return;

  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hiedden';
}

function closePremiumOverlay() {
  const overlay = document.getElementById('premiumOverlay');
  if (!overlay) return;

  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');

  document.body.style.overflow = ''; // bỏ typo “hiedden” luôn

  if (typeof window.restoreScrollForDialog === 'function') {
    window.restoreScrollForDialog();
  }
}

function openAboutOverlay() {
  const overlay = document.getElementById('aboutOverlay');
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.offsetHeight;
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  }
}

function closeAboutOverlay() {
  const overlay = document.getElementById('aboutOverlay');
  if (overlay) {
    overlay.classList.add('is-closing');
    overlay.classList.remove('is-open');
    setTimeout(() => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.transition = 'none';
      overlay.classList.remove('is-closing'); 
      overlay.offsetHeight;
      overlay.style.transition = '';
      document.body.style.overflow = '';
    }, 350);
  }
}

function closeMobileMenu() {
  const modal = document.getElementById('mobileMenuModal');
  const hamburger = document.querySelector('.menu-toggle__icon');

  modal.classList.remove('active');
    hamburger.classList.remove('active');
      document.body.style.overflow = '';
}

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    closeMobileMenu();
  }
});

let isRestoringSettings = false;

function saveSettings() {
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

function restoreSettings() {
  const saved = localStorage.getItem('convert_settings');
  if (!saved) {
    console.log('No saved settings found');
    return;
  }
  
  isRestoringSettings = true;
  
  try {
    const settings = JSON.parse(saved);
    
    if (settings.formatSelect) APP_STATE.formatSelect = settings.formatSelect;
    if (settings.targetSize) APP_STATE.targetSize = settings.targetSize;
    if (settings.resolutionSelect) APP_STATE.resolutionSelect = settings.resolutionSelect;
    if (typeof settings.resolutionSelectIsCropped === "boolean") {
      APP_STATE.resolutionSelectIsCropped = settings.resolutionSelectIsCropped;
    } else {
      APP_STATE.resolutionSelectIsCropped = false;
    }
    if (settings.qualitySelect) APP_STATE.qualitySelect = settings.qualitySelect;
    if (settings.fpsSelect) APP_STATE.fpsSelect = settings.fpsSelect;
    if (settings.volumeSelect) APP_STATE.volumeSelect = settings.volumeSelect;
    if (settings.configConvertVideo) APP_STATE.configConvertVideo = settings.configConvertVideo;
    
    const formatSelect = __getSelectByKey("format");
    if (formatSelect && settings.formatSelect && formatSelect.dataset.value !== settings.formatSelect) {
      setCustomSelectValue(formatSelect, settings.formatSelect);
      setTimeout(() => updateResolutionOptions(), 100, true);
    }
    
    const targetSize = __getSelectByKey("target-size");
    if (targetSize && settings?.targetSize && settings.targetSize !== 'custom' && settings.targetSize !== '' && settings.targetSize !== '0') {
      const targetSizeValue = String(settings.targetSize);

      const isMobile = window.innerWidth <= 768;

      const optionsBox = targetSize.querySelector(
        isMobile
          ? ".custom-options .custom-options-list .custom-options-container"
          : ".custom-options"
      );
      if (!optionsBox) return; // phòng trường hợp DOM khác

      // tìm option hiện có (custom-option)
      let opt = optionsBox.querySelector(`.custom-option[data-value="${targetSizeValue}"]`);

      // nếu chưa có thì tạo mới (dạng div.custom-option)
      if (!opt) {
        opt = document.createElement('div');
        opt.className = 'custom-option';
        opt.dataset.value = targetSizeValue;
        opt.textContent = targetSizeValue + 'MB';
        optionsBox.appendChild(opt);
      }
      
      // set value vào dataset của custom-select và cập nhật trigger text
      targetSize.dataset.value = targetSizeValue;
      const trigger = targetSize.querySelector('.custom-select-trigger');
      if (trigger) trigger.textContent = opt.textContent;

      highlighSelectedOption(targetSize, targetSizeValue || "");
    }

    const fps = __getSelectByKey("fps");
    if (fps && settings?.fpsSelect) {
      setCustomSelectValue(fps, settings.fpsSelect);
    }

    const volume = __getSelectByKey("volume");
    if (volume && settings?.volumeSelect) {
      setCustomSelectValue(volume, settings.volumeSelect + '%');
      updateVolume(settings.volumeSelect + '%');
    }
    
    setTimeout(() => {
      const currentTargetSize = __getSelectByKey("target-size");
      const targetSizeValue = currentTargetSize ? currentTargetSize.dataset.value : settings.targetSize;
      
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
      const currentTargetSize = __getSelectByKey("target-size");
      const qualitySelect = __getSelectByKey("quality");
      const targetSizeValue = currentTargetSize ? currentTargetSize.dataset.value : '';
      
      if (!targetSizeValue || targetSizeValue === '' || targetSizeValue === 'custom') {
        const resolutionSelect = __getSelectByKey("resolution");
        if (resolutionSelect && settings.resolutionSelect) {
          const res = settings.resolutionSelect;
          const resValue = typeof res === 'object' ? `${res.width}x${res.height}` : res;
          if (Array.from(resolutionSelect.querySelectorAll('.custom-option')).some(opt => opt.dataset.value === resValue)) {
            setCustomSelectValue(qualitySelect, settings.qualitySelect);
            selectedResolutionOptions();
          }
        }
      }
    }, 600);
    
    setTimeout(() => {
      const currentTargetSize = __getSelectByKey("target-size");
      const targetSizeValue = settings.targetSize;
      // const targetSizeValue = currentTargetSize ? currentTargetSize.dataset.value : '';
      
      if (!targetSizeValue || targetSizeValue === '' || targetSizeValue === 'custom') {
        const qualitySelect = __getSelectByKey("quality");
        if (qualitySelect && settings.qualitySelect && qualitySelect.dataset.value !== settings.qualitySelect) {
          setCustomSelectValue(qualitySelect, settings.qualitySelect);
          selectedQualityOptions();
        }
      }
    }, 600);
  } catch (e) {
    console.error('Error restoring settings:', e);
  } finally {
    setTimeout(() => {
      isRestoringSettings = false;
    }, 1000);
  }
}

function toggleDesktopMenu() {
  const modal = document.getElementById('desktopMenuModal');
  const hamburger = document.querySelector('.desktop-menu-icon');
  
  if (modal) {
    if (modal.classList.contains('active')) {
      modal.classList.add('closing');
      setTimeout(() => {
        modal.classList.remove('active', 'closing');
        document.body.style.overflow = '';
      }, 400);
    } else {
      modal.classList.remove('closing');
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }
  
  if (hamburger) {
    hamburger.classList.toggle('active');
  }
}

function policyPage() {
  const overlay = document.getElementById('policyOverlay');
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    
    overlay.offsetHeight;
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  }
}

function closePolicyOverlay() {
  const overlay = document.getElementById('policyOverlay');
  if (overlay) {
    overlay.classList.add('is-closing');
    overlay.classList.remove('is-open');
    setTimeout(() => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.transition = 'none';
      overlay.classList.remove('is-closing'); 
      overlay.offsetHeight;
      overlay.style.transition = '';
      document.body.style.overflow = '';
      const scrollBtn = document.getElementById('policyScrollToTop');
      if (scrollBtn) {
        scrollBtn.classList.remove('visible');
      }
    }, 350);
  }
}

function scrollPolicyToTop() {
  const mainElement = document.querySelector('#policyOverlay .dialog-overlay-main');
  if (mainElement) {
    mainElement.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}

(function() {
  const policyOverlay = document.getElementById('policyOverlay');
  const scrollBtn = document.getElementById('policyScrollToTop');
  const mainElement = policyOverlay?.querySelector('.dialog-overlay-main');
  
  if (!policyOverlay || !scrollBtn || !mainElement) return;
  
  function handleScroll() {
    if (!policyOverlay.classList.contains('is-open')) {
      scrollBtn.classList.remove('visible');
      return;
    }
    
    if (mainElement.scrollTop > 300) {
      scrollBtn.classList.add('visible');
    } else {
      scrollBtn.classList.remove('visible');
    }
  }
  
  mainElement.addEventListener('scroll', handleScroll);
  
  const observer = new MutationObserver(() => {
    if (policyOverlay.classList.contains('is-open')) {
      setTimeout(handleScroll, 100);
    } else {
      scrollBtn.classList.remove('visible');
    }
  });
  
  observer.observe(policyOverlay, {
    attributes: true,
    attributeFilter: ['class']
  });
})();

function historyPage() {
  const overlay = document.getElementById('historyOverlay');
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    
    overlay.offsetHeight;
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      onResumeHistoryPage();
    });
  }
}

function closeHistoryOverlay() {
  const overlay = document.getElementById('historyOverlay');
  if (overlay) {
    overlay.classList.add('is-closing');
    overlay.classList.remove('is-open');
    setTimeout(() => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.transition = 'none';
      overlay.classList.remove('is-closing'); 
      overlay.offsetHeight;
      overlay.style.transition = '';
      document.body.style.overflow = '';
    }, 350);
  }
}

function termsPage() {
  const overlay = document.getElementById('termsOverlay');
  if (overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    
    overlay.offsetHeight;
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  }
}

function closeTermsOverlay() {
  const overlay = document.getElementById('termsOverlay');
  if (overlay) {
    overlay.classList.add('is-closing');
    overlay.classList.remove('is-open');
    setTimeout(() => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.transition = 'none';
      overlay.classList.remove('is-closing'); 
      overlay.offsetHeight;
      overlay.style.transition = '';
      document.body.style.overflow = '';
      const scrollBtn = document.getElementById('termsScrollToTop');
      if (scrollBtn) {
        scrollBtn.classList.remove('visible');
      }
    }, 350);
  }
}

function scrollTermsToTop() {
  const mainElement = document.querySelector('#termsOverlay .dialog-overlay-main');
  if (mainElement) {
    mainElement.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}

(function() {
  const termsOverlay = document.getElementById('termsOverlay');
  const scrollBtn = document.getElementById('termsScrollToTop');
  const mainElement = termsOverlay?.querySelector('.dialog-overlay-main');
  
  if (!termsOverlay || !scrollBtn || !mainElement) return;
  
  function handleScroll() {
    if (!termsOverlay.classList.contains('is-open')) {
      scrollBtn.classList.remove('visible');
      return;
    }
    
    if (mainElement.scrollTop > 300) {
      scrollBtn.classList.add('visible');
    } else {
      scrollBtn.classList.remove('visible');
    }
  }
  
  mainElement.addEventListener('scroll', handleScroll);
  
  const observer = new MutationObserver(() => {
    if (termsOverlay.classList.contains('is-open')) {
      setTimeout(handleScroll, 100);
    } else {
      scrollBtn.classList.remove('visible');
    }
  });
  
  observer.observe(termsOverlay, {
    attributes: true,
    attributeFilter: ['class']
  });
})();

function createPreventBodyScrollHandler(dialogSelector, contentSelector) {
  // const dialog = document.querySelector(dialogSelector);
  // if (!dialog) return () => {};
  // const dialogContent = dialog.querySelector(contentSelector);

  // return function(e) {
  //   if (!dialog.isConnected) {
  //     window.removeEventListener('wheel', arguments.callee);
  //     return;
  //   }

  //   if (!dialog.contains(e.target)) {
  //     e.preventDefault();
  //   } else {
  //     const delta = e.deltaY;
  //     const scrollTop = dialogContent.scrollTop;
  //     const scrollHeight = dialogContent.scrollHeight;
  //     const clientHeight = dialogContent.clientHeight;

  //     const scrollingUp = delta < 0;
  //     const scrollingDown = delta > 0;

  //     if ((scrollingUp && scrollTop === 0) ||
  //         (scrollingDown && scrollTop + clientHeight >= scrollHeight)) {
  //       e.preventDefault();
  //     }
  //   }
  // };
}

function disableHtmlScroll() {
  document.documentElement.style.overflow = 'hidden';
}

function enableOverscroll() {
  document.documentElement.style.overflow = 'auto';
}

