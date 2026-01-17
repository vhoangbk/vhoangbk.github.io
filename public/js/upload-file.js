document.addEventListener('DOMContentLoaded', async () => {
  while (typeof get !== 'function') {
    await new Promise(r => setTimeout(r, 50));
  }




  const platform = detectPlatform();
  // if (!platform.isBeeConvertApp) {
  loadRecentFile();
  // }

});

function loadRecentFile() {
  // Ưu tiên load Blob (nhỏ/vừa) trước vì nó không cần hỏi quyền
  return get("selectedFile").then(blob => {
    if (blob) {
      console.log("Restoring file from IndexedDB Blob...");
      loadFileIntoUI(blob);
    } else {
      // Nếu không có Blob, thử check FileHandle (file to)
      return get("selectedFileHandle").then(async (handle) => {
        if (handle && handle.kind === 'file') {
          const perm = await handle.queryPermission({ mode: 'read' });
          if (perm === 'granted') {
            try {
              const file = await handle.getFile();
              loadFileIntoUI(file);
            } catch (e) { clearRecentFile(); }
          } else {
            showRestoreButton(handle);
          }
        }
      });
    }
  });
}

function loadRecentFile() {
  // 1. Try loading Blob first (Silent restore for <500MB)
  return get("selectedFile").then((file) => {
    if (file) {
      console.log("📂 Restored file from IndexedDB (Blob)");
      loadFileIntoUI(file);
      return;
    }

    // 2. If no Blob, try FileSystemHandle (Large files)
    return get("selectedFileHandle").then(async (handle) => {
      if (handle && handle.kind === 'file') {
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          try {
            const file = await handle.getFile();
            loadFileIntoUI(file);
          } catch (e) {
            console.error(e);
            clearRecentFile();
          }
        } else {
          // Requires permission (Prompt)
          showRestoreButton(handle);
        }
      }
    });
  });
}

function showRestoreButton(handle) {
  const appUI = isDisplayed('.app--container');
  const containerSelector = appUI ? '.app-upload-area' : '.desktop-upload-area';
  const container = document.querySelector(containerSelector);

  // Nếu upload area đang ẩn (do đang ở màn hình khác), ta vẫn nên hiện thông báo
  // Hoặc đơn giản là hiện một cái Toast hoặc Banner ở góc.
  // Cách đơn giản nhất: Tạo một banner nhỏ phía trên cùng.

  let restoreBanner = document.getElementById('restore-file-banner');
  if (restoreBanner) return; // Đã hiện rồi

  restoreBanner = document.createElement('div');
  restoreBanner.id = 'restore-file-banner';
  restoreBanner.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; background: #ff9800; color: #fff; padding: 10px; text-align: center; z-index: 10000; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';

  const text = document.createElement('span');
  text.textContent = `Previous session found (${handle.name}). Click here to restore.`;

  const closeBtn = document.createElement('span');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'font-size: 20px; font-weight: bold; padding: 0 10px; cursor: pointer;';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    restoreBanner.remove();
    clearRecentFile();
  };

  restoreBanner.appendChild(text);
  restoreBanner.appendChild(closeBtn);

  restoreBanner.onclick = async () => {
    // Request permission
    try {
      const perm = await handle.requestPermission({ mode: 'read' });
      if (perm === 'granted') {
        try {
          const file = await handle.getFile();
          loadFileIntoUI(file);
          restoreBanner.remove();
          // Fix logic: Clear handle after restore so it doesn't ask again on next reload
          // User must pick a file again to save a new session.
          deleteKey("selectedFileHandle");
        } catch (e) {
          console.error(e);
          alert("Failed to load file. It might have been moved or deleted.");
          clearRecentFile();
          restoreBanner.remove();
        }
      } else {
        console.log("Permission denied");
        clearRecentFile();
        restoreBanner.remove();
      }
    } catch (e) {
      console.error("Error requesting permission:", e);
    }
  };

  document.body.appendChild(restoreBanner);
}

function clearRecentFile() {
  deleteKey("selectedFileHandle");
  deleteKey("selectedFile");
  localStorage.removeItem('convert_settings');
  console.log("Cleared recent file data");
}

function loadFileIntoUI(file) {
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
    const desktopElement = document.querySelector('.desktop-upload-area');
    if (desktopElement) {
      id = desktopElement.id;
    } else {
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
}

function uploadFile(id) {
  // ✅ Thử dùng File System Access API trước để lấy Handle
  const platform = detectPlatform();
  if (window.showOpenFilePicker && !platform.isBeeConvertApp && platform.isDesktop) {
    const opts = {
      types: [{
        description: 'Video Files',
        accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.swf', '.3gp', '.y4m'] }
      }],
      multiple: false
    };

    window.showOpenFilePicker(opts).then(async (handles) => {
      if (handles && handles.length > 0) {
        const handle = handles[0];
        const file = await handle.getFile();

        // Lưu handle vào biến global để handleFileChange có thể đọc và lưu vào DB
        window.currentFileHandle = handle;

        // Giả lập event change của input file
        const event = { files: [file] };
        handleFileChange(event, id);
      }
    }).catch(err => {
      if (err.name === 'AbortError') {
        // User cancel, không làm gì
      } else {
        console.warn("showOpenFilePicker failed, falling back to input click", err);
        // Fallback input click
        const el = document.getElementById(id);
        const input = el
          ? (el.tagName === 'INPUT' ? el : el.querySelector('input[type="file"]'))
          : null;
        if (input) input.click();
      }
    });
  } else {
    // Fallback cho trình duyệt cũ
    const el = document.getElementById(id);
    const input = el
      ? (el.tagName === 'INPUT' ? el : el.querySelector('input[type="file"]'))
      : null;
    if (input) input.click();
  }
}

async function handleFileChange(event, id, isOldFile = false) {

  const inputFile = document.getElementById(id);
  if (event.files && event.files.length > 0) {

    

    if (!window.browser_settings) {
      if (typeof showLoadingDialog === 'function') {
        let timer = setTimeout(showLoadingDialog("Loading settings, please wait..."), 300);
        while (!window.browser_settings) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        clearTimeout(timer);
        hideLoadingDialog();
      } else {
        while (!window.browser_settings) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    if (typeof showLoadingDialog === 'function') {
      showLoadingDialog("Loading video information...");
    }
    clearAllBlobUrls();


    APP_STATE.urlVideo = createBlobUrl(event.files[0], 'urlVideo');
    APP_STATE.selectedFile = event.files[0];
    APP_STATE.selectedFileInfo = await getFileInfo(USE_FILE_INPUT ? event.files[0] : APP_STATE.urlVideo, detectDeviceBySize(), true);

    if (!isOldFile) {
      const file = event.files[0];
      const MAX_BLOB_SIZE = 500 * 1024 * 1024; // 500MB

      if (file.size < MAX_BLOB_SIZE) {
        // Save as Blob for silent restore
        set("selectedFile", file);
        deleteKey("selectedFileHandle"); // Clear handle if switching to blob
        console.log("💾 Saved small file to IndexedDB");
      } else {
        // File too big, use Handle
        deleteKey("selectedFile");
        if (window.currentFileHandle) {
          set("selectedFileHandle", window.currentFileHandle);
          console.log("💾 Saved FileHandle for large file");
        } else {
          console.log("⚠️ Large file but no Handle available (Drag/Drop?)");
        }
      }
    }

    if(APP_STATE.selectedFileInfo == null){
      
      hideLoadingDialog();
      showAppError("Cannot convert this file.", 'error', function () {
        clearRecentFile();
      });
      return;
    }

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
    else {
      handleMissingFileInfo(true);
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

    // Ẩn app-upload-area sau khi upload thành công (mobile UI)
    const appUploadArea = document.getElementById('upload-trigger-app');
    if (appUploadArea) {
      appUploadArea.style.display = 'none';
    }
    const uploadFileConvert = document.getElementById(id);
    if (uploadFileConvert) {
      uploadFileConvert.style.display = 'none';
    }
    updateResolutionOptions();
    populateFPSOptions();

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

function handleMissingFileInfo(show = false) {
  if (APP_STATE.selectedFileInfo && (!APP_STATE.selectedFileInfo.duration || APP_STATE.selectedFileInfo.duration === 0 || !APP_STATE.selectedFileInfo.displaySize || APP_STATE.selectedFileInfo.displaySize == "0 MB")) {
    ['.desktop-advanced-section', '.app-advanced-section'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.style.display = 'none';
    });

    if (show) {
      handleOverlayTargetSize(true);
    }
  }
}

function handleOverlayTargetSize(disable) {
  const disabledColor = '#00000042';
  const normalColor = '#000000';
  const taregrSizeSelect = document.getElementById('overlayTargetSize');
  const OVERLAY_CONFIG = [
    { overlay: taregrSizeSelect, selectId: 'targetSizeSelectDesktop' }
  ];

  OVERLAY_CONFIG.forEach(({ overlay, selectId }) => {
    overlay && (overlay.style.display = disable ? 'block' : 'none');
    const select = __getElementByIdByUI(selectId);
    select && (select.style.color = show ? disabledColor : normalColor);
  });
}