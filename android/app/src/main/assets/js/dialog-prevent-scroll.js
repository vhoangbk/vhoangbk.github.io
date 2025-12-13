// Prevent scroll khi có dialog/modal mở
(function() {
  let scrollPosition = 0;
  let htmlScrollPosition = 0;
  let hasActiveDialogCache = false;
  let lastCheckTime = 0;
  const CHECK_THROTTLE = 100;
  let scrollEventListenersAdded = false; // ✅ Track xem đã add listeners chưa
  
  // Function để check xem có dialog nào đang active không
  function hasActiveDialog() {
    const now = Date.now();
    if (now - lastCheckTime < CHECK_THROTTLE && hasActiveDialogCache !== null) {
      return hasActiveDialogCache;
    }
    
    lastCheckTime = now;
    hasActiveDialogCache = !!(
      document.querySelector('.dialog-loading-overlay.active') ||
      document.querySelector('.dialog-progress-overlay.active') ||
      document.querySelector('.dialog-video-overlay.active') ||
      document.querySelector('.dialog-video-box.active') ||
      document.querySelector('.dialog-video-player-overlay.active') ||
      document.querySelector('.mtcv-container.mtcv-show') ||
      document.documentElement.classList.contains('mtcv-open') ||
      document.querySelector('.menu-modal.active') ||
      document.querySelector('.desktop-menu-modal.active') ||
      document.querySelector('.premium-overlay.is-open')
    );
    return hasActiveDialogCache;
  }
  
  // Function để prevent scroll - ✅ Lock cả html và body
  function preventScroll() {
    if (!document.body.classList.contains('dialog-open')) {
      scrollPosition = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
      htmlScrollPosition = document.documentElement.scrollTop || 0;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPosition}px`;
      document.body.style.width = '100%';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.height = '100%';
      
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.position = 'fixed';
      document.documentElement.style.width = '100%';
      document.documentElement.style.height = '100%';
      document.documentElement.style.left = '0';
      document.documentElement.style.right = '0';
      document.documentElement.style.top = '0';
      
      document.body.classList.add('dialog-open');
      document.documentElement.classList.add('dialog-open');
      
      // ✅ Chỉ add event listeners khi có dialog
      if (!scrollEventListenersAdded) {
        addScrollPreventListeners();
        scrollEventListenersAdded = true;
      }
    }
  }
  
  // Function để restore scroll - ✅ Restore cả html và body
  function restoreScroll() {
    if (document.body.classList.contains('dialog-open')) {
      const bodyTop = document.body.style.top;
      if (bodyTop && scrollPosition === 0) {
        const parsed = parseInt(bodyTop.replace('px', '').replace('-', ''));
        if (!isNaN(parsed)) {
          scrollPosition = parsed;
          htmlScrollPosition = parsed;
        }
      }
      
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.height = '';
      
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
      document.documentElement.style.left = '';
      document.documentElement.style.right = '';
      document.documentElement.style.top = '';
      
      document.body.classList.remove('dialog-open');
      document.documentElement.classList.remove('dialog-open');
      
      const savedPosition = scrollPosition || htmlScrollPosition || 0;
      if (savedPosition > 0) {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPosition);
          document.documentElement.scrollTop = savedPosition;
          setTimeout(() => {
            if (window.pageYOffset !== savedPosition) {
              window.scrollTo(0, savedPosition);
    }
          }, 50);
        });
      }
      
      scrollPosition = 0;
      htmlScrollPosition = 0;
      
      // ✅ Remove event listeners khi không có dialog
      if (scrollEventListenersAdded) {
        removeScrollPreventListeners();
        scrollEventListenersAdded = false;
      }
    }
  }
  
  // ✅ Function để check và update scroll lock
  function checkAndUpdateScroll() {
    const hasDialog = hasActiveDialog();
    if (hasDialog) {
      preventScroll();
    } else {
      restoreScroll();
    }
  }
  
  // ✅ Prevent scroll event handler - CHỈ chạy khi có dialog
  function preventScrollEvent(e) {
    // ✅ Chỉ prevent scroll nếu không phải trong modal content
    const target = e.target;
    const modalContent = target.closest('.mtcv-content, .mtcv-content-body, .dialog-progress-box, .dialog-loading-box, .dialog-video-box, .dialog-video-player-box');
    if (!modalContent) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }
  
  // ✅ Add event listeners CHỈ khi có dialog
  function addScrollPreventListeners() {
    document.addEventListener('wheel', preventScrollEvent, { passive: false });
    document.addEventListener('touchmove', preventScrollEvent, { passive: false });
  }
  
  // ✅ Remove event listeners khi không có dialog
  function removeScrollPreventListeners() {
    document.removeEventListener('wheel', preventScrollEvent, { passive: false });
    document.removeEventListener('touchmove', preventScrollEvent, { passive: false });
  }
  
  // ✅ Export function để các dialog component có thể gọi trực tiếp
  window.restoreScrollForDialog = function() {
    // ✅ Force check và restore ngay lập tức
    // Invalidate cache để force check lại
    hasActiveDialogCache = null;
    lastCheckTime = 0;
    
    // ✅ Check và restore nếu không còn dialog
    if (!hasActiveDialog()) {
      restoreScroll();
    }
    
    // ✅ Double check sau một chút để đảm bảo
    setTimeout(() => {
      if (!hasActiveDialog()) {
        restoreScroll();
      }
    }, 50);
    setTimeout(() => {
      if (!hasActiveDialog()) {
        restoreScroll();
      }
    }, 100);
  };
  
  // Observer để detect khi overlay active/inactive hoặc bị remove
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target === document.documentElement || target === document.body) {
          shouldCheck = true;
        }
        if (target.classList) {
          const hasDialogClass = target.classList.contains('dialog-loading-overlay') ||
                                target.classList.contains('dialog-progress-overlay') ||
                                target.classList.contains('dialog-video-box') ||
                                target.classList.contains('dialog-video-player-overlay') ||
                                target.classList.contains('mtcv-container') ||
                                target.classList.contains('menu-modal') ||
                                target.classList.contains('desktop-menu-modal') ||
                                target.classList.contains('premium-overlay');
          if (hasDialogClass) {
            const oldValue = mutation.oldValue || '';
            const newValue = target.className || '';
            if (oldValue.includes('active') && !newValue.includes('active')) {
        shouldCheck = true;
            }
          }
        }
      }
      if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === 1 && (
            node.classList?.contains('dialog-loading-overlay') ||
            node.classList?.contains('dialog-progress-overlay') ||
            node.classList?.contains('dialog-video-box') ||
            node.classList?.contains('dialog-video-player-overlay') ||
            node.classList?.contains('mtcv-container') ||
            node.classList?.contains('menu-modal') ||
            node.classList?.contains('premium-overlay')
          )) {
            shouldCheck = true;
          }
        });
      }
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && (
            node.classList?.contains('mtcv-container') ||
            node.classList?.contains('dialog-loading-overlay') ||
            node.classList?.contains('dialog-progress-overlay') ||
            node.classList?.contains('dialog-video-box') ||
            node.classList?.contains('dialog-video-player-overlay')
          )) {
        shouldCheck = true;
          }
        });
      }
    });
    
    if (shouldCheck) {
      hasActiveDialogCache = null;
      checkAndUpdateScroll();
      setTimeout(checkAndUpdateScroll, 50);
      setTimeout(checkAndUpdateScroll, 100);
    }
  });
  
  observer.observe(document.documentElement, { 
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true
  });
  
  // ✅ KHÔNG add event listeners ngay từ đầu
  // Chỉ add khi có dialog (trong preventScroll function)
  
  // Initial check khi page load
  setTimeout(checkAndUpdateScroll, 100);
  setTimeout(checkAndUpdateScroll, 300);
})();
