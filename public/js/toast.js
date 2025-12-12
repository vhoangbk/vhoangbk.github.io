function showBeeToast(message, duration = 2000) {
  const toastContainer = document.createElement("div");

  toastContainer.style.cssText = `
      display: flex;
      justify-content: center;
      align-items: center;
      position: fixed;
      bottom: 80px;
      width: 100%;
      margin-left: auto;
      margin-right: auto;
      animation: slideInBottom 0.05s ease-in-out;
      z-index: 10007;
  `;

  const toast = document.createElement("div");

  toast.style.cssText = `
      color: #fff;
      padding: 10px 15px;
      font-size: 14px;
      background-color: rgba(0, 0, 0, 0.7);
      border-radius: 8px;
  `;

  toastContainer.appendChild(toast);

  const style = document.createElement("style");
    style.textContent = `
      @keyframes slideInBottom {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideOutBottom {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }
    `;
  document.head.appendChild(style);

  toast.textContent = message;
  document.body.appendChild(toastContainer);

  toastContainer.addEventListener('animationend', (e) => {
    if (e.animationName === 'slideOutBottom') {
      toastContainer.remove();
    }
  });

  setTimeout(() => {
    toastContainer.style.animation = 'slideOutBottom 0.05s ease-in-out';
  }, duration);
}
