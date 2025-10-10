class NumberInputDialog {
  constructor({
    element = null,
    message = "",
    onSubmit = null,
    onCancel = null,
  } = {}) {
    this.element = element;
    this.message = message;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-number-input-overlay";

    fetch('components/number-input/number-input.html')
      .then(res => res.text())
      .then(html => {
        this.overlay.innerHTML = html.replace('${message}', this.message);
        if (this.element) {
          this.element.style.position = "relative";
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
    const btnSubmit = this.overlay.querySelector(".dialog-number-input-summit");
    const errorDiv = this.overlay.querySelector(".dialog-number-input-error");

    if (btnCancel) {
      btnCancel.addEventListener("click", () => {
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

    if (btnSubmit && input && errorDiv) {
      btnSubmit.addEventListener("click", () => {
        const val = Number(input.value);
        if (this.validate(val)) {
          this.close();
          if (this.onSubmit) this.onSubmit(val);
        } else {
          errorDiv.classList.remove('hidden');
          this.focus();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (this.isOpen && e.key === "Escape") {
        this.close();
        if (this.onCancel) this.onCancel();
      }
    });
  }

  validate(val) {
    return val >= 1 && val <= 2000;
  }

  open() {
    this.overlay.classList.add("active");
    this.isOpen = true;
    this.focus();
  }

  focus() {
    setTimeout(() => {
      const input = this.overlay.querySelector(".dialog-number-input-input");
      if (input) input.focus();
    }, 300);
  }

  close() {
    this.overlay.classList.remove("active");
    this.isOpen = false;
  }

  destroy() {
    this.overlay.remove();
  }
}