class InfoDialog {
  constructor({
    element = null,
    elementContent = null,
    message = "",
    closeText = "Close",
    onClose = null,
    type = "error", // 'info', 'error'
  } = {}) {
    this.element = element;
    this.elementContent = elementContent;
    this.message = message;
    this.closeText = closeText;
    this.onClose = onClose;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-info-overlay";

    const errorIcon = `
      <div class="dialog-info-icon">
        <img src="/images/ic_error.svg" alt=""/>
      </div>
    `

    const messageType = type === 'error' ? '' : 'dialog-info-msg-info';

    let template = `
      <div class="dialog-info-box">
        <div class="dialog-info-content">
          <div class="dialog-info-body">
            ${type === 'error' ? errorIcon : ''}
            <div class="dialog-info-msg ${messageType}">${message}</div>
          </div>
          <div class="dialog-info-footer">
            <button class="dialog-info-cancel">${closeText}</button>
          </div>
        </div>
      </div>
    `;

    this.overlay.innerHTML = template;
    this._bindEvents();

    // SỬA: Append vào body thay vì element để căn giữa đúng cách
    if (this.element) {
      this.element.appendChild(this.overlay);
    } else {
      document.body.appendChild(this.overlay);
    }
    const wheelHandler = createPreventBodyScrollHandler('.dialog-info-overlay', '.dialog-info-box');
    window.addEventListener('wheel', wheelHandler, { passive: false });

    // SỬA: Bỏ tính toán thủ công, để CSS flexbox tự căn giữa
    // Dialog sẽ tự động căn giữa màn hình với max-width và max-height
  }

  _bindEvents() {
    this.overlay
      .querySelector(".dialog-info-cancel")
      .addEventListener("click", () => {
        this.close();
        if (this.onClose) this.onClose();
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
    this.overlay.remove();
    this.isOpen = false;
    const wheelHandler = createPreventBodyScrollHandler('.dialog-info-overlay', '.dialog-info-box');
    window.removeEventListener('wheel', wheelHandler, { passive: false });
  }
}
