class ActionSheet {
  constructor({
    options = [],
    onSelect = null,
  } = {}) {
    this.options = options;
    this.onSelect = onSelect;

    const style = document.createElement("style");
    style.textContent = `
    .action-sheet-overlay {
      position: fixed;
      display: none;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      align-items: flex-end;
      justify-content: center;
      background: rgba(28, 23, 23, 0.4);
      z-index: 10004;
    }
    .action-sheet-overlay.active {
      display: flex;
    }
    .action-sheet-box {
      background-color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      border-radius: 10px 10px 0 0;
      width: 100%;
      height: auto;
      width: 100%;
      overflow: hidden;
      animation: bounce 0.1s ease-in-out 1;
    }

    @keyframes bounce {
      0% {
        transform: translateY(100%);
      }
      100% {
        transform: translateY(0);
      }
    }
    
    .action-sheet-row {
      width: 100%;
      padding: 15px;
      text-align: center;
      border-bottom: 1px solid #EFEFEF;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: #000;
    }

    .action-sheet-row > img {
      width: 16px;
      height: 16px;
      vertical-align: middle;
      margin-right: 10px;
    }
  `;
    document.head.appendChild(style);

    this.overlay = document.createElement("div");
    this.overlay.className = "action-sheet-overlay";

    let template = `
      <div class="action-sheet-box">

      </div>
    `;

    this.overlay.innerHTML = template;
    const wheelHandler = createPreventBodyScrollHandler('.action-sheet-overlay', '.action-sheet-box');
    window.addEventListener('wheel', wheelHandler, { passive: false });

    this._bindEvents();

    this.renderOptions();

    document.body.appendChild(this.overlay);
  }

  renderOptions() {
    var box = this.overlay.querySelector(".action-sheet-box");
    box.innerHTML = "";

    this.options.forEach((option, index) => {
      let itemDiv = document.createElement("div");
      itemDiv.className = "action-sheet-row";
      itemDiv.onclick = () => {
        this.close();
        if (this.onSelect) this.onSelect(index, option);
      }
      let template = `
        <img src="${option.icon}" alt=""/>
        ${option.label}
      `;

      itemDiv.innerHTML = template;
      
      box.appendChild(itemDiv);
    });
  }

  _bindEvents() {
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
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
    const wheelHandler = createPreventBodyScrollHandler('.action-sheet-overlay', '.action-sheet-box');
    window.removeEventListener('wheel', wheelHandler, { passive: false });
  }
}
