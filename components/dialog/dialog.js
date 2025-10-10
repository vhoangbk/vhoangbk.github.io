let loadingDialog = null;
let progressDialog = null;

function showLoadingDialog(title) {
    if (loadingDialog == null || loadingDialog.isOpen == false) {
        loadingDialog = new LoadingDialog({
        element: document.getElementById('mainContainer'),
        message: title || 'Loading...',
      });
        loadingDialog.open();
    }
}

function hideLoadingDialog() {
    if (loadingDialog) loadingDialog.close()
}

function showAppError(message) {
    const dialog = new InfoDialog({
        element: document.getElementById('mainContainer'),
        message: message || 'An unknown error occurred.',
        cancelText: 'Close',
        onClose: () => {},
      });
    dialog.open();
}

function showNumberInputDialog(title, onSubmit, onCancel) {
    const dialog = new NumberInputDialog({
        element: document.getElementById('mainContainer'),
        message: 'Enter the target size expected',
        onCancel: () => {
            if (onCancel) onCancel()
        },
        onSubmit: (val) => {
            if (onSubmit) onSubmit(val);
        }
    })
    dialog.open()
}

function showProgressDialog(percent = 0, timeLeft = 0, onCancel) {
    progressDialog = new ProgressDialog({
        element: document.getElementById('mainContainer'),
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

function showVideoDetailDialog(file_info, onSave) {
    const dialog = new VideoCompleteDialog({
        element: document.getElementById('mainContainer'),
        file_info: file_info,
        onSave: () =>  {
            if (onSave) onSave(decodeURIComponent(file_info.blob_url),file_info.mediaCode=='vp9'?'output.webm':'output.mp4');
        },
        closeText: "Close",
        saveText: "Save",
      });
    dialog.open();
}

function showAboutDialog() {
    const dialog = new AboutDialog({
        element: document.getElementById('mainContainer'),
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