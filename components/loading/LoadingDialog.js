class LoadingDialog {
  constructor({
    element = null,
    elementContent = null,
    message = "",
  } = {}) {
    this.element = element;
    this.elementContent = elementContent;
    this.message = message;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-loading-overlay";
    this.overlay.id = "app-loading-dialog";

    let rectContent = this.elementContent.getBoundingClientRect();

    let template = `
      <div class="dialog-loading-box">
        <div class="dialog-loading-message">${message}</div>
        <div class="dialog-loading-spinner"></div>
      </div>
    `;

    this.overlay.innerHTML = template;

    if (this.element) {
      element.appendChild(this.overlay);
      let dialogBox = this.overlay.querySelector(".dialog-loading-box")
      let w = rectContent.width - 100 * APP_STATE.ratioOfWeb;
      let h = (rectContent.width - 100 * APP_STATE.ratioOfWeb)*0.5
      let top = rectContent.top + (rectContent.height - h) / 2;
      dialogBox.style.top = `${top}px`;
      dialogBox.style.width = `${w}px`;
      dialogBox.style.height = `${h}px`;
      dialogBox.style.fontSize = `${getFontSizeBody() * APP_STATE.ratioOfWeb}px`;
    }

  }

  open() {
    this.overlay.classList.add("active");
  }

  close() {
    this.overlay.remove();
  }
}
