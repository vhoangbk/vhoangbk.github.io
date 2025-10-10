const APP_STATE = {
  modals: {
    trim: null,
    rotate: null,
    crop: null,
    trimCrop: null,
    about: null
  },
  selectedRotateAngle: 0,
  selectedFileInfo: null,
  selectedFile: null,
  useFileInput: false,
  trimCropSettings: {
    trim: { startTime: 0, endTime: 0 },
    crop: { width: 0, height: 0, x: 0, y: 0, aspectRatio: 'custom' },
    flip: { horizontal: false, vertical: false }
  },
  trimSettings: { startTime: 0, endTime: 0 },
  cropSettings: { width: 640, height: 480, x: 320, y: 120, aspectRatio: 'custom' },
  flipSettings: { vFlip: false, hFlip: false },
  originalVideoSize: { width: 1920, height: 1080 },
  currentCropMode: 'custom',
  isDraggingTimeline: false,
  timelineHandles: { left: null, right: null, playhead: null },
  urlVideo: null,
  configConvertVideo: null
};

const VIDEO_STATE = {
  trimCropVideo: null,
  videoDuration: 0,
  playPromise: null
};

let _trimCropVideo = VIDEO_STATE.trimCropVideo;
let _videoDuration = VIDEO_STATE.videoDuration;

function includeHTML(selector, url) {
  fetch(url)
    .then(response => response.text())
    .then(html => {
      document.querySelector(selector).innerHTML = html;
    })
    .catch(error => {
      console.error('Error including HTML:', error);
    });
}

let sizeTimeout;
let leftBannerContainerWidth;
let rightBannerContainerWidth;
let leftMarginContentContainer;
let rightMarginContentContainer;

window.addEventListener('resize', () => {
  if (typeof sizeTimeout !== 'undefined') {
    clearTimeout(sizeTimeout);
  }
  sizeTimeout = setTimeout(() => {
    // Chỉ chạy khi không có modal nào đang mở
    if (!document.querySelector('.mtcv-container.mtcv-show')) {
      onScaleContainer();
    }
  }, 300);
});

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    onScaleContainer();
  }, 100);
  APP_STATE.modals.trimCrop = document.querySelector('.mtcv-container');
});

function onScaleContainer() {
  console.log('Welcome onScaleContainer');
  const scalableContent = document.querySelector('.scalable-content');
  const contentContainer = document.querySelector('.content-container');;
  const leftBanner = document.querySelector('.left-banner-container');
  const rightBanner = document.querySelector('.right-banner-container');

  if (!scalableContent || !contentContainer || !leftBanner || !rightBanner) {
    console.warn('Required DOM elements not found for scaling');
    return;
  }

  if (typeof leftBannerContainerWidth === 'undefined') {
    leftBannerContainerWidth = document.querySelector('.left-banner-container').offsetWidth;
    rightBannerContainerWidth = document.querySelector('.right-banner-container').offsetWidth;

    const style = window.getComputedStyle(contentContainer);
    leftMarginContentContainer = parseFloat(style.marginLeft);
    rightMarginContentContainer = parseFloat(style.marginRight);
  }

  const viewWidth = document.documentElement.clientWidth - 12;
  const viewHeight = contentContainer.offsetHeight - 20;

  let availableWidth = viewWidth - leftBannerContainerWidth - rightBannerContainerWidth - leftMarginContentContainer - rightMarginContentContainer;

  const minHeight = scalableContent.offsetHeight;
  const minWidth = scalableContent.offsetWidth;

  if (availableWidth < minWidth) {
    availableWidth = viewWidth;
    leftBanner.style.width = '0';
    rightBanner.style.width = '0';
    contentContainer.style.margin = '0';
  } else {
    leftBanner.style.width = `${leftBannerContainerWidth}px`;
    rightBanner.style.width = `${rightBannerContainerWidth}px`;
    contentContainer.style.margin = '0 40px';
  }

  const maxHeight = viewHeight;
  const maxWidth = availableWidth;
  const desiredRatio = minWidth / minHeight;

  let outHeight = maxHeight;
  let outWidth = desiredRatio * outHeight;

  if (outWidth > maxWidth) {
    outWidth = maxWidth;
    outHeight = maxWidth / desiredRatio;
  }

  let ratio = outWidth / minWidth;
  const maxRatio = 1.8;
  const minRatio = 1;

  ratio = Math.max(minRatio, Math.min(maxRatio, ratio));
  contentContainer.style.width = `${ratio * minWidth}px`;
  scalableContent.style.transform = `translate(0%, 0%) scale(${ratio})`;
}
