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

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-number-input-overlay";

    fetch('/api/templates?file=number-input.html')
      .then(res => res.text())
      .then(html => {
        let template = `
          <div class="dialog-number-input-box" style="box-sizing: border-box; padding-bottom: 0.2rem">
            <div class="dialog-number-input-header">
              Custom target size
               <svg class="dialog-number-input-close" width="0.9rem" height="0.9rem" viewBox="0 0 16 16" fill="none"
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
            <div style="height: 100%; overflow: auto; padding: 0.8rem 0.8rem 0.6rem 0.8rem; display: flex; flex-direction: column; justify-content: space-between;">
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
        
        // Không cần tính toán vị trí phức tạp nữa
        if (this.element) {
          this.element.appendChild(this.overlay);
        }
        this._bindEvents();
      })
      .catch(() => {
      });
  }

  _bindEvents() {
    const input = this.overlay.querySelector(".dialog-number-input-input");
    const btnCancel = this.overlay.querySelector(".dialog-number-input-cancel");
    const btnSubmit = this.overlay.querySelector(".dialog-number-input-save");
    const btnClose = this.overlay.querySelector(".dialog-number-input-close");
    const errorDiv = this.overlay.querySelector(".dialog-number-input-error");
  
    if (input) {
      input.addEventListener('focus', () => {
        document.body.classList.add('keyboard-open');
        setTimeout(() => {
          this.overlay.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
  
      input.addEventListener('blur', () => {
        document.body.classList.remove('keyboard-open');
      });
  
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleSubmit();
        }
      });
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
  
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        this.close();
        if (this.onCancel) this.onCancel();
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

  open() {
    this.overlay.classList.add("active");
    this.isOpen = true;
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
    this.isOpen = false;
    document.body.classList.remove('keyboard-open');
    document.body.style.height = this.originalBodyHeight;

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    setTimeout(() => {
      const targetSizeSelect = document.getElementById('targetSize');
      if(!targetSizeSelect.value) {
        targetSizeSelect.value = '';
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
