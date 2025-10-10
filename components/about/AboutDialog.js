class AboutDialog {
  constructor({ element = null, onClose = null } = {}) {
    this.element = element;
    this.onClose = onClose;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-about-overlay";
    fetch('components/about/about.html')
      .then(res => res.text())
      .then(html => {
        this.overlay.innerHTML = html;
        this._bindEvents();
      })
      .catch(() => {
      });

    if (this.element) {
      element.style.position = "relative";
      element.appendChild(this.overlay);
    }
    
  }

  _bindEvents() {
    this.overlay
      .querySelector(".dialog-about-close")
      .addEventListener("click", () => this.close());

    // Click ngoài dialog để đóng
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.close();
        if (this.onClose) this.onClose();
      }
    });

    // Nhấn ESC để đóng
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
    this.overlay.classList.remove("active");
    this.isOpen = false;
  }

  destroy() {
    this.overlay.remove();
  }
}
