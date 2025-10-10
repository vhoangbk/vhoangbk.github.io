class LoadingDialog {
  constructor({
    element = null,
    message = "",
  } = {}) {
    this.element = element;
    this.message = message;

    this.overlay = document.createElement("div");
    this.overlay.className = "dialog-loading-overlay";
    this.overlay.id = "app-loading-dialog";

    fetch('components/loading/loading.html')
      .then(res => res.text())
      .then(html => {
        this.overlay.innerHTML = html.replace('${message}', this.message);
        this._bindEvents();
      })
      .catch(() => {
      });

    if (this.element) {
      element.appendChild(this.overlay);
    }

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
