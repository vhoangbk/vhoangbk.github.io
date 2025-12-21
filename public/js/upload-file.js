document.addEventListener('DOMContentLoaded', async () => {
  while (typeof get !== 'function') {
    await new Promise(r => setTimeout(r, 50));
  }

  if (typeof loadVideoEncoderSettings === 'function') {
    loadVideoEncoderSettings().then(settings => {
      window.app_settings = settings;
    });
  }


  const platform = detectPlatform();
  // if (!platform.isBeeConvertApp) {
    loadRecentFile();
  // }
  
});

function loadRecentFile() {
  return get("selectedFile").then(file => {
    if (file) {
      var event = { files: [file] };
      const appUI = isDisplayed('.app--container');
      const desktopUI = isDisplayed('.desktop-app-container');
      
      let id;
      if (appUI) {
        const element = document.querySelector('.app-upload-area');
        id = element ? element.id : null;
      } else if (desktopUI) {
        const element = document.querySelector('.desktop-upload-area');
        id = element ? element.id : null;
      } else {
        // Fallback: thử desktop trước
        const desktopElement = document.querySelector('.desktop-upload-area');
        if (desktopElement) {
          id = desktopElement.id;
        } else {
          // Fallback: thử app
          const appElement = document.querySelector('.app-upload-area');
          id = appElement ? appElement.id : null;
        }
      }
      
      if (!id) {
        console.error('Cannot find upload area element');
        return;
      }
      
      handleFileChange(event, id, true).then(() => {
        if (typeof restoreSettings === 'function') {
          setTimeout(() => {
            restoreSettings();
            updateConvertButtonState();
            setTrimCropFlipInfo();
          }, 800);
        } else {
          setTimeout(() => {
            if (typeof hideLoadingDialog === 'function') {
              hideLoadingDialog();
            }
          }, 1000);
        }
      });
    } else {
      console.warn("No selectedFile found in IndexedDB");
      localStorage.removeItem('convert_settings');
      // if (typeof restoreSettings === 'function') {
      //   setTimeout(() => restoreSettings(), 500);
      // }
    }
  });
}

function uploadFile(id) {
  const el = document.getElementById(id);
  const input = el
    ? (el.tagName === 'INPUT' ? el : el.querySelector('input[type="file"]'))
    : null;
  if (input) input.click();
}

async function handleFileChange(event, id, isOldFile = false) {

  const inputFile = document.getElementById(id);
    if (event.files && event.files.length > 0) {

    const platform = detectPlatform();
    // if (!platform.isBeeConvertApp) {
      if (!isOldFile) {
        set("selectedFile", event.files[0]);
      }
    // }

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

    while(isReadyLib === false) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (typeof showLoadingDialog === 'function') {
      showLoadingDialog("Loading video information...");
    }
    clearAllBlobUrls();


    APP_STATE.urlVideo = createBlobUrl(event.files[0], 'urlVideo');
    APP_STATE.selectedFile = event.files[0];
    APP_STATE.selectedFileInfo = await getFileInfo(USE_FILE_INPUT ? event.files[0] : APP_STATE.urlVideo, detectDeviceBySize());
    
    console.log('Selected file info:', APP_STATE.selectedFileInfo); 
    
    // SỬA: Tìm modalTrimCrop dựa trên UI hiện tại (chỉ app và desktop)
    const desktopUI = isDisplayed('.desktop-app-container');
    const appUI = isDisplayed('.app--container');
    
    APP_STATE.modalTrimCrop = document.querySelector('.mtcv-container');
    
    //deleteAllTmpFiles();
    
    // Restore settings TRƯỚC khi populate
    if (isOldFile && typeof restoreSettings === 'function') {
      restoreSettings();
    }
    
    populateFormatOptions();

    if (APP_STATE.selectedFileInfo) {
      APP_STATE.selectedFileInfo.name = event.files[0].name;
      APP_STATE.selectedFileInfo.originalName = event.files[0].originalName ? event.files[0].originalName : event.files[0].name;
      window.originalVideoSize = {
        width: APP_STATE.selectedFileInfo.width,
        height: APP_STATE.selectedFileInfo.height
      };
      // Chỉ set mediaCode nếu chưa có settings lưu
      if (!isOldFile) {
        const mediaCode = APP_STATE.selectedFileInfo.mediaCode;
        if (mediaCode) {
          const formatSelect = __getSelectByKey("format");
          if (formatSelect) {
            setCustomSelectValue(formatSelect, mediaCode);
            updateResolutionOptions();
          }
        }
      }
    }

    if (typeof updateConvertButtonState === 'function') {
      updateConvertButtonState();
    }
    if (typeof showVideoPreview === 'function') {
      showVideoPreview(APP_STATE.selectedFileInfo);
    } else {
      // Desktop: hiện video preview và ẩn upload area
      const desktopUI = isDisplayed('.desktop-app-container');
      if (desktopUI) {
        const videoPreview = document.getElementById('videoPreviewDesktop');
        const uploadArea = document.getElementById('uploadFileDesktop');
        if (videoPreview) {
          videoPreview.style.display = 'block';
          videoPreview.classList.add('show');
        }
        if (uploadArea) {
          uploadArea.classList.add('hidden');
        }
      } else {
        const idVideoPrive = id === 'uploadFileWebMobile' ? 'videoPreviewMobile' : 'videoPreviewWeb';
        const videoPreview = document.getElementById(idVideoPrive);
        if (videoPreview) {
          videoPreview.classList.add('show');
        }
      }
    }
    const uploadFileConvert = document.getElementById(id);
    if (uploadFileConvert) {
      uploadFileConvert.style.display = 'none';
    }
    updateResolutionOptions();
    
    if (isOldFile) {
      setTimeout(() => {
        hideLoadingDialog();
      }, 1000);
    } else {
      setTimeout(() => {
        hideLoadingDialog();
      }, 300);
    }
  }
}
