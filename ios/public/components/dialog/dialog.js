let loadingDialog = null;
let progressDialog = null;

let isLoaded = false;
window.addEventListener('load', function () {
  isLoaded = true;
});

function getCurrentContainerInfo() {
  const appUI = isDisplayed('.app--container');
  const desktopUI = isDisplayed('.desktop-app-container');
  
  // SỬA: Chỉ check app và desktop, xóa web/mobile
  if (desktopUI) {
    const container = document.getElementById('desktopAppContainer');
    const element = document.querySelector('.desktop-app-container');
    return {
      appUI: false,
      desktopUI: true,
      className: '.desktop-app-container',
      id: 'desktopAppContainer',
      element: element || document.body,
      containerElement: container || document.body
    };
  } else if (appUI) {
    const container = document.getElementById('appContainer');
    const element = document.querySelector('.app--container');
    return {
      appUI: true,
      desktopUI: false,
      className: '.app--container',
      id: 'appContainer',
      element: element || document.body,
      containerElement: container || document.body
    };
  } else {
    // Fallback: thử desktop trước, nếu không có thì app
    const desktopContainer = document.getElementById('desktopAppContainer');
    const desktopElement = document.querySelector('.desktop-app-container');
    if (desktopContainer && desktopElement) {
      return {
        appUI: false,
        desktopUI: true,
        className: '.desktop-app-container',
        id: 'desktopAppContainer',
        element: desktopElement,
        containerElement: desktopContainer
      };
    }
    
    // Fallback cuối cùng: app
    const appContainer = document.getElementById('appContainer');
    const appElement = document.querySelector('.app--container');
    return {
      appUI: true,
      desktopUI: false,
      className: '.app--container',
      id: 'appContainer',
      element: appElement || document.body,
      containerElement: appContainer || document.body
    };
  }
}

function showLoadingDialog(title) {
  // ✅ Bỏ điều kiện isLoaded vì DOM đã có thể sẵn sàng
  const { containerElement, element } = getCurrentContainerInfo();
  loadingDialog = new LoadingDialog({
    element: containerElement,
    elementContent: element,
    message: title || '',
  });
  loadingDialog.open();
}

function hideLoadingDialog() {
  if (loadingDialog) loadingDialog.close()
}

function showAppError(message, type) {
  const { containerElement, element } = getCurrentContainerInfo();
  const el = containerElement || document.body;
  const elContent = element || document.body;
  const dialog = new InfoDialog({
    element: el,
    elementContent: elContent,
    message: message || 'An unknown error occurred.',
    cancelText: 'Close',
    onClose: () => {},
    type: type || 'error',
  });
  dialog.open();
}

function showNumberInputDialog(title, onSubmit, onCancel) {
  const { element } = getCurrentContainerInfo();
  const dialog = new NumberInputDialog({
    element: document.getElementsByTagName('body')[0],
    elementContent: element,
    message: 'Custom target size',
    onCancel: () => {
      if (onCancel) onCancel()
    },
    onSubmit: (val) => {
      APP_STATE.targetSize = val;
      if (onSubmit) onSubmit(val);
    }
  })
  dialog.open()
}

function showProgressDialog(onCancel) {
  const { containerElement, element } = getCurrentContainerInfo();
  progressDialog = new ProgressDialog({
    element: containerElement,
    elementContent: element,
    onClose: onCancel,
  });
  progressDialog.open();
}

function updateProgressDialog(percent, timeLeft) {
  if (progressDialog != null && progressDialog.isOpen) {
    progressDialog.update(percent, timeLeft);
  };
}

function hideProgressDialog() {
  if (progressDialog) progressDialog.close();
}

function showVideoDetailDialog(file_info, fileName, onSave, onClose, saveText, muted = '') {
  const { containerElement, element } = getCurrentContainerInfo();
  const originalFileInfo = APP_STATE.selectedFileInfo;
  
  const dialog = new VideoCompleteDialog({
    element: containerElement,
    elementContent: element,
    file_info: file_info,
    fileName: fileName,
    muted: muted,
    onSave: async () => {
      if (onSave) onSave(decodeURIComponent(file_info.input_url), file_info.mediaCode == 'vp9' ? 'output.webm' : 'output.mp4');
    },
    onClose: () => {
      if (onClose) onClose();
    },
    closeText: "Close",
    saveText: saveText || "Save",
  });
  dialog.open();
}

function includeHtml(url, completed) {
  fetch(url)
    .then(res => res.text())
    .then(html => {
      completed(html)
    })
    .catch(() => {
    });
}

function openVideoPlayerDialog() {
  const { containerElement, element } = getCurrentContainerInfo();
  
  let blob_url = null;
  let shouldRevoke = false;
  
  if (APP_STATE.selectedFile && APP_STATE.selectedFile instanceof File) {
    blob_url = createBlobUrl(APP_STATE.selectedFile);
    shouldRevoke = true;
  } else if (APP_STATE.urlVideo) {
    blob_url = APP_STATE.urlVideo;
  } else {
    console.error('No video file or URL available');
    return;
  }
  
  const dialog = new VideoPlayerDialog({
    element: containerElement,
    elementContent: element,
    url: blob_url,
    poster: APP_STATE.selectedFileInfo ? APP_STATE.selectedFileInfo.thumbnail : "",
  });
  
  setupDialogBlobUrlCleanup(dialog, blob_url, shouldRevoke);
  dialog.open();
}

function openVideoPlayerUrl(url, poster) {
  const { containerElement, element } = getCurrentContainerInfo();
  const dialog = new VideoPlayerDialog({
    element: containerElement,
    elementContent: element,
    url: url,
    poster: poster
  });
  dialog.open();
}
