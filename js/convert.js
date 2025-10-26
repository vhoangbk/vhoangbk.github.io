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

oldTargetSize = '0';
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
    }, () => {
      select.value = oldTargetSize;
    });
  } else {
    oldTargetSize = select.value;
  }
  APP_STATE.targetSize = select.value;
  disableOption(select.value != '' && select.value != 'custom')
}

function disableOption(disable = true) {
  if (disable) {
    document.getElementById('resolutionSelect').value = '';
    populateQualityOptions('None');
    document.getElementById('fpsSelect').value = 'original';
    APP_STATE.qualitySelect = undefined;
    APP_STATE.fpsSelect = undefined;
    APP_STATE.resolutionSelect = undefined;
    showDisableOverlay();
  }
  else {
    hideDisableOverlay();
  }
}

function clickStartConvert() {
  console.log("APP_STATE", APP_STATE.configConvertVideo);
  if (!APP_STATE.selectedFileInfo) {
    alert("Please select a file first!");
    return;
  }

  const obj = createVideoOptions({
    blob_url: APP_STATE.selectedFileInfo.blob_url,
    format_name: APP_STATE.formatSelect,
    trim: !APP_STATE.configConvertVideo?.startTime && !APP_STATE.configConvertVideo?.endTime
      ? undefined : {
        startTime: typeof APP_STATE.configConvertVideo.startTime === 'string'
          ? timeStringToSeconds(APP_STATE.configConvertVideo.startTime)
          : APP_STATE.configConvertVideo.startTime,
        endTime: typeof APP_STATE.configConvertVideo.endTime === 'string'
          ? timeStringToSeconds(APP_STATE.configConvertVideo.endTime)
          : APP_STATE.configConvertVideo.endTime
      },
    crop: !APP_STATE.configConvertVideo ||
      [APP_STATE.configConvertVideo.width, APP_STATE.configConvertVideo.height,
      APP_STATE.configConvertVideo.x, APP_STATE.configConvertVideo.y].some(v => v === undefined || isNaN(v))
      ? undefined : {
        width: makeEven(APP_STATE.configConvertVideo.width),
        height: makeEven(APP_STATE.configConvertVideo.height),
        x: APP_STATE.configConvertVideo.x,
        y: APP_STATE.configConvertVideo.y
      },
    hflip: !APP_STATE.configConvertVideo?.flip ? undefined : APP_STATE.configConvertVideo.flip.horizontal ? 1 : 0,
    vflip: !APP_STATE.configConvertVideo?.flip ? undefined : APP_STATE.configConvertVideo.flip.vertical ? 1 : 0,
    volume_level: APP_STATE.volumeSelect / 100,
    target_size: (APP_STATE.targetSize && APP_STATE.targetSize !== "custom") ? +APP_STATE.targetSize : undefined,
    resolution: APP_STATE.resolutionSelect ? APP_STATE.resolutionSelect : undefined,
    fps: APP_STATE.fpsSelect ? +APP_STATE.fpsSelect : undefined,
    quality: APP_STATE.qualitySelect ? APP_STATE.qualitySelect : undefined,
  });
  console.log("Object convert file", obj);
  convertFileWithOptions(obj);
}