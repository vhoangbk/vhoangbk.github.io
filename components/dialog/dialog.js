let loadingDialog = null;
let progressDialog = null;

let isLoaded = false;
window.addEventListener('load', function() {
  isLoaded = true;
});

function showLoadingDialog(title) {
    if (isLoaded == false) return;
    loadingDialog = new LoadingDialog({
        element: document.getElementById('mainContainer'),
        elementContent: document.querySelector('.content-container'),
        message: title || 'Loading...',
        });
    loadingDialog.open();
}

function hideLoadingDialog() {
    if (loadingDialog) loadingDialog.close()
}

function showAppError(message) {
    const dialog = new InfoDialog({
        element: document.getElementById('mainContainer'),
        elementContent: document.querySelector('.content-container'),
        message: message || 'An unknown error occurred.',
        cancelText: 'Close',
        onClose: () => {},
      });
    dialog.open();
}

function showNumberInputDialog(title, onSubmit, onCancel) {
    const dialog = new NumberInputDialog({
        element: document.getElementsByTagName('body')[0],
        elementContent: document.querySelector('.content-container'),
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
    progressDialog = new ProgressDialog({
        element: document.getElementById('mainContainer'),
        elementContent: document.querySelector('.content-container'),
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

function showVideoDetailDialog(file_info, onSave, onClose) {
    const dialog = new VideoCompleteDialog({
        element: document.getElementById('mainContainer'),
        elementContent: document.querySelector('.content-container'),
        file_info: file_info,
        onSave: () =>  {
            if (onSave) onSave(decodeURIComponent(file_info.blob_url),file_info.mediaCode=='vp9'?'output.webm':'output.mp4');
        },
        onClose: () => {
            if (onClose) onClose();
        },
        closeText: "Close",
        saveText: "Save",
      });
    dialog.open();
}

function showAboutDialog() {
    const dialog = new AboutDialog({
        element: document.getElementById('mainContainer'),
        elementContent: document.querySelector('.content-container'),
        onClose: () => {},
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
    const dialog = new VideoPlayerDialog({
    element: document.getElementById('mainContainer'),
    elementContent: document.querySelector('.content-container'),
    blob_url: URL.createObjectURL(APP_STATE.selectedFile),
    }); 
    dialog.open()
}

