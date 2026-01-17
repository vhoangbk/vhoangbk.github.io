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
          <div class="dialog-progress-title" style="font-size: 1.3em; color: rgba(99, 98, 98, 1); font-weight: 600; display: flex; justify-content: center; margin-bottom: -10px">
            Converting file...
          </div>
          <div class="dialog-progress-body">
            <div class="dialog-progress-text progress__text">${value}%</div>
            <div class="dialog-progress-message progress__message">${message}</div>
          </div>
          <progress class="dialog-progress-bar progress-bar__value" value=${value} max="100"></progress>
          <label class="desktop-progress__message-warning">
            <div class="warning-icon">
              <svg width="18" height="16" viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.7428 13.1271L10.7159 0.977643C10.5403 0.679986 10.2897 0.433184 9.98875 0.261698C9.68783 0.0902134 9.34713 0 9.0004 0C8.65368 0 8.31297 0.0902134 8.01205 0.261698C7.71114 0.433184 7.46046 0.679986 7.28486 0.977643L0.257992 13.1271C0.0890381 13.415 0 13.7425 0 14.0759C0 14.4094 0.0890381 14.7368 0.257992 15.0247C0.431338 15.3242 0.681589 15.5723 0.983066 15.7437C1.28454 15.9151 1.62639 16.0035 1.97353 15.9999H16.0273C16.3741 16.0032 16.7157 15.9146 17.0168 15.7433C17.318 15.5719 17.568 15.3239 17.7412 15.0247C17.9104 14.7369 17.9997 14.4096 18 14.0761C18.0003 13.7427 17.9115 13.4152 17.7428 13.1271ZM16.6283 14.3839C16.5671 14.4879 16.4791 14.5739 16.3735 14.6329C16.2679 14.692 16.1484 14.722 16.0273 14.7199H1.97353C1.85242 14.722 1.73293 14.692 1.62731 14.6329C1.52169 14.5739 1.43375 14.4879 1.37249 14.3839C1.317 14.2904 1.28773 14.1837 1.28773 14.0751C1.28773 13.9665 1.317 13.8598 1.37249 13.7663L8.39936 1.61684C8.46186 1.5133 8.5502 1.42762 8.6558 1.36814C8.76141 1.30866 8.88068 1.2774 9.00201 1.2774C9.12334 1.2774 9.24261 1.30866 9.34821 1.36814C9.45381 1.42762 9.54216 1.5133 9.60466 1.61684L16.6315 13.7663C16.6865 13.8601 16.7152 13.9669 16.7147 14.0756C16.7141 14.1842 16.6843 14.2907 16.6283 14.3839ZM8.35758 9.59996V6.39999C8.35758 6.23025 8.4253 6.06747 8.54586 5.94745C8.66641 5.82742 8.82991 5.76 9.0004 5.76C9.17089 5.76 9.33439 5.82742 9.45495 5.94745C9.5755 6.06747 9.64323 6.23025 9.64323 6.39999V9.59996C9.64323 9.7697 9.5755 9.93248 9.45495 10.0525C9.33439 10.1725 9.17089 10.24 9.0004 10.24C8.82991 10.24 8.66641 10.1725 8.54586 10.0525C8.4253 9.93248 8.35758 9.7697 8.35758 9.59996ZM9.96464 12.4799C9.96464 12.6698 9.90809 12.8554 9.80213 13.0133C9.69618 13.1711 9.54559 13.2942 9.3694 13.3668C9.19321 13.4395 8.99933 13.4585 8.81229 13.4215C8.62524 13.3844 8.45343 13.293 8.31858 13.1587C8.18373 13.0245 8.0919 12.8534 8.05469 12.6672C8.01749 12.481 8.03658 12.288 8.10956 12.1126C8.18254 11.9371 8.30613 11.7872 8.4647 11.6817C8.62327 11.5762 8.80969 11.5199 9.0004 11.5199C9.25613 11.5199 9.50139 11.6211 9.68222 11.8011C9.86305 11.9811 9.96464 12.2253 9.96464 12.4799Z" fill="#FB5007"/>
              </svg>
            </div>
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

  update(value, timeLeft = 0, title) {
    const progressText = this.overlay.querySelector(".progress__text");
    const progressBar = this.overlay.querySelector(".progress-bar__value");
    const progressMessage = this.overlay.querySelector(".progress__message");
    const progressTitle = this.overlay.querySelector(".dialog-progress-title");
    if (progressText) progressText.textContent = isNaN(value) ? `0%` : `${Math.round(value)}%`;
    if (progressBar) progressBar.value = Math.round(value);
    if (progressMessage) progressMessage.textContent =  timeLeft > 0 ? `${this.formatTimeLeft(parseInt(timeLeft))} remaining`  : this.message;
    if (progressTitle && title) {
      progressTitle.style.display = 'flex';
      progressTitle.textContent = title;
    }
  }

  formatTimeLeft(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }
}
