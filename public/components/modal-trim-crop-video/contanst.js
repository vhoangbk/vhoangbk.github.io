let mtcv_mediaLoaded = false;
let mtcv_origWidth = 0, mtcv_origHeight = 0;
let mtcv_mediaWidth = 0, mtcv_mediaHeight = 0;
let mtcv_mediaOffsetX = 0, mtcv_mediaOffsetY = 0;
let mtcv_box = { x: 0, y: 0, w: 150, h: 150, visible: false };
let mtcv_action = null;
let mtcv_pointerStart = { x: 0, y: 0 };
let mtcv_boxStart = null;

let mtcv_play = null;
let mtcv_progressContainer = null;
let mtcv_isDragging = false;
let mtcv_dragTarget = null;
let mtcv_startTime = 0;
let mtcv_endTime = 0;
let mtcv_videoDuration = 0;
let mtcv_wasPlaying = false;

let mtcv_initialMouseX = 0
let mtcv_initialMouseY = 0;

let mtcv_currentRatio = null;
let mtcv_minSize = 40;
let mtcv_widthAtMax = false;
let mtcv_heightAtMax = false;
let mtcv_flipState = {
  vertical: false,
  horizontal: false
};
let mtcv_showCropBox = false;

// Thêm các biến để lưu trạng thái checkbox
let mtcv_showTrimVideo = false;
let mtcv_showVerticalFlip = false;
let mtcv_showHorizontalFlip = false;

let mtcv_displayedVideo, mtcv_stage, mtcv_cropBox, mtcv_mediaContainer;
let mtcv_overlayTop, mtcv_overlayLeft, mtcv_overlayRight, mtcv_overlayBottom;
let mtcv_dimensionWidth, mtcv_dimensionHeight, mtcv_dimensionX, mtcv_dimensionY;

const MTCV = {
  ids: {
    displayedVideo: 'mtcvDisplayedVideo',
    stage: 'mtcvStage',
    cropBox: 'mtcvCropBox',
    moveHandle: 'mtcvMoveHandle',
    mediaContainer: 'mtcvMediaContainer',
    overlayTop: 'mtcvOverlayTop',
    overlayLeft: 'mtcvOverlayLeft',
    overlayRight: 'mtcvOverlayRight',
    overlayBottom: 'mtcvOverlayBottom',
    dimensionWidth: '[data-dimension="width"]',
    dimensionHeight: '[data-dimension="height"]',
    dimensionX: '[data-dimension="x"]',
    dimensionY: '[data-dimension="y"]',
    progressContainer: 'progressContainer',
    selectedRange: 'selectedRange',
    currentTimeLine: 'currentTimeLine',
    startHandle: 'startHandle',
    endHandle: 'endHandle',
    startTimeLabel: 'startTimeLabel',
    endTimeLabel: 'endTimeLabel',
  }
}

const TARGET_SIZE_ITEMS = [
  { value: "", text: "None" },
  { value: "custom", text: "Custom" },
  { value: "1", text: "1MB" },
  { value: "2", text: "2MB" },
  { value: "5", text: "5MB" },
  { value: "8", text: "8MB" },
  { value: "10", text: "10MB" },
  { value: "15", text: "15MB" },
  { value: "25", text: "25MB" },
  { value: "50", text: "50MB" },
  { value: "100", text: "100MB" },
  { value: "200", text: "200MB" },
  { value: "500", text: "500MB" },
  { value: "1000", text: "1GB" }
];
