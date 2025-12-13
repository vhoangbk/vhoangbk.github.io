class VideoPlayerDialog {
  constructor({
    element = null,
    elementContent = null,
    input_url = null,
    closeText = "Close",
    onClose = null,
    url = null,
    poster = ""
  } = {}) {
    this.element = element;
    this.elementContent = elementContent;
    this.input_url = input_url;
    this.closeText = closeText;
    this.onClose = onClose;
    this.poster = poster;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-video-player-overlay";

    let rectContent = this.elementContent.getBoundingClientRect();

    console.log("selectedFileInfo", APP_STATE.selectedFileInfo);

    let template = `
      <div class="dialog-video-player-box">
        <video poster="${poster}" preload="metadata" class="dialog-video-player-player" playsinline webkit-playsinline controls src="${input_url != null ? decodeURIComponent(input_url) : url}"></video>
        <button class="dialog-video-player-close" aria-label="Close">
          <svg width="0.6rem" height="0.6rem" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L15 15M15 1L1 15" stroke="#939393" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    `

    this.overlay.innerHTML = template

    if (this.element) {
      element.appendChild(this.overlay);
      let dialogBox =  this.overlay.querySelector(".dialog-video-player-box");
      let w = rectContent.width - 40;
      let h = (rectContent.width - 40)*9/16
      let top = rectContent.top + (rectContent.height - h) / 2;
      // dialogBox.style.top = `${top}px`;
      dialogBox.style.maxWidth = `90vw`;
      dialogBox.style.maxHeight = `90vh`;
      const wheelHandler = createPreventBodyScrollHandler('.dialog-video-player-overlay', '.dialog-video-player-box');
      window.addEventListener('wheel', wheelHandler, { passive: false });
    }

    this._bindEvents();
    this.play();
  }

  _bindEvents() {
    this.overlay
      .querySelector(".dialog-video-player-close")
      .addEventListener("click", () => this.close());

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.close();
        if (this.onClose) this.onClose();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (this.isOpen && e.key === "Escape") {
        this.close();
        if (this.onClose) this.onClose();
      }
    });

    let videoEl = this.overlay.querySelector(".dialog-video-player-player");
    videoEl.addEventListener('loadedmetadata', () => {
      let videoH = videoEl.videoHeight;
      let videoW = videoEl.videoWidth;
      let rectContent = this.elementContent.getBoundingClientRect();
      let w = rectContent.width - 40;
      let h = Math.min((rectContent.width - 40)* videoH/videoW, rectContent.height * 0.9);
      let top = rectContent.top + (rectContent.height - h) / 2;
      let dialogBox =  this.overlay.querySelector(".dialog-video-player-box");
      // dialogBox.style.top = `${top}px`;
      dialogBox.style.maxWidth = `90vw`;
      dialogBox.style.maxHeight = `90vh`;
    });
  }

  open() {
    this.overlay.classList.add("active");
    this.isOpen = true;
  }

  play() {
    this.overlay.querySelector(".dialog-video-player-player").play();
  }

  stopVideo() {
    const video = this.overlay.querySelector(".dialog-video-player-player");
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }

  close() {
    this.stopVideo()
    
    // ✅ Restore scroll trước khi remove element
    restoreScrollForDialog();
    
    this.overlay.remove();
    this.isOpen = false;
    const wheelHandler = createPreventBodyScrollHandler('.dialog-video-player-overlay', '.dialog-video-player-box');
    window.removeEventListener('wheel', wheelHandler, { passive: false });
  }
}
