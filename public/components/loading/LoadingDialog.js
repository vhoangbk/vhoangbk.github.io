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

    let template = `
      <div class="dialog-loading-box">
        <div class="dialog-loading-message">${message}</div>
        <div class="dialog-loading-spinner"></div>
      </div>
    `;

    this.overlay.innerHTML = template;

    // Append to body thay vì element để overlay phủ toàn màn hình
    if (this.element) {
      this.element.appendChild(this.overlay);

    } else {
      // Fallback: append to body nếu không có element
      document.body.appendChild(this.overlay);
    }
    const wheelHandler = createPreventBodyScrollHandler('.dialog-loading-overlay', '.dialog-loading-box');
    window.addEventListener('wheel', wheelHandler, { passive: false });

    let dialogBox = this.overlay.querySelector(".dialog-loading-box");
    
    // Tính toán width và height nếu có elementContent
    if (this.elementContent) {
      try {
        let rectContent = this.elementContent.getBoundingClientRect();
        if (rectContent) {
          let w = rectContent.width - 100 * APP_STATE.ratioOfWeb;
          let h = (rectContent.width - 100 * APP_STATE.ratioOfWeb) * 0.5;
          
          // Chỉ set width và height, không set top vì flexbox sẽ tự căn giữa
          dialogBox.style.width = `${Math.min(270, w)}px`; // Min width 200px
          dialogBox.style.height = `${Math.min(160, h)}px`; // Min height 100px
          dialogBox.style.fontSize = `${getFontSizeBody() * APP_STATE.ratioOfWeb}px`;
        }
      } catch (e) {
        console.warn('Error getting bounding rect:', e);
        // Fallback styles
        dialogBox.style.width = '300px';
        dialogBox.style.height = '150px';
      }
    } else {
      // Fallback styles nếu không có elementContent
      dialogBox.style.width = '300px';
      dialogBox.style.height = '150px';
    }
  }

  open() {
    this.overlay.classList.add("active");
  }

  close() {
    // ✅ Restore scroll trước khi remove element
    restoreScrollForDialog();
    
    this.overlay.remove();
    const wheelHandler = createPreventBodyScrollHandler('.dialog-loading-overlay', '.dialog-loading-box');
    window.removeEventListener('wheel', wheelHandler, { passive: false });
  }
}
