loadVideoEncoderSettings().then(settings => {
  window.app_settings = settings;
});

load_wasm_lib().then(wasm_url => {
  window.wasm_url = wasm_url;
});

function uploadFile() {
  const input = document.getElementById('inputFile');
  if (input) {
    input.click();
  }
}

async function handleFileChange(event) {
  if (event.files && event.files.length > 0) {

    if (!window.app_settings) {
      setTimeout(showLoadingDialog("Loading settings, please wait..."), 300);
      while (!window.app_settings) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      clearTimeout(timer);
      hideLoadingDialog();
    }

    if (!window.wasm_url) {
      let timer = setTimeout(showLoadingDialog("Loading library, please wait..."), 300);
      while (!window.wasm_url) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      clearTimeout(timer);
      hideLoadingDialog();
    }

    showLoadingDialog("Loading video infomation....");
    APP_STATE.urlVideo = URL.createObjectURL(event.files[0]);
    APP_STATE.selectedFileInfo = await getFileInfo(use_file_input ? event.files[0] : APP_STATE.urlVideo);
    APP_STATE.selectedFile = event.files[0];
    APP_STATE.modals.trimCrop = document.querySelector('.mtcv-container');
    
    hideLoadingDialog();
    populateFormatOptions();
    
    if (APP_STATE.selectedFileInfo) {
      APP_STATE.selectedFileInfo.name = event.files[0].name;
      APP_STATE.selectedFileInfo.originalName = event.files[0].originalName ? event.files[0].originalName : event.files[0].name;
      originalVideoSize = {
        width: APP_STATE.selectedFileInfo.width,
        height: APP_STATE.selectedFileInfo.height
      };
    }

    if (typeof enableConvertButton === 'function') {
      enableConvertButton();
    }

    if (typeof showVideoPreview === 'function') {
      showVideoPreview(APP_STATE.selectedFileInfo);
    } else {
      const videoPreview = document.getElementById('videoPreview');
      if (videoPreview) {
        videoPreview.classList.add('show');
      }
    }
    const uploadFileConvert = document.getElementById('uploadFileConvert');
    if (uploadFileConvert) {
      uploadFileConvert.style.display = 'none';
    }

  }
}
