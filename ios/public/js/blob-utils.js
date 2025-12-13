/**
 * Blob URL Management Utilities
 * Tối ưu hóa việc quản lý URL.createObjectURL và URL.revokeObjectURL
 */

// Global tracking cho blob URLs (optional, để cleanup khi cần)
window._blobUrlRegistry = window._blobUrlRegistry || new Set();

/**
 * Tạo blob URL an toàn với auto-tracking
 * @param {Blob|File} blob - Blob hoặc File object
 * @param {boolean} track - Có track URL để cleanup sau không (default: false)
 * @returns {string} Blob URL hoặc null nếu lỗi
 */
function createBlobUrl(blob, track = false) {
  if (!blob) {
    console.warn('createBlobUrl: blob is null or undefined');
    return null;
  }
  
  try {
    const url = URL.createObjectURL(blob);
    if (track) {
      window._blobUrlRegistry.add(url);
    }
    return url;
  } catch (error) {
    console.error('Error creating blob URL:', error);
    return null;
  }
}

/**
 * Revoke blob URL an toàn (với try-catch)
 * @param {string} url - Blob URL cần revoke
 * @returns {boolean} true nếu revoke thành công
 */
function revokeBlobUrl(url) {
  console.log('revokeBlobUrl: url 1', url);
  if (!url || !url.startsWith('blob:')) {
    return false;
  }
  
  try {
    console.log('revokeBlobUrl: url 2', url);
    URL.revokeObjectURL(url);
    window._blobUrlRegistry.delete(url);
    return true;
  } catch (error) {
    console.warn('Error revoking blob URL:', error);
    return false;
  }
}

/**
 * Revoke nhiều blob URLs cùng lúc
 * @param {string[]} urls - Mảng các blob URLs
 */
function revokeBlobUrls(urls) {
  if (!Array.isArray(urls)) return;
  
  urls.forEach(url => {
    if (url && url.startsWith('blob:')) {
      revokeBlobUrl(url);
    }
  });
}

/**
 * Cleanup tất cả tracked blob URLs
 */
function cleanupAllBlobUrls() {
  window._blobUrlRegistry.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Error revoking tracked blob URL:', e);
    }
  });
  window._blobUrlRegistry.clear();
}

/**
 * Download blob/file với auto-revoke sau khi download
 * @param {Blob|File} blob - Blob hoặc File để download
 * @param {string} filename - Tên file
 * @param {number} revokeDelay - Delay trước khi revoke (ms, default: 100)
 * @returns {boolean} true nếu download thành công
 */
function downloadBlob(blob, filename, revokeDelay = 100) {
  if (!blob || !filename) {
    console.warn('downloadBlob: blob or filename is missing');
    return false;
  }
  
  const url = createBlobUrl(blob);
  if (!url) return false;
  
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Auto-revoke sau khi download
    setTimeout(() => revokeBlobUrl(url), revokeDelay);
    return true;
  } catch (error) {
    console.error('Error downloading blob:', error);
    revokeBlobUrl(url);
    return false;
  }
}

/**
 * Tạo blob URL từ File với auto-revoke khi thay đổi
 * Quản lý URL cũ tự động
 * @param {File} file - File object
 * @param {Object} state - State object để lưu URL (ví dụ: APP_STATE)
 * @param {string} stateKey - Key trong state để lưu URL (ví dụ: 'urlVideo')
 * @returns {string} Blob URL mới hoặc null nếu lỗi
 */
function createManagedBlobUrl(file, state, stateKey) {
  if (!file || !state || !stateKey) {
    console.warn('createManagedBlobUrl: missing parameters');
    return null;
  }
  
  // Revoke URL cũ nếu có
  const oldUrl = state[stateKey];
  if (oldUrl && oldUrl.startsWith('blob:')) {
    revokeBlobUrl(oldUrl);
  }
  
  // Tạo URL mới
  const newUrl = createBlobUrl(file);
  if (newUrl) {
    state[stateKey] = newUrl;
  }
  
  return newUrl;
}

/**
 * Wrapper cho dialog với auto-revoke khi đóng
 * @param {Object} dialog - Dialog instance
 * @param {string} blobUrl - Blob URL cần revoke khi dialog đóng
 * @param {boolean} shouldRevoke - Có nên revoke không (default: true)
 */
function setupDialogBlobUrlCleanup(dialog, blobUrl, shouldRevoke = true) {
  if (!dialog || !blobUrl || !shouldRevoke) return;
  
  const originalClose = dialog.close.bind(dialog);
  dialog.close = function() {
    // Tìm và dừng video element trước khi remove
    const videoEl = dialog.overlay?.querySelector?.('video');
    if (videoEl) {
      videoEl.pause();
      videoEl.src = ''; // Xóa src để ngăn retry
      videoEl.load(); // Reset video element
    }
    
    originalClose();
    
    // Delay revoke một chút để đảm bảo video đã dừng hoàn toàn
    setTimeout(() => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        revokeBlobUrl(blobUrl);
      }
    }, 100);
  };
}

/**
 * Initialize cleanup listeners
 * Tự động cleanup khi page unload
 */
(function initBlobUrlCleanup() {
  // Cleanup khi page unload (beforeunload - tốt nhất cho desktop)
  window.addEventListener('beforeunload', () => {
    cleanupAllBlobUrls();
  });
  
  // Cleanup khi page hide (pagehide - tốt cho mobile và SPA)
  window.addEventListener('pagehide', () => {
    cleanupAllBlobUrls();
  });
})();