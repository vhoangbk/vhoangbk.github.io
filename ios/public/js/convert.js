const makeEven = v => 2 * Math.round(v / 2);

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

let oldTargetSize = '0';
function showCustomInput(select) {
  if (select.value === 'custom') {
    showNumberInputDialog('Enter MB:', (newValue) => {
      const exists = Array.from(select.options).some(opt => opt.value == newValue);
      if (exists) {
        select.value = newValue
      } else {
        const option = document.createElement('option');
        option.value = newValue;
        option.textContent = newValue + 'MB';
        select.appendChild(option);
        select.value = newValue;
      }
      oldTargetSize = newValue;
      APP_STATE.targetSize = newValue;
      saveSettings();
      disableOption(true);
    }, () => {
      const targetSize = JSON.parse(localStorage.getItem('convert_settings'));
      if (targetSize) {
        oldTargetSize = targetSize.targetSize || "";
      }
      select.value = oldTargetSize;
      // SỬA: Cập nhật APP_STATE khi cancel
      APP_STATE.targetSize = oldTargetSize;
      saveSettings();
      disableOption(oldTargetSize != '' && oldTargetSize != 'custom');
      const wheelHandler = createPreventBodyScrollHandler('.dialog-number-input-overlay', '.dialog-number-input-box');
      window.removeEventListener('wheel', wheelHandler, { passive: false });
    });
    return;
  } else {
    oldTargetSize = select.value;
  }
  APP_STATE.targetSize = select.value;
  saveSettings();
  disableOption(select.value != '' && select.value != 'custom')
}

function disableOption(disable = true) {
  if (disable) {
    // Dùng __getElementByIdByUI để tương thích với cả app và web
    const resolutionSelect = __getElementByIdByUI('resolutionSelect');
    const fpsSelect = __getElementByIdByUI('fpsSelect');
    
    if (resolutionSelect) {
      resolutionSelect.value = '';
    }
    
    populateQualityOptions('None');
    
    if (fpsSelect) {
      fpsSelect.value = 'original';
    }
    
    APP_STATE.qualitySelect = undefined;
    APP_STATE.fpsSelect = undefined;
    APP_STATE.resolutionSelect = undefined;
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
  console.log("clickStartConvert", APP_STATE.selectedFileInfo);
  if (!APP_STATE.selectedFileInfo) {
    console.log("clickStartConvert", 1);
    alert("Please select a file first!");
    return;
  }

  console.log("clickStartConvert", 2);
  // show quảng cáo nếu là mobile
  const platform = detectPlatform();
  console.log("clickStartConvert 2 -> 1");
  if (!inAppPurchased && platform.isBeeConvertApp) {
    console.log("clickStartConvert 2 -> 2");
    if (platform.isBeeConvertApp && platform.isAndroid) {
      console.log("clickStartConvert 2 -> 3");
      window.AndroidInterface.showAds();
    } else if (platform.isBeeConvertApp && platform.isIOS) {
      console.log("clickStartConvert 2 -> 4");
      window.webkit.messageHandlers.BeeBridge.postMessage({ action: "showAds" });
    } else {
      console.log("clickStartConvert", 3);
      convertVideoNow();
    }
  } else {
    console.log("clickStartConvert", 4);
    convertVideoNow();
  }
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
    fps: APP_STATE.fpsSelect ? +APP_STATE.fpsSelect : undefined,
    quality: APP_STATE.qualitySelect ? APP_STATE.qualitySelect : undefined,
    audioBitrate: APP_STATE.selectedFileInfo.audioBitRate ? `${APP_STATE.selectedFileInfo.audioBitRate}k` : '128k'
  });

 // debugger  ;
  console.log("Object convert file", obj);
  convertFileWithOptions_New(obj);
}