/**
 * Lấy thông tin chi tiết về file
 * @param {*} inputUrl: có thể là http||blob:http||file , convert File to Blob Url: var blobURL = URL.createObjectURL(input_file);
 * @returns 
 */
async function getFileInfo(inputUrl) {
    console.log('getFileInfo', inputUrl);
  if (typeof cachedFileInfo === 'undefined') {
    cachedFileInfo = {};
  }


  //debugger;
  if (cachedFileInfo[inputUrl]) {
    return cachedFileInfo[inputUrl];
  }

  let _resolve;
  let cmd_array = ['-loglevel', 'debug', '-i', inputUrl, '-vframes', '1', '-vf', 'scale=160:-1', 'thumbnail.jpg'];
  let result = {};

  let callback = async function (intent) {
    if (intent.data.cmd == CMD_GET_FILE_INFO) {
      try {
        result = await extractInfo(intent.data.value.join('\n'), inputUrl, intent.data.thumbnail);
      } catch (error) {

      }
      _resolve('finish');
    }
  }
  executeCommand(CMD_GET_FILE_INFO, cmd_array, callback, inputUrl);
  await new Promise((resolve, reject) => {
    _resolve = resolve;
  });

  cachedFileInfo[inputUrl] = result;
  return result;
}


async function clickStartConvert() {
    console.log("clickStartConvert", APP_STATE.selectedFileInfo);
    if (!APP_STATE.selectedFileInfo) {
        alert("Please select a file first!");
        return;
    }

    const selectElement = document.getElementById('targetSize');
    const formatSelect = document.getElementById('formatSelect');
    const resolutionSelect = document.getElementById('resolutionSelect');
    const qualitySelect = document.getElementById('qualitySelect');
    const fpsSelect = document.getElementById('fpsSelect');
    const volumeSlider = document.querySelector('.volume-slider');
    var convert_config = {};
    convert_config.blob_url = use_file_input ? APP_STATE.selectedFile : APP_STATE.selectedFileInfo?.blob_url;
    convert_config.format_name = formatSelect?.value || 'h264';

    if (!window.trimCropSettings) {
        window.trimCropSettings = {
            trim: { startTime: 0, endTime: 0 },
            crop: { width: 0, height: 0, x: 0, y: 0 },
            flip: { horizontal: false, vertical: false },
            rotate: { angle: 0 }
        };
    }

    convert_config.trim = {
        startTime: timeToDecimalMinutes(APP_STATE.configConvertVideo?.startTime),
        endTime: timeToDecimalMinutes(APP_STATE.configConvertVideo?.endTime)
    };

    convert_config.rotate = window.trimCropSettings.rotate?.angle || 0;
    const { width, height, x, y } = getConfigConvertVideo();
    if (width && height && x && y) {
        convert_config.crop = {
            width: width,
            height: height,
            x: x,
            y: y
        };
    } else {
        convert_config.crop = {};
    }

    convert_config.hflip = APP_STATE.configConvertVideo?.flipState?.horizontal ? 1 : 0;
    convert_config.vflip = APP_STATE.configConvertVideo?.flipState?.vertical ? 1 : 0;
    convert_config.output_file = window.output_file;
    convert_config.volume_level = volumeSlider ? (volumeSlider.value / 100) : 1;
    console.log("window.trimCropSettings", convert_config);

    const selectedFPS = fpsSelect?.value;
    if (selectedFPS && selectedFPS !== 'original') {
        convert_config.fps = Number(selectedFPS);
    } else {
        convert_config.fps = -1;
    }

    convert_config.quality = qualitySelect?.value || 'Low';

    const selectedResolution = resolutionSelect?.value;

    if (selectedResolution && selectedResolution !== 'original') {
        const resolutionParts = selectedResolution.split('x');
        if (resolutionParts.length === 2) {
            convert_config.resolution = {
                width: Number(resolutionParts[0]),
                height: Number(resolutionParts[1])
            };
        } else {
        }
    } else {
    }
    if (Number(selectElement.value) > 0) {
        convert_config.target_size = Number(selectElement.value);
    }

    console.log("convert-config", convert_config);

    showProgressDialog(0, 0, function () {
        hideProgressDialog();
        executeCommand(CMD_CANCEL_CONVERT, null, null);
    });
    var convertCommands = await convertOptionsToCommand(convert_config);
    if (convertCommands.result) {
        window.output_convertion = Array(convertCommands.cmd_component_array.length).fill(0);

        for (var i = 0; i < convertCommands.cmd_component_array.length; i++) {
            var successCallback = async function (intent) {
                console.log("successCallback:", intent);

                if (intent.data.cmd == CMD_PERFORM_CONVERT) {
                    window.output_convertion[intent.output_index] = {
                        blob_url: intent.data.value[0].blob_url,
                        name: intent.data.value[0].name
                    };
                    if (window.output_convertion.every(item => item !== 0)) {

                        if (window.output_convertion.length == 1 && (window.output_convertion[0].name.endsWith('.mp4') || window.output_convertion[0].name.endsWith('.webm'))) {

                            console.log("time to convert:", Date.now() - start_time_convert);
                            var result = await getFileInfo(window.output_convertion[0].blob_url);
                            hideProgressDialog();
                            showVideoDetailDialog(result, function (url, name) {
                                // Tải về video
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = name;
                                a.click();
                            });
                        } else {
                            var is_h265 = false;
                            var is_vp9 = false;

                            var cmd_component = [];

                            for (var i = 0; i < window.output_convertion.length; i++) {
                                if (window.output_convertion[i].name.endsWith('.h265')) {
                                    is_h265 = true;
                                } else if (window.output_convertion[i].name.endsWith('.webm')) {
                                    is_vp9 = true;
                                }
                                if (window.output_convertion[i].name.endsWith('.h264') || window.output_convertion[i].name.endsWith('.h265')) {
                                    cmd_component.push('-r');
                                    cmd_component.push('' + window.output_file.output_fps);
                                }
                                cmd_component.push('-i');
                                cmd_component.push(window.output_convertion[i].blob_url);
                            }

                            cmd_component.push('-c');
                            cmd_component.push('copy');

                            if (is_h265) {
                                cmd_component.push('-tag:v');
                                cmd_component.push('hvc1');
                            }

                            if (is_vp9) {
                                cmd_component.push('complete-output.webm');
                            } else {
                                cmd_component.push('complete-output.mp4');
                            }

                            window.output_convertion = Array(1).fill(0);
                 
                            var cmd_data = {};
                            cmd_data.output_file = window.output_file;
                            cmd_data.cmd_component = cmd_component;
                            cmd_data.cmd_component_index = 0;
                            executeCommand(CMD_PERFORM_CONVERT, cmd_data, successCallback);
                        }
                    }
                } else if (intent.data.cmd == CMD_UPDATE_PROGRESS) {
                    updateProgressDialog(intent.data.percentage, intent.data.timeLeft);
                } else if (intent.data.cmd == 'conversion_failed') {
                    hideProgressDialog();
                    showAppError('Conversion failed: ' + (intent.data.error || 'Unknown error occurred'));
                }
            }
            var cmd_data = {};
            cmd_data.output_file = convertCommands.output_file;
            cmd_data.cmd_component = convertCommands.cmd_component_array[i];
            cmd_data.cmd_component_index = i;
            window.output_file = convertCommands.output_file;
            executeCommand(CMD_PERFORM_CONVERT, cmd_data, successCallback);
        }

        start_time_convert = Date.now();
    } else {
        showAppError(convertCommands.msg);
    }
}
