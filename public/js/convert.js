const makeEven = v => 2 * Math.round(v / 2);

// Wake Lock helpers
let wakeLock = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      console.log('WakeLock released');
    });
  } catch (err) {
    console.warn('WakeLock error:', err);
  }
}

function releaseWakeLock() {
  try {
    wakeLock?.release();
  } catch (err) {
    console.warn('Release WakeLock error:', err);
  }
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock?.released) {
    requestWakeLock();
  }
});

function getConfigConvertVideo() {
  console.log("APP_STATE", APP_STATE.configConvertVideo);
  if (!APP_STATE.configConvertVideo) {
    return {
      width: 0,
      height: 0,
      x: 0,
      y: 0
    };
  }
  return {
    width: APP_STATE.configConvertVideo.width,
    height: APP_STATE.configConvertVideo.height,
    x: APP_STATE.configConvertVideo.x,
    y: APP_STATE.configConvertVideo.y
  }
}

let oldTargetSize = "0";

function showCustomInput(value, selectBox) {
  const trigger = selectBox.querySelector(".custom-select-trigger");
  const optionsBox = selectBox.querySelector(".custom-options");

  if (value === "custom") {
    showNumberInputDialog("Enter MB:", (newValue) => {
      const exists = [...optionsBox.querySelectorAll(".custom-option")]
        .some(opt => opt.dataset.value == newValue);

      let targetOption = [...optionsBox.querySelectorAll(".custom-option")]
        .find(opt => opt.dataset.value == newValue);

      if (!targetOption) {
        targetOption = document.createElement("div");
        targetOption.className = "custom-option";
        targetOption.dataset.value = newValue;
        targetOption.textContent = `${newValue}MB`;

        const customContainer =
          optionsBox.querySelector(".custom-options-container") ||
          optionsBox;
        customContainer.appendChild(targetOption);
      }

      optionsBox.querySelectorAll(".custom-option").forEach(opt => {
        opt.classList.toggle("selected", opt === targetOption);
      });

      trigger.textContent = `${newValue}MB`;
      selectBox.dataset.value = newValue;

      oldTargetSize = newValue;
      APP_STATE.targetSize = newValue;
      saveSettings();
      disableOption(true);
      if (typeof highlighSelectedOption === "function") {
        highlighSelectedOption(selectBox, String(newValue));
      }
    },
      () => {
        const saved = JSON.parse(localStorage.getItem("convert_settings"));
        oldTargetSize = saved?.targetSize ?? "";

        trigger.textContent = oldTargetSize ? `${oldTargetSize}MB` : "None";
        selectBox.dataset.value = oldTargetSize;

        APP_STATE.targetSize = oldTargetSize;
        saveSettings();

        disableOption(oldTargetSize !== "" && oldTargetSize !== "custom");
      });

    return;
  }

  // NOT custom → update bình thường
  oldTargetSize = value;
  APP_STATE.targetSize = value;
  saveSettings();

  disableOption(value !== "" && value !== "custom");
  if (!value) {
    updateResolutionOptions();
  }
}


function disableOption(disable = true) {
  if (disable) {
    // Dùng __getElementByIdByUI để tương thích với cả app và web
    const resolutionSelect = __getSelectByKey("resolution");
    const fpsSelect = __getSelectByKey("fps");

    if (resolutionSelect) {
      const optionsBox = resolutionSelect.querySelector('.custom-options');
      const trigger = resolutionSelect.querySelector('.custom-select-trigger');

      optionsBox.innerHTML = "";

      const opt = document.createElement("div");
      opt.className = "custom-option";
      opt.dataset.value = "";
      opt.textContent = "None";
      optionsBox.appendChild(opt);

      resolutionSelect.dataset.value = "";
      trigger.textContent = "None";
    }

    populateQualityOptions('None');

    if (fpsSelect) setCustomSelectValue(fpsSelect, "original");

    APP_STATE.qualitySelect = undefined;
    APP_STATE.fpsSelect = undefined;
    APP_STATE.resolutionSelect = undefined;
    APP_STATE.resolutionSelectIsCropped = false;
    showDisableOverlay();
  }
  else {
    hideDisableOverlay();
  }
}

function fromAndroid(event, data) {
  console.log("Event received from Android: ", event, data);
  if (event === 'adShowFailed') {
    convertVideoNow();
  } else if (event === 'adDismissed') {
    convertVideoNow();
  } else if (event === 'PurchaseStatus') {
    inAppPurchased = !!data
  }
}

function fromIOS(event, data) {
  console.log("Event received from iOS: ", event, data);
  if (event === 'adShowFailed') {
    convertVideoNow();
  } else if (event === 'adDismissed') {
    convertVideoNow();
  } else if (event === 'PurchaseStatus') {
    inAppPurchased = data === 'true';
  }

}

function clickStartConvert() {
  console.log("APP_STATE", APP_STATE.configConvertVideo);
  if (!APP_STATE.selectedFileInfo) {
    alert("Please select a file first!");
    return;
  }
  requestWakeLock();

  // show quảng cáo nếu là mobile
  // const platform = detectPlatform();
  // if (!inAppPurchased && platform.isBeeConvertApp) {
  //   if (platform.isBeeConvertApp && platform.isAndroid) {
  //     window.AndroidInterface.showAds();
  //   } else if (platform.isBeeConvertApp && platform.isIOS) {
  //     window.webkit.messageHandlers.BeeBridge.postMessage({ action: "showAds" });
  //   } else {
  //     convertVideoNow();
  //   }
  // } else {
  // --- Tracking Convert Logic (Fire & Forget) ---
  const sendTracking = async () => {
    try {
      let model = "";
      let platformInfo = {};

      // Try to get high entropy values (Android/Chrome mainly)
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        try {
          const uaValues = await navigator.userAgentData.getHighEntropyValues(["model", "platform", "platformVersion", "uaFullVersion"]);
          model = uaValues.model;
          platformInfo = {
            platform: uaValues.platform,
            platformVersion: uaValues.platformVersion,
            uaFullVersion: uaValues.uaFullVersion
          };
        } catch (e) { console.warn("UA Hints error:", e); }
      }

      // Determine Filename
      // Priority: originalName (from upload-file.js) > name > "unknown"
      const realFilename = APP_STATE.selectedFileInfo?.originalName || APP_STATE.selectedFileInfo?.name || "unknown";

      const trackData = {
        video: {
          filename: realFilename,
          extension: realFilename.includes('.') ? realFilename.split('.').pop() : '',
          size: APP_STATE.selectedFileInfo?.size,
          // Add extra device info to video metadata or user metadata if backend supports it
          // Backend expects 'user' object
        },
        convert: {
          format: APP_STATE.formatSelect,
          targetSize: APP_STATE.targetSize,
          success: true
        },
        user: {
          isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
          device: {
            model: model, // Specific model from Client Hints
            ...platformInfo
          }
        }
      };

      fetch('/api/track-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackData),
        keepalive: true
      }).catch(e => { console.warn("Tracking fetch error:", e); });
    } catch (e) { console.warn("Tracking setup error:", e); }
  };

  // Exec async without awaiting
  // sendTracking();
  convertVideoNow();

}

function convertVideoNow() {
  console.warn("APP_STATE.configConvertVideo trước khi gửi lên convert libs ", APP_STATE.configConvertVideo);
  const obj = createVideoOptions({
    input_url: APP_STATE.selectedFileInfo.input_url,
    format_name: APP_STATE.formatSelect,
    trim:
      !APP_STATE.configConvertVideo?.startTime &&
        !APP_STATE.configConvertVideo?.endTime
        ? undefined
        : {
          startTime:
            typeof APP_STATE.configConvertVideo.startTime === "string"
              ? timeStringToSeconds(APP_STATE.configConvertVideo.startTime)
              : APP_STATE.configConvertVideo.startTime,
          endTime:
            typeof APP_STATE.configConvertVideo.endTime === "string"
              ? timeStringToSeconds(APP_STATE.configConvertVideo.endTime)
              : APP_STATE.configConvertVideo.endTime,
        },
    crop:
      !APP_STATE.configConvertVideo ||
        [
          APP_STATE.configConvertVideo.width,
          APP_STATE.configConvertVideo.height,
          APP_STATE.configConvertVideo.x,
          APP_STATE.configConvertVideo.y,
        ].some((v) => v === undefined || isNaN(v))
        ? undefined
        : {
          width: makeEven(APP_STATE.configConvertVideo.width),
          height: makeEven(APP_STATE.configConvertVideo.height),
          x: APP_STATE.configConvertVideo.x,
          y: APP_STATE.configConvertVideo.y,
        },
    hflip: !APP_STATE.configConvertVideo?.flip ? undefined : APP_STATE.configConvertVideo.flip.horizontal ? 1 : 0,
    vflip: !APP_STATE.configConvertVideo?.flip ? undefined : APP_STATE.configConvertVideo.flip.vertical ? 1 : 0,
    volume_level: APP_STATE.volumeSelect / 100,
    target_size:
      APP_STATE.targetSize && APP_STATE.targetSize !== "custom" && APP_STATE.targetSize != 0 ? +APP_STATE.targetSize : undefined,
    resolution: APP_STATE.resolutionSelect ? APP_STATE.resolutionSelect : undefined,
    fps: APP_STATE.fpsSelect && APP_STATE.fpsSelect !== "original" ? +APP_STATE.fpsSelect : undefined,
    quality: APP_STATE.qualitySelect && APP_STATE.qualitySelect !== "None" ? APP_STATE.qualitySelect : undefined,
    audioBitrate: APP_STATE.selectedFileInfo.audioBitRate ? `${APP_STATE.selectedFileInfo.audioBitRate}k` : '128k'
  });

  // debugger  ;
  console.log("Object convert file ==================>: ", obj);

  convertFileWithOptions_New(obj);
}

// --- Unified Tracking Function (Invoked by Bee API) ---
window.sendTrackingLog = async (success, errorMessage = null, outputSize = 0, outputCodec = null) => {
  if (IS_MOBILE_APP) {
    return;
  }
  try {
    let model = "";
    let platformInfo = {};

    // Robust format bytes helper
    const formatBytes = (bytes, decimals = 2) => {
      const num = Number(bytes);
      if (!Number.isFinite(num) || num <= 0) return '0 Bytes';

      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

      const i = Math.floor(Math.log(num) / Math.log(k));

      // Safety bound check
      if (i < 0) return `${num} Bytes`;
      if (i >= sizes.length) return `${parseFloat((num / Math.pow(k, sizes.length - 1)).toFixed(dm))} ${sizes[sizes.length - 1]}`;

      return `${parseFloat((num / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    // Try to get high entropy values (Android/Chrome mainly)
    let brands = [];
    if (navigator.userAgentData) {
      if (navigator.userAgentData.brands) {
        brands = navigator.userAgentData.brands;
      }
      if (navigator.userAgentData.getHighEntropyValues) {
        try {
          const uaValues = await navigator.userAgentData.getHighEntropyValues(["model", "platform", "platformVersion", "uaFullVersion"]);
          model = uaValues.model;
          platformInfo = {
            platform: uaValues.platform,
            platformVersion: uaValues.platformVersion,
            uaFullVersion: uaValues.uaFullVersion
          };
        } catch (e) { console.warn("UA Hints error:", e); }
      }
    }

    // Determine Filename (Priority: originalName > name > "unknown")
    const fileInfo = APP_STATE.selectedFileInfo || {};
    const realFilename = fileInfo.originalName || fileInfo.name || "unknown";

    // --- Data Preparation for Size and Format ---
    // Strict casting to number, default to 0 if invalid
    const rawInputSize = fileInfo.size;
    const inputSize = (rawInputSize !== undefined && rawInputSize !== null && !isNaN(rawInputSize)) ? Number(rawInputSize) : 0;
    const inputCodec = fileInfo.videoCodec || 'unknown';

    // Prepare Size String: "InputMB -> OutputMB"
    // Only show output size if success AND outputSize is valid > 0
    let sizeLog = formatBytes(inputSize);
    if (success && outputSize && !isNaN(outputSize) && outputSize > 0) {
      sizeLog = `${formatBytes(inputSize)} -> ${formatBytes(outputSize)}`;
    }

    // Prepare Format String: "InputCodec -> OutputCodec"
    const targetCodec = outputCodec || APP_STATE.formatSelect || 'unknown';
    let formatLog = targetCodec;

    if (success) {
      // If successful, show transition
      // Handle case where input codec might be unknown
      if (inputCodec && inputCodec !== 'unknown') {
        formatLog = `${inputCodec} -> ${targetCodec}`;
      } else {
        formatLog = targetCodec; // Fallback if input codec unknown
      }
    } else {
      // If failed, attempt to show "h264 -> h265" intent if possible, else just target
      if (inputCodec && inputCodec !== 'unknown' && targetCodec !== 'unknown') {
        formatLog = `${inputCodec} -> ${targetCodec}`;
      } else {
        formatLog = targetCodec;
      }
    }

    const trackData = {
      video: {
        filename: realFilename,
        extension: realFilename.includes('.') ? realFilename.split('.').pop() : '',
        size: sizeLog // Send formatted string directly (Backend stores string/text usually)
      },
      convert: {
        format: formatLog,
        targetSize: APP_STATE.targetSize,
        success: success,
        errorCode: errorMessage
      },
      user: {
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        device: {
          model: model,
          brands: brands, // Send brands for specific browser detection (e.g., Cốc Cốc)
          isCocCoc: !!window.coccoc || (brands && brands.some(b => b.brand.includes('CocCoc') || b.brand.includes('Cốc Cốc'))),
          ...platformInfo
        }
      }
    };

    fetch('/api/track-convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trackData),
      keepalive: true
    }).catch(e => { console.warn("Tracking fetch error:", e); });

  } catch (e) { console.warn("Tracking global error:", e); }
};