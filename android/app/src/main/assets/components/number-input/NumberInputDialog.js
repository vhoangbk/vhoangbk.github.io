class NumberInputDialog {
  constructor({
    element = null,
    elementContent = null,
    message = "",
    onSubmit = null,
    onCancel = null,
  } = {}) {
    this.element = element;
    this.elementContent = elementContent;
    this.message = message;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
    this.originalBodyHeight = document.body.style.height;
    this.originalBodyOverflow = document.body.style.overflow;
    this.initialViewportHeight = window.innerHeight;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-number-input-overlay";

    let template = `
      <div class="dialog-number-input-box" style="box-sizing: border-box; padding-bottom: 0.2rem">
        <div class="dialog-number-input-header">
          <span class="dialog-number-input-title">Custom Target Size</span>
        </div>
        <div class="dialog-number-input-content">
          <div class="dialog-number-input-body">
            <div class="dialog-number-input-row">
                <h3 class="dialog-number-input-mb" style="margin-left: 0;">Target size:</h3>
                <input class="dialog-number-input-input" type="number" inputmode="numeric" value="1" min="1"/>
                <h3 class="dialog-number-input-mb">MB</h3>
            </div>
          <div class="dialog-number-input-error hidden">Please enter a number between 1 and 2000</div>
          </div>
          <div class="dialog-number-input-footer">
              <button class="dialog-number-input-save">OK</button>
              <button class="dialog-number-input-cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;
    this.overlay.innerHTML = template;
    
    if (this.element) {
      this.element.appendChild(this.overlay);
      document.body.style.overflow = 'hidden';
      const wheelHandler = createPreventBodyScrollHandler('.dialog-number-input-overlay', '.dialog-number-input-box');
       window.addEventListener('wheel', wheelHandler, { passive: false });
    }
    this._bindEvents();
  }

  _bindEvents() {
    const input = this.overlay.querySelector(".dialog-number-input-input");
    const btnCancel = this.overlay.querySelector(".dialog-number-input-cancel");
    const btnSubmit = this.overlay.querySelector(".dialog-number-input-save");
    const errorDiv = this.overlay.querySelector(".dialog-number-input-error");
    const dialogBox = this.overlay.querySelector('.dialog-number-input-box');
  
    if (input) {
      input.addEventListener('focus', () => {
        if (this.isMobile) {
          // SỬA: Trên mobile - đợi bàn phím xuất hiện rồi điều chỉnh vị trí
          this.handleMobileKeyboard(dialogBox);
        } else {
          // SỬA: Trên web - ngăn body scroll
          // document.body.style.overflow = 'hidden';
        }
      });
  
      input.addEventListener('blur', () => {
        // if (!this.isMobile) {
        //   document.body.style.overflow = this.originalBodyOverflow;
        // }
      });
  
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleSubmit();
        }
      });
    }
  
    // SỬA: Theo dõi viewport resize trên mobile để detect keyboard
    if (this.isMobile) {
      this.viewportResizeHandler = () => {
        if (this.isOpen && input && input === document.activeElement) {
          this.handleMobileKeyboard(dialogBox);
        }
      };
      window.addEventListener('resize', this.viewportResizeHandler);
    }
  
    if (btnCancel) {
      btnCancel.addEventListener("click", () => {
        this.close();
        if (this.onCancel) this.onCancel();
      });
    }
  
    if (btnSubmit) {
      btnSubmit.addEventListener("click", () => {
        this.handleSubmit();
      });
    }
  
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.close();
        if (this.onCancel) this.onCancel();
      }
    });
  
    document.addEventListener("keydown", (e) => {
      if (this.isOpen && e.key === "Escape") {
        this.close();
        if (this.onCancel) this.onCancel();
      }
    });
  }

  // SỬA: Hàm xử lý bàn phím trên mobile
  handleMobileKeyboard(dialogBox) {
    if (!dialogBox) return;
    
    setTimeout(() => {
      const currentViewportHeight = window.innerHeight;
      const viewportDiff = this.initialViewportHeight - currentViewportHeight;
      
      // Nếu viewport height giảm > 150px thì có bàn phím
      if (viewportDiff > 150) {
        const keyboardHeight = viewportDiff;
        const dialogHeight = dialogBox.offsetHeight;
        const availableHeight = currentViewportHeight;
        const spacingFromKeyboard = 80; // 80px cách bàn phím (có thể điều chỉnh 50-100px)
        
        // Tính toán vị trí dialog để cách bàn phím
        const maxTop = availableHeight - dialogHeight - spacingFromKeyboard;
        const topPosition = Math.max(20, Math.min(maxTop, (availableHeight - dialogHeight) / 2));
        
        // SỬA: Dùng left: 50% và transform để căn giữa chính xác
        dialogBox.style.position = 'fixed';
        dialogBox.style.top = `${topPosition}px`;
        dialogBox.style.left = '50%';
        dialogBox.style.transform = 'translateX(-50%)';
        dialogBox.style.margin = '0';
        dialogBox.style.right = 'auto';
        this.overlay.classList.add('keyboard-open');
      } else {
        // Bàn phím đóng - reset về center (xóa tất cả inline styles)
        dialogBox.style.position = '';
        dialogBox.style.top = '';
        dialogBox.style.left = '';
        dialogBox.style.right = '';
        dialogBox.style.transform = '';
        dialogBox.style.margin = '';
        dialogBox.style.width = '';
        this.overlay.classList.remove('keyboard-open');
      }
    }, 300);
  }

  open() {
    this.overlay.classList.add("active");
    this.isOpen = true;
    this.initialViewportHeight = window.innerHeight;
    this.focus();
  }

  focus() {
    const browserWidth = window.innerWidth;
    const isMobile = browserWidth <= 480;

    if (!isMobile) {
      setTimeout(() => {
        const input = this.overlay.querySelector(".dialog-number-input-input");
        if (input) input.focus();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if(input) {
              input.type = "text";
              input.focus();
              const len = input.value.length;
              input.setSelectionRange(len, len);
              input.type = "number";
            }
          });
        });
      }, 300);
    }
  }

  close() {
    this.overlay.classList.remove("active");
    this.overlay.classList.remove('keyboard-open');
    this.isOpen = false;
    document.body.classList.remove('keyboard-open');
    document.body.style.height = this.originalBodyHeight;
    document.body.style.overflow = this.originalBodyOverflow;
    
    // SỬA: Remove resize listener
    if (this.viewportResizeHandler) {
      window.removeEventListener('resize', this.viewportResizeHandler);
    }

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    setTimeout(() => {
      const targetSizeSelect = __getSelectByKey("target-size");
      if(!targetSizeSelect.dataset.value || targetSizeSelect.dataset.value === '') {
        setCustomSelectValue(targetSizeSelect, "");
        APP_STATE.target_size = undefined;
        hideDisableOverlay();
      }
      else {
        showDisableOverlay();
      }
    }, 50)
  }

  handleSubmit() {
    const input = this.overlay.querySelector(".dialog-number-input-input");
    const errorDiv = this.overlay.querySelector(".dialog-number-input-error");
    
    if (!input) return;
    
    const value = parseInt(input.value);
    
    if (isNaN(value) || value < 1 || value > 2000) {
      errorDiv.classList.remove("hidden");
      return;
    }
    else {
      showDisableOverlay();
    }
    
    errorDiv.classList.add("hidden");
    this.close();
    
    if (this.onSubmit) {
      this.onSubmit(value);
    }
  }
}
