class VideoCompleteDialog {
  constructor({
    element = null,
    elementContent = null,
    file_info = null,
    saveText = "Save",
    closeText = "Close",
    onClose = null,
    onSave = null,
  } = {}) {
    this.element = element;
    this.elementContent = elementContent;
    this.file_info = file_info;
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
          <svg class="dialog-video-close" width="0.9rem" height="0.9rem" viewBox="0 0 16 16" fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <g clip-path="url(#clip0_97_877)">
                  <path
                      d="M15.5459 13.9545C15.7572 14.1659 15.876 14.4525 15.876 14.7514C15.876 15.0503 15.7572 15.3369 15.5459 15.5483C15.3346 15.7596 15.0479 15.8784 14.749 15.8784C14.4501 15.8784 14.1635 15.7596 13.9521 15.5483L7.99996 9.59422L2.0459 15.5464C1.83455 15.7578 1.54791 15.8765 1.24902 15.8765C0.950136 15.8765 0.663491 15.7578 0.452147 15.5464C0.240802 15.3351 0.12207 15.0484 0.12207 14.7495C0.12207 14.4506 0.240803 14.164 0.452147 13.9527L6.40621 8.00047L0.454022 2.04641C0.242677 1.83506 0.123945 1.54842 0.123945 1.24953C0.123945 0.950646 0.242677 0.664001 0.454022 0.452657C0.665366 0.241313 0.95201 0.12258 1.2509 0.12258C1.54978 0.12258 1.83643 0.241313 2.04777 0.452657L7.99996 6.40672L13.954 0.451719C14.1654 0.240375 14.452 0.121643 14.7509 0.121643C15.0498 0.121643 15.3364 0.240375 15.5478 0.451719C15.7591 0.663064 15.8778 0.949708 15.8778 1.24859C15.8778 1.54748 15.7591 1.83413 15.5478 2.04547L9.59371 8.00047L15.5459 13.9545Z"
                      fill="#939393" />
              </g>
              <defs>
                  <clipPath id="clip0_97_877">
                      <rect width="16" height="16" fill="white" />
                  </clipPath>
              </defs>
          </svg>
        </div>
        <div style="height: 100%; overflow: auto; padding: 0.8rem;">
          <video class="dialog-video-player" playsinline controls webkit-playsinline preload="metadata" src=${file_info.blob_url}></video>
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
      videoDiv.style.maxHeight = (rectContent.height * 0.5) + 'px';

      let dialogBox = this.overlay.querySelector(".dialog-video-box")
      let w = rectContent.width - 20 * APP_STATE.ratioOfWeb;
      let h = rectContent.height * 0.9;
      let top = rectContent.top + (rectContent.height - h) / 2;
      // dialogBox.style.height = `23rem`;
      dialogBox.style.width = `22rem`;
      dialogBox.style.maxHeight = `${h}px`;
      dialogBox.style.fontSize = `1rem`;
    }

    const elementsInfo = this.overlay.querySelectorAll(".dialog-video-info-right")
      this.overlay
        .querySelector(".dialog-video-player").addEventListener('loadedmetadata', function () {
          elementsInfo[0].textContent = this.videoWidth + ' x ' + this.videoHeight;
          elementsInfo[1].textContent = this.duration.toFixed(2) + ' seconds';
          elementsInfo[2].textContent = (file_info.length / (1024 * 1024)).toFixed(2) + ' MB';
          elementsInfo[3].textContent = file_info.mediaCode;  
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
      .querySelector(".dialog-video-close")
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
  }

  open() {
    this.overlay.classList.add("active");
    this.isOpen = true;
  }

  close() {
    this.stopVideo();
    this.overlay.remove();
    this.isOpen = false;
  }

  stopVideo() {
    const video = this.overlay.querySelector(".dialog-video-player");
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }
}
