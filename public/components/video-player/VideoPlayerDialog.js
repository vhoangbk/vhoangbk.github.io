class VideoPlayerDialog {
  constructor({
    element = null,
    blob_url = null,
    closeText = "Close",
    onClose = null,
  } = {}) {
    this.element = element;
    this.blob_url = blob_url;
    this.closeText = closeText;
    this.onClose = onClose;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-video-player-overlay";
    includeHtml('components/video-player/video-player.html', (html) => {
      this.overlay.innerHTML = html.replace('${blob_url}', decodeURIComponent(blob_url))
      this._bindEvents();
      this.play();
    })

    if (this.element) {
      element.style.position = "relative";
      element.appendChild(this.overlay);
    }
    
  }

  _bindEvents() {
 
    this.overlay
      .querySelector(".dialog-video-player-close")
      .addEventListener("click", () => this.close());

    // Click ngoài dialog để đóng
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.close();
        if (this.onClose) this.onClose();
      }
    });

    // Nhấn ESC để đóng
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
    this.overlay.classList.remove("active");
    this.isOpen = false;
  }

  destroy() {
    this.stopVideo()
    this.overlay.remove();
  }
}
