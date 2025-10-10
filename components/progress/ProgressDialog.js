class ProgressDialog {
  constructor({
    element = null,
    message = "Video is being converted please wait a moment!",
    closeText = "Cancel",
    onClose = null,
    value = 0,
  } = {}) {
    this.element = element;
    this.message = message;
    this.closeText = closeText;
    this.onClose = onClose;
    this.value

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-progress-overlay";
    includeHtml('components/progress/progress.html', (html) => {
      this.overlay.innerHTML = html.replace('${message}', this.message).replace('${value}', this.value || '0').replace('${closeText}', this.closeText);;
      this._bindEvents();
    })

    if (this.element) {
      element.style.position = "relative";
      element.appendChild(this.overlay);
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
    if (progressText) progressText.textContent = `${value}%`;
    if (progressBar) progressBar.value = parseInt(value)/100;
    if (progressMessage) progressMessage.textContent =  + timeLeft > 0 ? ' Time left: ' + this.formatTimeLeft(parseInt(timeLeft)) : this.message;
  }

  formatTimeLeft(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
}
