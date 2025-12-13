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
  if(!value) {
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
    convertVideoNow();
  // }
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