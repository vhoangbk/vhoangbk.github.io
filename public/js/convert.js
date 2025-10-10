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

  disableOption(select.value != '0')
}

function disableOption(disable = true){
  document.getElementById('resolutionSelect').disabled = disable;
  document.getElementById('qualitySelect').disabled = disable;
  document.getElementById('fpsSelect').disabled = disable;
  if (disable) {
    document.getElementById('resolutionSelect').value = 'original';
    document.getElementById('qualitySelect').value = 'Auto';
    document.getElementById('fpsSelect').value = 'original';
  }
}