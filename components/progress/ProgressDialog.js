class ProgressDialog {
  constructor({
    element = null,
    elementContent = null,
    message = "Video is being converted please wait a moment!",
    closeText = "Cancel",
    onClose = null,
    value = 0,
  } = {}) {
    this.element = element;
    this.elementContent = elementContent;
    this.message = message;
    this.closeText = closeText;
    this.onClose = onClose;
    this.value

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-progress-overlay";

    let rectContent = this.elementContent.getBoundingClientRect();

    let template = `
      <div class="dialog-progress-box">
        <div class="dialog-progress-text">${value}%</div>
        <progress class="dialog-progress-bar value=${value} max=" 100"></progress>
        <div class="dialog-progress-message">${message}</div>
        <div class="dialog-progress-footer">
            <button class="dialog-progress-cancel">${closeText}</button>
        </div>
      </div>
    `;

    this.overlay.innerHTML = template;
    this._bindEvents();

    if (this.element) {
      element.appendChild(this.overlay);

      let dialogBox = this.overlay.querySelector(".dialog-progress-box")

      let w = rectContent.width - 80 * APP_STATE.ratioOfWeb;
      let h = (rectContent.width - 80 * APP_STATE.ratioOfWeb)*0.5
      let top = rectContent.top + (rectContent.height - h) / 2;
      dialogBox.style.top = `${top}px`;
      dialogBox.style.width = `22rem`;
      dialogBox.style.height = `12rem`;
      dialogBox.style.fontSize = `1rem`;
    }

  }

  _bindEvents() {

    this.overlay
      .querySelector(".dialog-progress-cancel")
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
  }

  destroy() {
    this.overlay.remove();
  }

  update(value, timeLeft = 0) {
    const progressText = this.overlay.querySelector(".dialog-progress-text");
    const progressBar = this.overlay.querySelector(".dialog-progress-bar");
    const progressMessage = this.overlay.querySelector(".dialog-progress-message");
    if (progressText) progressText.textContent = `${Math.round(value)}%`;
    if (progressBar) progressBar.value = Math.round(value)/100;
    if (progressMessage) progressMessage.textContent =  timeLeft > 0 ? ' Time left: ' + this.formatTimeLeft(parseInt(timeLeft)) : this.message;
  }

  formatTimeLeft(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }
}
