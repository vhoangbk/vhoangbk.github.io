class ProgressDialog {
  constructor({
    element = null,
    elementContent = null,
    message = "Calculating...",
    closeText = "Cancel",
    onClose = null,
    value = 0,
    appUI = isDisplayed('.app--container'),
  } = {}) {
    this.element = element;
    this.elementContent = elementContent;
    this.message = message;
    this.closeText = closeText;
    this.onClose = onClose;
    this.value
    this.appUI = appUI;
    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-progress-overlay";

    let rectContent = this.elementContent.getBoundingClientRect();
    
    // SỬA: Template mới giống app-progress
    let template = `
      <div class="dialog-progress-box">
        <div class="dialog-progress-header">
          <div class="dialog-progress-logo">
            <img src="/images/icon-bee.webp" alt="Logo beeconvert" class="dialog-progress-logo-img" />
          </div>
        </div>
        <div class="dialog-progress-content">
          <div class="dialog-progress-body">
            <div class="dialog-progress-text progress__text">${value}%</div>
            <div class="dialog-progress-message progress__message">${message}</div>
          </div>
          <progress class="dialog-progress-bar progress-bar__value" value=${value} max="100"></progress>
          <label class="desktop-progress__message-warning">
            <div class="warning-icon">⚠️</div>
            Please stay on this screen until the conversion is complete.</label>
          <div class="dialog-progress-footer">
            <button class="dialog-progress-cancel progress__cancel">${closeText}</button>
          </div>
        </div>
      </div>
    `;
    
    let templateAppUI = `
      <div class="app-progress">
        <div class="app-progress__header">
          <div class="app-progress__logo">
            <img src="/images/icon-bee.webp" alt="Logo beeconvert" class="app-progress__logo-img" />
          </div>
        </div>

        <div class="app-progress__content">
          <div class="app-progress__body">
            <div class="app-progress__text progress__text">${value}%</div>
            <div class="app-progress__timeline progress__message">${message}</div>
          </div>
          <progress class="app-progress__bar progress-bar__value" value="${value}" max="100"></progress>
          <label class="app-progress__message-warning">
            <div class="warning-icon">⚠️</div>
            Please stay on this screen until the conversion is complete.</label>
          <div class="app-progress__footer">
            <button class="app-progress__cancel progress__cancel">${closeText}</button>
          </div>
        </div>
      </div>
    `;

    this.overlay.innerHTML = appUI ? templateAppUI : template;
    this._bindEvents();

    if (this.element) {
      element.appendChild(this.overlay);
    } else {
      document.body.appendChild(this.overlay);
    }

    // SỬA: Bỏ tính toán thủ công, để CSS tự căn giữa
    // Dialog sẽ tự động căn giữa màn hình với max-width và max-height
  }

  _bindEvents() {

    this.overlay
      .querySelector(".progress__cancel")
      .addEventListener("click", () => {
        this.close();
        if (this.onClose) this.onClose();
      });

  }

  open() {
    this.overlay.classList.add("active");
    this.isOpen = true;
  }

  close() {
    this.overlay.classList.remove("active");
    this.isOpen = false;
    this.destroy()
    // ✅ Restore scroll khi đóng dialog
    restoreScrollForDialog();

  }

  destroy() {
    this.overlay.remove();
  }

  update(value, timeLeft = 0) {
    const progressText = this.overlay.querySelector(".progress__text");
    const progressBar = this.overlay.querySelector(".progress-bar__value");
    const progressMessage = this.overlay.querySelector(".progress__message");
    if (progressText) progressText.textContent = `${Math.round(value)}%`;
    if (progressBar) progressBar.value = Math.round(value);
    if (progressMessage) progressMessage.textContent =  timeLeft > 0 ? `${this.formatTimeLeft(parseInt(timeLeft))} remaining`  : this.message;

  }

  formatTimeLeft(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }
}
