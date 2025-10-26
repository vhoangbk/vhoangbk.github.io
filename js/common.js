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
};

const VIDEO_STATE = {
  trimCropVideo: null,
  videoDuration: 0,
  playPromise: null
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
  APP_STATE.modalTrimCrop = document.querySelector('.mtcv-container');
  blockDoubleTapZoom();
});
window.addEventListener('resize', () => {
  detectDeviceAndLayout();
});

function getFontSizeBody() {
  const style = getComputedStyle(document.body);
  const fontSize = parseFloat(style.fontSize);
  return fontSize;
}

function createVideoOptions(options = {}) {
  return {
    blob_url: options.blob_url,
    format_name: options.format_name,
    trim: options.trim ?? undefined,
    crop: options.crop ?? undefined,
    hflip: options.hflip ?? undefined,
    vflip: options.vflip ?? undefined,
    volume_level: options.volume_level ?? undefined,
    fps: options.fps ?? undefined,
    quality: options.quality ?? undefined,
    target_size: options.target_size ?? undefined,
    resolution: options.resolution ?? undefined
  };
}

function detectDeviceAndLayout() {
  const browserWidth = window.innerWidth;
  const browserHeight = window.innerHeight;

  const contentContainer = document.querySelector(".content-container");
  const asideLeft = document.querySelector(".left-banner-container");
  const asideRight = document.querySelector(".right-banner-container");
  const root = document.documentElement;

  const layoutMaxWidth = 460;
  const asideWidth = 130;
  const asideThreshold = layoutMaxWidth + asideWidth * 2;

  const isMobile = browserWidth <= 480;
  const isTablet = browserWidth > 480 && browserWidth <= 768;
  const isDesktop = browserWidth > 768;

  let baseFontSize = 18;

  if (isMobile) {
    document.body.style.overflow = "hidden";

    baseFontSize =
    browserWidth === 412 && browserHeight === 736 ? 14 :
    browserWidth === 411 && browserHeight === 775 ? 18 :
    browserWidth === 320 && browserHeight <= 590 ? 14 :
    browserWidth === 412 && browserHeight <= 780 ? 15 :
      16;
  } else if (isTablet) {
    baseFontSize = 22;
  }
  root.style.fontSize = baseFontSize + "px";

  if (contentContainer) {
    if (browserWidth > layoutMaxWidth) {
      contentContainer.style.width = layoutMaxWidth + "px";
    } else {
      contentContainer.style.width = "100%";
      contentContainer.style.margin = "0";
    }
  }
  const showAside = browserWidth > asideThreshold;
  if (asideLeft) asideLeft.style.display = showAside ? "block" : "none";
  if (asideRight) asideRight.style.display = showAside ? "block" : "none";

  // Log thông tin
  console.log("Browser:", browserWidth + "x" + browserHeight);
  console.log("Font-size:", baseFontSize + "px");
  console.log("Content width:", contentContainer?.style.width);
  console.log("Aside:", showAside ? "Hiện" : "Ẩn");
}
