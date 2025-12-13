class VideoCompleteDialog {
  constructor({
    element = null,
    elementContent = null,
    file_info = null,
    fileName = null,
    saveText = "Save",
    closeText = "Close",
    onClose = null,
    onSave = null,
    muted = '',
  } = {}) {
    this.element = element;
    this.elementContent = elementContent;
    this.file_info = file_info;
    this.fileName = fileName;
    this.saveText = saveText;
    this.onSave = onSave;
    this.closeText = closeText;
    this.onClose = onClose;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-video-overlay";

    let rectContent = this.elementContent.getBoundingClientRect();

    let template = `
      <div class="dialog-video-box" style="box-sizing: border-box">
        <div class="dialog-video-header">
          Conversion process is complete
        </div>
        <div style="height: 100%; overflow: auto; padding: 0.8rem;">
          <video class="dialog-video-player" playsinline controls webkit-playsinline preload="metadata" autoplay ${muted} src=${file_info.input_url || file_info.url}></video>
          <div class="video-complete-label">
            <span>${this.fileName}</span>
          </>
          <table class="dialog-video-info">
            <tr>
                <td class="dialog-video-info-left">Resolution:</td>
                <td class="dialog-video-info-right">...</td>
                <td class="dialog-video-info-left">Duration:</td>
                <td class="dialog-video-info-right">... seconds</td>
            </tr>
            <tr>
                <td class="dialog-video-info-left">Size:</td>
                <td class="dialog-video-info-right">... MB</td>
                <td class="dialog-video-info-left">Format:</td>
                <td class="dialog-video-info-right">...</td>
            </tr>
          </table>
          <div style="flex: 1;"></div>
          <div class="dialog-video-footer">
              <button class="dialog-video-save">${saveText}</button>
              <button class="dialog-video-cancel">${closeText}</button>
          </div>
        </div>
      </div>
    `;

    this.overlay.innerHTML = template;

    if (this.element) {
      element.appendChild(this.overlay);

      let videoDiv = this.overlay.querySelector(".dialog-video-player")
      videoDiv.style.maxHeight = '45vh';

      let dialogBox = this.overlay.querySelector(".dialog-video-box")
      let w = rectContent.width - 20 * APP_STATE.ratioOfWeb;
      let h = rectContent.height * 0.9;
      let top = rectContent.top + (rectContent.height - h) / 2;
      // dialogBox.style.height = `23rem`;
      dialogBox.style.width = `24rem`;
      dialogBox.style.maxHeight = `${h}px`;
      dialogBox.style.fontSize = `1rem`;
      const wheelHandler = createPreventBodyScrollHandler('.dialog-video-overlay', '.dialog-video-box');
      window.addEventListener('wheel', wheelHandler, { passive: false });
    }

    const elementsInfo = this.overlay.querySelectorAll(".dialog-video-info-right")
      this.overlay
        .querySelector(".dialog-video-player").addEventListener('loadedmetadata', function () {
          elementsInfo[0].textContent = this.videoWidth + ' x ' + this.videoHeight;
          elementsInfo[1].textContent = formatDuration(this.duration);
          elementsInfo[2].textContent = file_info.displaySize;
          elementsInfo[3].textContent = file_info.videoCodec;  
    });

    this._bindEvents();
  }

  _bindEvents() {
    this.overlay
      .querySelector(".dialog-video-cancel")
      .addEventListener("click", () => {
        this.close();
        if (this.onClose) this.onClose();
      });

    this.overlay
      .querySelector(".dialog-video-save")
      .addEventListener("click", () => {
        this.close();
        if (this.onSave) this.onSave();
      });

    // this.overlay.addEventListener("click", (e) => {
    //   if (e.target === this.overlay) {
    //     this.close();
    //     if (this.onClose) this.onClose();
    //   }
    // });

    document.addEventListener("keydown", (e) => {
      if (this.isOpen && e.key === "Escape") {
        this.close();
        if (this.onClose) this.onClose();
      }
    });
  }

  open() {
    this.overlay.classList.add("active");
    this.isOpen = true;
    
    // ✅ Đảm bảo scroll bị lock ngay khi dialog mở
    // Gọi preventScroll trực tiếp để không bị miss trong race condition
    if (typeof window.restoreScrollForDialog === 'function') {
      // Force check và prevent scroll ngay lập tức
      setTimeout(() => {
        if (document.querySelector('.dialog-video-overlay.active')) {
          // Dialog vẫn đang mở, đảm bảo scroll bị lock
          const hasDialog = document.querySelector('.dialog-video-overlay.active') ||
                          document.querySelector('.dialog-progress-overlay.active') ||
                          document.querySelector('.dialog-loading-overlay.active') ||
                          document.querySelector('.mtcv-container.mtcv-show');
          if (hasDialog && !document.body.classList.contains('dialog-open')) {
            // Nếu có dialog nhưng scroll chưa bị lock, lock ngay
            const scrollPos = window.pageYOffset || document.documentElement.scrollTop || 0;
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollPos}px`;
            document.body.style.width = '100%';
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.height = '100%';
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.position = 'fixed';
            document.documentElement.style.width = '100%';
            document.documentElement.style.height = '100%';
            document.documentElement.style.left = '0';
            document.documentElement.style.right = '0';
            document.documentElement.style.top = '0';
            document.body.classList.add('dialog-open');
            document.documentElement.classList.add('dialog-open');
          }
        }
      }, 0);
    }
  }

  close() {
    console.log(this.file_info)
    this.stopVideo();
    
    if (typeof window.restoreScrollForDialog === 'function') {
      window.restoreScrollForDialog();
    }
    
    this.overlay.remove();
    this.isOpen = false;
    const wheelHandler = createPreventBodyScrollHandler('.dialog-video-overlay', '.dialog-video-box');
    window.removeEventListener('wheel', wheelHandler, { passive: false });
  }

  stopVideo() {
    const video = this.overlay.querySelector(".dialog-video-player");
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }
}
