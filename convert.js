const makeEven = v => 2 * Math.round(v / 2);

function createVideoOptions(options = {}) {
  return {
    blob_url: options.blob_url,
    format_name: options.format_name,
    trim: options.trim ?? undefined,
    crop: options.crop ?? undefined,
    hflip: options.hflip ?? undefined,
    vflip: options.vflip ?? undefined,
    volume_level: options.volume_level ?? undefined,
    fps: options.fps ?? undefined,
    quality: options.quality ?? undefined,
    target_size: options.target_size ?? undefined,
    resolution: options.resolution ?? undefined
  };
}

function convertVideoNow(APP_STATE) {
  console.log("Convert video with state", APP_STATE);
  const obj = createVideoOptions({
    blob_url: APP_STATE.selectedFileInfo.blob_url,
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
    hflip: !APP_STATE.configConvertVideo?.flip
      ? undefined
      : APP_STATE.configConvertVideo.flip.horizontal
      ? 1
      : 0,
    vflip: !APP_STATE.configConvertVideo?.flip
      ? undefined
      : APP_STATE.configConvertVideo.flip.vertical
      ? 1
      : 0,
    volume_level: APP_STATE.volumeSelect / 100,
    target_size:
      APP_STATE.targetSize && APP_STATE.targetSize !== "custom"
        ? +APP_STATE.targetSize
        : undefined,
    resolution: APP_STATE.resolutionSelect
      ? APP_STATE.resolutionSelect
      : undefined,
    fps: APP_STATE.fpsSelect ? +APP_STATE.fpsSelect : undefined,
    quality: APP_STATE.qualitySelect ? APP_STATE.qualitySelect : undefined,
  });

  console.log("Object convert file", obj);
  convertFileWithOptions(obj);
}