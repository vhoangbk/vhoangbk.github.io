// ✅ Detect scroll gesture vs tap để cho phép scroll trên interactive elements
(function() {
  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartTime = 0;
  const SCROLL_THRESHOLD = 2; // ✅ Giảm xuống 2px để detect rất sớm
  const TAP_TIME_THRESHOLD = 200;
  
  // ✅ Track elements đang được touch
  let touchedElement = null;
  let isScrolling = false;
  let wasFocused = false;
  let focusedElement = null;
  let scrollContainer = null;
  let initialTouchY = 0;
  let isSelectElement = false; // ✅ Track xem có phải select không
  
  // ✅ Function để tìm scrollable container
  function findScrollableContainer(element) {
    if (!element) return null;
    
    let current = element;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      const overflow = style.overflow;
      
      if (
        (overflowY === 'auto' || overflowY === 'scroll' || overflow === 'auto' || overflow === 'scroll') &&
        current.scrollHeight > current.clientHeight
      ) {
        return current;
      }
      
      current = current.parentElement;
    }
    
    return window;
  }
  
  // ✅ Function để manually scroll container
  function scrollContainerBy(container, deltaY) {
    if (container === window || container === document || container === document.documentElement) {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      window.scrollTo(0, currentScroll - deltaY);
    } else if (container && container.scrollTop !== undefined) {
      container.scrollTop = container.scrollTop - deltaY;
    }
  }
  
  // ✅ Check nếu là select element
  function isSelectOrSelectChild(element) {
    if (!element) return false;
    return element.tagName === 'SELECT' || 
           element.classList.contains('app-config-select') ||
           element.closest('select, .app-config-select') !== null;
  }
  
  document.addEventListener('touchstart', function(e) {
    const touch = e.touches[0];
    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
    initialTouchY = touch.clientY;
    touchStartTime = Date.now();
    touchedElement = e.target;
    isScrolling = false;
    
    // ✅ Check nếu là select element
    isSelectElement = isSelectOrSelectChild(touchedElement);
    
    // ✅ Tìm scrollable container
    scrollContainer = findScrollableContainer(touchedElement);
    
    // ✅ Lưu element đang focus
    focusedElement = document.activeElement;
    wasFocused = focusedElement && (
      focusedElement.tagName === 'INPUT' ||
      focusedElement.tagName === 'SELECT' ||
      focusedElement.tagName === 'TEXTAREA' ||
      focusedElement.classList.contains('app-config-select')
    );
    
    // ✅ Nếu là select và không trong modal, tạm thời disable pointer events
    if (isSelectElement && !touchedElement.closest('.mtcv-container.mtcv-show')) {
      // ✅ Không prevent default ở đây, nhưng sẽ prevent ngay khi có movement
    }
  }, { passive: true });
  
  document.addEventListener('touchmove', function(e) {
    if (!touchedElement || !scrollContainer) return;
    
    const touch = e.touches[0];
    const touchY = touch.clientY;
    const touchX = touch.clientX;
    const deltaY = touchY - initialTouchY;
    const deltaX = touchX - touchStartX;
    const absDeltaY = Math.abs(deltaY);
    const absDeltaX = Math.abs(deltaX);
    
    // ✅ Check nếu là interactive element
    const isInteractive = touchedElement.matches('select, input, button, .app-config-select, .app-config-advenced-button, textarea') || isSelectElement;
    
    // ✅ Nếu di chuyển bất kỳ (dù nhỏ), prevent default cho select để tránh dropdown mở
    if (isSelectElement && !touchedElement.closest('.mtcv-container.mtcv-show')) {
      if (absDeltaY > 1 || absDeltaX > 1) {
        // ✅ Prevent default ngay khi có movement để tránh select dropdown mở
        e.preventDefault();
        e.stopPropagation();
        
        // ✅ Nếu di chuyển đủ xa theo chiều dọc, scroll
        if (absDeltaY > SCROLL_THRESHOLD && absDeltaY > absDeltaX) {
          if (!isScrolling) {
            isScrolling = true;
            
            // ✅ Blur select element
            if (touchedElement && (touchedElement.tagName === 'SELECT' || touchedElement.classList.contains('app-config-select'))) {
              touchedElement.blur();
            }
            
            // ✅ Blur active element
            const activeElement = document.activeElement;
            if (activeElement && (
              activeElement.tagName === 'SELECT' ||
              activeElement.classList.contains('app-config-select')
            )) {
              activeElement.blur();
            }
          }
          
          // ✅ Scroll container
          scrollContainerBy(scrollContainer, deltaY);
          initialTouchY = touchY;
        }
        return; // ✅ Return sớm để không xử lý tiếp
      }
    }
    
    // ✅ Xử lý cho các interactive elements khác
    if (absDeltaY > SCROLL_THRESHOLD && absDeltaY > absDeltaX) {
      if (!isScrolling) {
        isScrolling = true;
        
        const activeElement = document.activeElement;
        if (activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.classList.contains('app-config-select')
        )) {
          activeElement.blur();
        }
        
        if (touchedElement && (
          touchedElement.tagName === 'INPUT' ||
          touchedElement.tagName === 'SELECT' ||
          touchedElement.tagName === 'TEXTAREA' ||
          touchedElement.classList.contains('app-config-select')
        )) {
          touchedElement.blur();
        }
      }
      
      if (isInteractive && !touchedElement.closest('.mtcv-container.mtcv-show')) {
        e.preventDefault();
        e.stopPropagation();
        scrollContainerBy(scrollContainer, deltaY);
        initialTouchY = touchY;
      }
    } else if (isInteractive && !touchedElement.closest('.mtcv-container.mtcv-show')) {
      if (absDeltaY > 1 || absDeltaX > 1) {
        e.preventDefault();
      }
    }
  }, { passive: false });
  
  document.addEventListener('touchend', function(e) {
    const touch = e.changedTouches[0];
    const touchY = touch.clientY;
    const touchX = touch.clientX;
    const deltaY = Math.abs(touchY - initialTouchY);
    const deltaX = Math.abs(touchX - touchStartX);
    
    // ✅ Nếu đã scroll hoặc di chuyển, không trigger click/focus
    if (isScrolling || (deltaY > SCROLL_THRESHOLD && deltaY > deltaX) || (isSelectElement && (deltaY > 1 || deltaX > 1))) {
      if (touchedElement) {
        e.preventDefault();
        e.stopPropagation();
        
        // ✅ Đảm bảo không focus select
        if (touchedElement && (
          touchedElement.tagName === 'INPUT' ||
          touchedElement.tagName === 'SELECT' ||
          touchedElement.tagName === 'TEXTAREA' ||
          touchedElement.classList.contains('app-config-select')
        )) {
          touchedElement.blur();
        }
        
        // ✅ Prevent click event bằng cách dispatch một fake event và cancel nó
        setTimeout(() => {
          if (touchedElement && (touchedElement.tagName === 'SELECT' || touchedElement.classList.contains('app-config-select'))) {
            touchedElement.blur();
          }
        }, 0);
      }
    } else {
      // ✅ Nếu không scroll (là tap), cho phép focus
      const isInteractive = touchedElement && touchedElement.matches('select, input, .app-config-select, textarea');
      if (isInteractive && !touchedElement.closest('.mtcv-container.mtcv-show')) {
        // ✅ Cho phép focus
      }
    }
    
    // ✅ Reset
    touchedElement = null;
    isScrolling = false;
    wasFocused = false;
    focusedElement = null;
    scrollContainer = null;
    initialTouchY = 0;
    isSelectElement = false;
  }, { passive: false });
  
  // ✅ Prevent focus và click trên select khi scroll
  document.addEventListener('focusin', function(e) {
    if (isScrolling) {
      const target = e.target;
      if (target && (
        target.tagName === 'SELECT' ||
        target.classList.contains('app-config-select')
      )) {
        setTimeout(() => {
          if (isScrolling) {
            target.blur();
          }
        }, 0);
      }
    }
  }, true);
  
  // ✅ Prevent mousedown/click trên select nếu đã scroll
  document.addEventListener('mousedown', function(e) {
    if (isScrolling && isSelectElement) {
      const target = e.target;
      if (target && (
        target.tagName === 'SELECT' ||
        target.classList.contains('app-config-select') ||
        target.closest('select, .app-config-select')
      )) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);
  
  document.addEventListener('click', function(e) {
    if (isScrolling && isSelectElement) {
      const target = e.target;
      if (target && (
        target.tagName === 'SELECT' ||
        target.classList.contains('app-config-select') ||
        target.closest('select, .app-config-select')
      )) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);
})();
