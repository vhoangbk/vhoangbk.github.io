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
  // Backup hiện tại (dùng cho cancel)
  localStorage.setItem('APP_STATE', JSON.stringify(backupAppState || {}));
  try {
    localStorage.setItem('ratio', JSON.stringify(typeof mtcv_currentRatio !== "undefined" ? mtcv_currentRatio : null));
  } catch (e) {
    console.warn('Cannot save ratio:', e);
  }

  // Khôi phục cấu hình đã lưu trước đó (nếu có) để render đúng giá trị khi mở lại
  const saved = localStorage.getItem('APP_STATE');
  const savedRatio = localStorage.getItem('ratio');
  if (saved) {
    try { APP_STATE.configConvertVideo = JSON.parse(saved); }
    catch (e) { console.warn('Cannot parse saved APP_STATE:', e); }
  }
  if (savedRatio) {
    try { mtcv_currentRatio = JSON.parse(savedRatio); }
    catch (e) { console.warn('Cannot parse saved ratio:', e); }
  }
  const modal = APP_STATE.modalTrimCrop;
  const advancedBtn = document.querySelector('.config-advenced-button');
  
  if (!modal) {
    console.error('Modal trimCrop not found');
    return;
  }
  console.log(APP_STATE.selectedFileInfo)

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
                  preload="metadata" poster="/images/default_video.png"></video>
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
        <div class="desktop-not-supported__message-warning-container">
          <label class="desktop-not-supported__message-warning">
            <div class="warning-icon">
              <svg width="18" height="16" viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.7428 13.1271L10.7159 0.977643C10.5403 0.679986 10.2897 0.433184 9.98875 0.261698C9.68783 0.0902134 9.34713 0 9.0004 0C8.65368 0 8.31297 0.0902134 8.01205 0.261698C7.71114 0.433184 7.46046 0.679986 7.28486 0.977643L0.257992 13.1271C0.0890381 13.415 0 13.7425 0 14.0759C0 14.4094 0.0890381 14.7368 0.257992 15.0247C0.431338 15.3242 0.681589 15.5723 0.983066 15.7437C1.28454 15.9151 1.62639 16.0035 1.97353 15.9999H16.0273C16.3741 16.0032 16.7157 15.9146 17.0168 15.7433C17.318 15.5719 17.568 15.3239 17.7412 15.0247C17.9104 14.7369 17.9997 14.4096 18 14.0761C18.0003 13.7427 17.9115 13.4152 17.7428 13.1271ZM16.6283 14.3839C16.5671 14.4879 16.4791 14.5739 16.3735 14.6329C16.2679 14.692 16.1484 14.722 16.0273 14.7199H1.97353C1.85242 14.722 1.73293 14.692 1.62731 14.6329C1.52169 14.5739 1.43375 14.4879 1.37249 14.3839C1.317 14.2904 1.28773 14.1837 1.28773 14.0751C1.28773 13.9665 1.317 13.8598 1.37249 13.7663L8.39936 1.61684C8.46186 1.5133 8.5502 1.42762 8.6558 1.36814C8.76141 1.30866 8.88068 1.2774 9.00201 1.2774C9.12334 1.2774 9.24261 1.30866 9.34821 1.36814C9.45381 1.42762 9.54216 1.5133 9.60466 1.61684L16.6315 13.7663C16.6865 13.8601 16.7152 13.9669 16.7147 14.0756C16.7141 14.1842 16.6843 14.2907 16.6283 14.3839ZM8.35758 9.59996V6.39999C8.35758 6.23025 8.4253 6.06747 8.54586 5.94745C8.66641 5.82742 8.82991 5.76 9.0004 5.76C9.17089 5.76 9.33439 5.82742 9.45495 5.94745C9.5755 6.06747 9.64323 6.23025 9.64323 6.39999V9.59996C9.64323 9.7697 9.5755 9.93248 9.45495 10.0525C9.33439 10.1725 9.17089 10.24 9.0004 10.24C8.82991 10.24 8.66641 10.1725 8.54586 10.0525C8.4253 9.93248 8.35758 9.7697 8.35758 9.59996ZM9.96464 12.4799C9.96464 12.6698 9.90809 12.8554 9.80213 13.0133C9.69618 13.1711 9.54559 13.2942 9.3694 13.3668C9.19321 13.4395 8.99933 13.4585 8.81229 13.4215C8.62524 13.3844 8.45343 13.293 8.31858 13.1587C8.18373 13.0245 8.0919 12.8534 8.05469 12.6672C8.01749 12.481 8.03658 12.288 8.10956 12.1126C8.18254 11.9371 8.30613 11.7872 8.4647 11.6817C8.62327 11.5762 8.80969 11.5199 9.0004 11.5199C9.25613 11.5199 9.50139 11.6211 9.68222 11.8011C9.86305 11.9811 9.96464 12.2253 9.96464 12.4799Z" fill="#FB5007"/>
              </svg>
            </div>
            This video is not supported for playback
          </label>
        </div>
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
