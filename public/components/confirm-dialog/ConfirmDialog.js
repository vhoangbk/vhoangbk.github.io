class ConfirmDialog {
  constructor({
    message = "",
    cancelText = "Cancel",
    onCancel = null,
    acceptText = "OK",
    onAccept = null,
    type = 'delete' // 'delete' | 'none'
  } = {}) {
    this.message = message;
    this.cancelText = cancelText;
    this.onCancel = onCancel;
    this.acceptText = acceptText;
    this.onAccept = onAccept;
    this.type = type;

    const style = document.createElement("style");
    style.textContent = `
    .dialog-confirm-overlay {
      position: fixed;
      display: none;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      align-items: center;
      justify-content: center;
      background: rgba(28, 23, 23, 0.4);
      z-index: 10004;
    }
    .dialog-confirm-overlay.active {
      display: flex;
    }
    .dialog-confirm-box {
      background-color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      border-radius: 10px;
      width: min(90%, calc(100vw - 40px));
      max-width: 400px;
      min-height: 226px;
      overflow: hidden;
    }
    .dialog-confirm-header {
      height: 69px;
      width: 100%;
      background: var(--theme-color);
      border-radius: 10px 10px 0 0;
      display: flex;
      justify-content: center;
      align-items: center;
      border-bottom: 2px solid var(--theme-color-line);
    }

    .dialog-confirm-header > div {
      height: 54px;
      width: 54px;
      background: white;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .dialog-confirm-header > div > img {
      width: 37px;
      height: 42px;
    }

    .dialog-confirm-body {
      flex: 1;
      overflow: hidden;
      font-size: 16px;
      color: #504F4F;
      text-align: center;
      display: flex;
      align-items: center;
      padding: 0 20px;
      justify-content: center;
    }

    .dialog-confirm-footer {
      width: calc(100% - 26px);
      height: 50px;
      margin: 10px 10px 16px 10px;
      display: flex;
      justify-content: space-between;
      gap: 13px;
      align-items: center;
    }

    .dialog-confirm-cancel {
      cursor: pointer;
      height: 100%;
      flex: 1;
      background-color: white;
      border: 1px solid #939393;
      border-radius: 8px;
      font-size: 20px;
      color: #939393;
    }

    .dialog-confirm-accept {
      cursor: pointer;
      height: 100%;
      width: 30%;
      flex: 1;
      border: none;
      background-color: #FF4040;
      border-radius: 8px;
      font-size: 20px;
      color: white;
    }
    
    .dialog-confirm-accept-none {
      background-color: #FFCD35;
      color: #504F4F;
    }
  `;

    if (!this.hasCSSClass('dialog-confirm-overlay')) {
      document.head.appendChild(style);
    }

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-confirm-overlay";

    let header = this.type === 'delete' ? `
        <div class="dialog-confirm-header">
          <div>
            <img src="/images/icon-bee.webp" alt="Logo beeconvert" />
          </div>
        </div>
    ` : '';

    let btnAcceptBg = this.type === 'delete' ? '' : 'dialog-confirm-accept-none';

    let template = `
      <div class="dialog-confirm-box">
        ${header}
        <div class="dialog-confirm-body">${message}</div>
        <div class="dialog-confirm-footer">
          <button class="dialog-confirm-accept ${btnAcceptBg}">${acceptText}</button>
          <button class="dialog-confirm-cancel">${cancelText}</button>
        </div>
      </div>
    `;

    this.overlay.innerHTML = template;
    const wheelHandler = createPreventBodyScrollHandler('.dialog-confirm-overlay', '.dialog-confirm-box');
    window.addEventListener('wheel', wheelHandler, { passive: false });

    this._bindEvents();

    document.body.appendChild(this.overlay);
  }

  hasCSSClass(className) {
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        continue;
      }

      for (const rule of rules) {
        if (rule.selectorText?.includes(`.${className}`)) {
          return true;
        }
      }
    }
    return false;
  }

  _bindEvents() {
    this.overlay
      .querySelector(".dialog-confirm-cancel")
      .addEventListener("click", () => {
        this.close();
        if (this.onCancel) this.onCancel();
      });

    this.overlay
      .querySelector(".dialog-confirm-accept")
      .addEventListener("click", () => {
        this.close();
        if (this.onAccept) this.onAccept();
      });

    document.addEventListener("keydown", (e) => {
      if (this.isOpen && e.key === "Escape") {
        this.close();
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
    const wheelHandler = createPreventBodyScrollHandler('.dialog-confirm-overlay', '.dialog-confirm-box');
    window.removeEventListener('wheel', wheelHandler, { passive: false });
  }
}
