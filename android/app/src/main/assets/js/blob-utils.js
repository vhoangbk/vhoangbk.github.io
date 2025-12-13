let blobUrlMapUtils = {};
/**
 * Tạo blob URL an toàn với auto-tracking
 * @param {Blob|File} blob - Blob hoặc File object
 * @returns {string} Blob URL hoặc null nếu lỗi
 */
function createBlobUrl(blob, label) {

  if(typeof label === 'string' && blobUrlMapUtils[label]) {
    URL.revokeObjectURL(blobUrlMapUtils[label]);
    delete blobUrlMapUtils[label];
  }
  if (!blob) {
    console.warn('createBlobUrl: blob is null or undefined');
    return null;
  }
  
  try {
    const url = URL.createObjectURL(blob);
    if(typeof label === 'string') {
      blobUrlMapUtils[label] = url;
    }
    console.log('blobUrlMapUtils:', blobUrlMapUtils);
    return url;
  } catch (error) {
    console.error('Error creating blob URL:', error);
    return null;
  }
}

function clearAllBlobUrls() {
  if(typeof blobUrlMapUtils === 'object') {
    for(const label in blobUrlMapUtils) {
      try {
        URL.revokeObjectURL(blobUrlMapUtils[label]);
      } catch(e) {
        console.warn('Error revoking blob URL for label:', label, e);
      }
    }
    blobUrlMapUtils = {};
  }
}