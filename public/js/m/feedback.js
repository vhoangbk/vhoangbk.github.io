function handleFeedback() {
  console.log("handleFeedback called");
  const platform = detectPlatform();
  if (platform.isBeeConvertApp && platform.isAndroid) {
    window.AndroidInterface.feedback();
  }
}

function handleRateApp() {
  console.log("handleRateApp called");
  const platform = detectPlatform();
  if (platform.isBeeConvertApp && platform.isAndroid) {
    window.AndroidInterface.rateApp();
  }
}