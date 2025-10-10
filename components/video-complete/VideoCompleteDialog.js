class VideoCompleteDialog {
  constructor({
    element = null,
    file_info = null,
    saveText = "Save",
    closeText = "Close",
    onClose = null,
    onSave = null,
  } = {}) {
    this.element = element;
    this.file_info = file_info;
    this.saveText = saveText;
    this.onSave = onSave;
    this.closeText = closeText;
    this.onClose = onClose;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-video-overlay";
    includeHtml('components/video-complete/video-complete.html', (html) => {
      this.overlay.innerHTML = html.replace('${blob_url}', decodeURIComponent( file_info.blob_url )).replace('${saveText}', this.saveText).replace('${closeText}', this.closeText)
      this._bindEvents();

      const elementsInfo = this.overlay.querySelectorAll(".dialog-video-info-right")
      this.overlay
        .querySelector(".dialog-video-player").addEventListener('loadedmetadata', function () {
          elementsInfo[0].textContent = this.videoWidth + ' x ' + this.videoHeight;
          elementsInfo[1].textContent = this.duration.toFixed(2) + ' seconds';
          elementsInfo[2].textContent = (file_info.length / (1024 * 1024)).toFixed(2) + ' MB';
          elementsInfo[3].textContent = file_info.mediaCode;  
    });
    })
  
    if (this.element) {
      element.style.position = "relative";
      element.appendChild(this.overlay);
    }

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

  close() {
    this.stopVideo();
    this.overlay.classList.remove("active");
    this.isOpen = false;
  }

  destroy() {
    this.stopVideo()
    this.overlay.remove();
  }

  stopVideo() {
    const video = this.overlay.querySelector(".dialog-video-player");
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }
}
