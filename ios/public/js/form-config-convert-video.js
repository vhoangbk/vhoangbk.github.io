let clickCount = 0;
const resolutionOverlay = document.getElementById('overlayResolution');
const qualitynOverlay = document.getElementById('overlayQuality');
const fpsOverlay = document.getElementById('overlayFps');
let timeoutTrimId;

function openModalAdvancedConfig() {
  if (!APP_STATE.selectedFileInfo) {
    clickCount++;
    if (clickCount > 1) {
      return;
    }
    showNotification('Please upload a video file first');
    setTimeout(() => {
      clickCount = 0;
    }, 2000);
    return;
  }
  const backupAppState = APP_STATE.configConvertVideo;
  // if(backupAppState) {
  //   backupAppState.ratio = backupAppState.ratio !== null ? backupAppState.ratio : 'custom';
  // }
  localStorage.setItem('APP_STATE', JSON.stringify(backupAppState || {}));
  localStorage.setItem('ratio', JSON.stringify(mtcv_currentRatio));
  const modal = APP_STATE.modalTrimCrop;
  const advancedBtn = document.querySelector('.config-advenced-button');
  
  if (!modal) {
    console.error('Modal trimCrop not found');
    return;
  }
  const img = new Image();
  img.src = '/images/pause.svg';
  const isVisible = modal.style.display === 'flex' && modal.classList.contains('mtcv-show');
  if (!isVisible) {
    const modalContainer = document.getElementById('modalTrimCropVideoContainer');
    let template = `
      <div class="mtcv-content" id="modalTrimCropVideoContent">
        <!-- ✅ Header: Chỉ có title, clean và đơn giản -->
        <header class="mtcv-header">
          <div class="dialog-mtcv-header">
            Trim, Crop, Flip
          </div>
        </header>
        
        <!-- Content body -->
        <div class="mtcv-content-body">
          <div class="mtvc-content-main">
            <div class="mtcv-stage" id="mtcvStage">
              <div class="mtcv-media-container" id="mtcvMediaContainer">
                <div class="mtcv-thumbnail-not-play-video"><span></span></div>
                <div class="mtcv-video-wrapper">
                  <video id="mtcvDisplayedVideo" class="mtcv-displayed-video" playsinline webkit-playsinline
                    preload="metadata"></video>
                </div>
              </div>
              <div id="mtcvOverlayTop" class="mtcv-overlay-part"></div>
              <div id="mtcvOverlayLeft" class="mtcv-overlay-part"></div>
              <div id="mtcvOverlayRight" class="mtcv-overlay-part"></div>
              <div id="mtcvOverlayBottom" class="mtcv-overlay-part"></div>
              <div id="mtcvCropBox" class="mtcv-crop-box">
                <!-- 4 góc -->
                <div class="mtcv-handle tl" data-handle="tl"></div>
                <div class="mtcv-handle tr" data-handle="tr"></div>
                <div class="mtcv-handle bl" data-handle="bl"></div>
                <div class="mtcv-handle br" data-handle="br"></div>
                
                <!-- Dấu + ở giữa để di chuyển -->
                <div class="mtcv-move-handle" data-handle="move">
                  <div class="mtcv-move-icon">
                    <img src="/images/plus-icon.svg" alt="Move">
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div id="id-control-video"></div>
          <div class="content-container-options">
            <div class="mtcv-content-main-options">
              <section class="mtcv-info-panel">
                <label class="mtcv-checkbox-cropbox" for="crop-toggle-checkbox">
                  <input type="checkbox" id="crop-toggle-checkbox" onchange="toggleCropBox()">
                  <span class="mtcv-checkbox-cropbox-checkmark"></span>
                  <span class="mtcv-checkbox-title">Crop</span>
                </label>
                <div class="mtcv-dimensions">
                  <div class="mtcv-dimension-item">
                    <label>W:</label>
                    <span class="mtcv-dimension-value" data-dimension="width">0</span>
                  </div>
                  <div class="mtcv-dimension-item">
                    <label>H:</label>
                    <span class="mtcv-dimension-value" data-dimension="height">0</span>
                  </div>
                  <div class="mtcv-dimension-item">
                    <label>X:</label>
                    <span class="mtcv-dimension-value" data-dimension="x">0</span>
                  </div>
                  <div class="mtcv-dimension-item">
                    <label>Y:</label>
                    <span class="mtcv-dimension-value" data-dimension="y">0</span>
                  </div>
                </div>
              </section>
              <section class="mtcv-crop-ratios">
                <button class="mtcv-ratio-btn" data-ratio="custom">
                  <img src="/images/icon-custom.svg" alt="Custom">
                  <span>Free</span>
                </button>
                <button class="mtcv-ratio-btn" data-ratio="1:1">
                  <img src="/images/instagram-icon.svg" alt="1:1">
                  <span>1:1</span>
                </button>
                <button class="mtcv-ratio-btn" data-ratio="9:16">
                  <img src="/images/tiktok-icon.svg" alt="9:16">
                  <span>9:16</span>
                </button>
                <button class="mtcv-ratio-btn" data-ratio="16:9">
                  <img src="/images/youtube-icon.svg" alt="16:9">
                  <span>16:9</span>
                </button>
                <button class="mtcv-ratio-btn" data-ratio="4:3">
                  <img src="/images/youtube-icon.svg" alt="4:3">
                  <span>4:3</span>
                </button>
              </section>
            </div>
          </div>
          <div class="content-container-options">
            <div class="mtcv-content-main-options">
              <section class="mtcv-timeline">
                <label class="mtcv-checkbox-cropbox" for="trim-video-toggle-checkbox">
                  <input type="checkbox" id="trim-video-toggle-checkbox" onchange="toggleTrimVideo()">
                  <span class="mtcv-checkbox-cropbox-checkmark"></span>
                  <span class="mtcv-checkbox-title">Trim video</span>
                </label>

                <div id="dual-range-container" ></div>
                <div class="mtcv-timeline-track mtcv-timeline-track-disabled">
                  <div class="time-labels">
                    <div class="time-label" id="startTimeLabel">00:00</div>
                    <div class="time-label" id="endTimeLabel">00:00</div>
                  </div>
                </div>
              </section>
            </div>
          </div>
          <div class="content-container-options">
            <div class="mtcv-content-main-options">
              <section class="mtcv-flip-controls">
                <label class="mtcv-checkbox-cropbox" for="verticalToggleCheckboxWebMobile">
                  <input type="checkbox" id="verticalToggleCheckboxWebMobile" onchange="toggleVertical()">
                  <span class="mtcv-checkbox-cropbox-checkmark"></span>
                  <span class="mtcv-checkbox-title">Flip Vertical</span>
                </label>
                <label class="mtcv-checkbox-cropbox" for="horizontalToggleCheckboxWebMobile">
                  <input type="checkbox" id="horizontalToggleCheckboxWebMobile" onchange="toggleHorizontal()">
                  <span class="mtcv-checkbox-cropbox-checkmark"></span>
                  <span class="mtcv-checkbox-title">Flip Horizontal</span>
                </label>
              </section>
            </div>
          </div>
        </div>
        
        <!-- ✅ Footer: Nằm TRONG .mtcv-content, dưới cùng của popup -->
        <footer class="mtcv-footer">
          <div class="mtcv-footer-buttons">
            <button class="dialog-mtcv-cancel" onclick="cancelTrimCropModal()">Cancel</button>
            <button class="dialog-mtcv-close" onclick="saveTrimCropModal()">Save</button>
          </div>
        </footer>
      </div>  <!-- ✅ Đóng .mtcv-content, footer đã nằm trong -->
    </div>  <!-- Đóng modal container -->
    `;
    modalContainer.innerHTML = template;

    addControlvideo(document.getElementById('id-control-video'), mtcvDisplayedVideo);

    function debounceFunc(func, delay) {
      return function (...args) {
        clearTimeout(timeoutTrimId);
        timeoutTrimId = setTimeout(() => {
          func.apply(this, args);
        }, delay);
      };
    }

    // ✅ Prevent scroll NGAY KHI MỞ MODAL (trước khi add class)
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.body.classList.add('dialog-open');
    document.documentElement.classList.add('dialog-open');

    document.documentElement.classList.add('mtcv-open');
    modalContainer.style.display = 'flex';

    // ✅ Giảm setTimeout: chỉ cần 1 lần, không cần nhiều
    // ✅ Sử dụng requestAnimationFrame để đảm bảo smooth
    requestAnimationFrame(() => {
      modalContainer.classList.add('mtcv-show');
      // ✅ Gọi addTrimComponent ngay, không delay
      addTrimComponent();
      
      // ✅ Initialize sau một chút để đảm bảo DOM đã render
      requestAnimationFrame(() => {
        initializeDOMElementsForMTCV();
      });
    });

    if (advancedBtn) advancedBtn.classList.add('advance-btn-active');
  } else {
    // ✅ Restore scroll khi đóng modal
    modal.classList.remove('mtcv-show');
    document.documentElement.classList.remove('mtcv-open');
    
    // ✅ Lấy scroll position đã lưu
    const scrollY = document.body.style.top;
    const scrollPosition = scrollY ? parseInt(scrollY.replace('px', '').replace('-', '')) : 0;
    
    // ✅ Restore body styles
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.height = '';
    
    // ✅ Restore html/documentElement styles
    document.documentElement.style.overflow = '';
    document.documentElement.style.position = '';
    document.documentElement.style.width = '';
    document.documentElement.style.height = '';
    document.documentElement.style.left = '';
    document.documentElement.style.right = '';
    document.documentElement.style.top = '';
    
    // ✅ Remove classes
    document.body.classList.remove('dialog-open');
    document.documentElement.classList.remove('dialog-open');
    
    // ✅ Restore scroll position
    if (scrollPosition > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
        document.documentElement.scrollTop = scrollPosition;
      });
    }
    
    setTimeout(() => modal.style.display = 'none', 300);
    if (advancedBtn) advancedBtn.classList.remove('advance-btn-active');
  }

  function addTrimComponent() {
    const videoDuration = APP_STATE.selectedFileInfo?.duration || mtcv_videoDuration || 0;
    const duration =  (videoDuration * 1000).toFixed(3);
    dualRange = new DualRange('dual-range-container', {gap: 1000, max: duration, onChangeValue: (data) => {
      mtcv_startTime = data.min;
      mtcv_endTime = data.max;
      updateTimeDisplay();
      updateCropConfig('trimVideo');
      if (mtcvDisplayedVideo && !mtcvDisplayedVideo.paused) {
        mtcvDisplayedVideo.pause();
      }
      debounceFunc(() => {
        if (data.type === 'min') {
          mtcvDisplayedVideo.currentTime = mtcv_startTime;
        } else if (data.type === 'max') {
          mtcvDisplayedVideo.currentTime = data.max;
        }
      }, 300)();

    }});
    const startTime = APP_STATE.configConvertVideo ? ((APP_STATE.configConvertVideo.startTime || 0) * 1000).toFixed(3) : 0;
    const endTime = APP_STATE.configConvertVideo ? ((APP_STATE.configConvertVideo.endTime || duration) * 1000).toFixed(3) : duration;
    const disable = !(APP_STATE.configConvertVideo ? APP_STATE.configConvertVideo.trimCheck :false);
    dualRange.updateValue(startTime, endTime);
    dualRange.setDisabled(disable);
  }
}

// Cấu hình các overlay và select tương ứng
const OVERLAY_CONFIG = [
  { overlay: resolutionOverlay, selectId: 'resolutionSelect' },
  { overlay: qualitynOverlay, selectId: 'qualitySelect' },
  { overlay: fpsOverlay, selectId: 'fpsSelect' }
];

function toggleOverlayState(show) {
  const disabledColor = '#00000042';
  const normalColor = '#000000';
  
  OVERLAY_CONFIG.forEach(({ overlay, selectId }) => {
    overlay && (overlay.style.display = show ? 'block' : 'none');
    const select = __getElementByIdByUI(selectId);
    select && (select.style.color = show ? disabledColor : normalColor);
  });
}

function showDisableOverlay() {
  toggleOverlayState(true);
}

function hideDisableOverlay() {
  toggleOverlayState(false);
}
