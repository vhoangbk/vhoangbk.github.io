loadVideoEncoderSettings().then(settings => {
  window.app_settings = settings;
});

loadWasmLib().then(wasm_url => {
  window.wasm_url = wasm_url;
});

function loadRecentFile() {
  return get("selectedFile").then(file => {
    if (file) {
      var event = { files: [file] };
      handleFileChange(event, true);
    } else {
      console.warn("No selectedFile found in IndexedDB");
    }
  });
}

loadRecentFile();

function uploadFile() {
  const input = document.getElementById('inputFile');
  if (input) {
    input.click();
  }
}

async function handleFileChange(event, isOldFile = false) {
  if (event.files && event.files.length > 0) {
    if (!isOldFile) {
      set("selectedFile", event.files[0]);
    }

    if (!window.app_settings) {
      if (typeof showLoadingDialog === 'function') {
        let timer = setTimeout(showLoadingDialog("Loading settings, please wait..."), 300);
        while (!window.app_settings) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        clearTimeout(timer);
        hideLoadingDialog();
      } else {
        while (!window.app_settings) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    if (!window.wasm_url) {
      if (typeof showLoadingDialog === 'function') {
        let timer = setTimeout(showLoadingDialog("Loading library, please wait..."), 500);
        while (!window.wasm_url) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        clearTimeout(timer);
        hideLoadingDialog();
      } else {
        while (!window.wasm_url) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    showLoadingDialog("Loading video infomation....");
    APP_STATE.urlVideo = URL.createObjectURL(event.files[0]);
    APP_STATE.selectedFileInfo = await getFileInfo(use_file_input ? event.files[0] : APP_STATE.urlVideo);
    APP_STATE.selectedFile = event.files[0];
    APP_STATE.modalTrimCrop = document.querySelector('.mtcv-container');
    deleteAllTmpFiles();
    hideLoadingDialog();
    populateFormatOptions();

    if (APP_STATE.selectedFileInfo) {
      APP_STATE.selectedFileInfo.name = event.files[0].name;
      APP_STATE.selectedFileInfo.originalName = event.files[0].originalName ? event.files[0].originalName : event.files[0].name;
      originalVideoSize = {
        width: APP_STATE.selectedFileInfo.width,
        height: APP_STATE.selectedFileInfo.height
      };
      const mediaCode = APP_STATE.selectedFileInfo.mediaCode;
      if (mediaCode) {
        const formatSelect = document.getElementById('formatSelect');
        formatSelect.value = mediaCode;
      }
    }

    if (typeof updateConvertButtonState === 'function') {
      updateConvertButtonState();
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
    updateResolutionOptions();
  }
}
