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