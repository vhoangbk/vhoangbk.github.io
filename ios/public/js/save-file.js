function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  console.log('detectPlatform', userAgent);
  const isIpad = /ipad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isTabletUA = /ipad|tablet|android(?!.*mobile)/i.test(navigator.userAgent);
  const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  const isTablet = isIpad || isTabletUA;
  const isMobile = isMobileUA && !isTablet;
  const isDesktop = !isMobile && !isTablet;
  const isBeeConvertApp = /beeconvertapp/i.test(userAgent);

  return {
    isMobile: isMobile,
    isTablet: isTablet,
    isDesktop: isDesktop,
    isBeeConvertApp: isBeeConvertApp,
    isIOS: /iphone|ipod|ipad/i.test(navigator.userAgent) || isIpad,
    isAndroid: /android/i.test(userAgent),
    isIpad: isIpad,
    isSafari: /safari/i.test(userAgent) && !/chrome|crios|fxios/i.test(userAgent),
    isChrome: /chrome|crios/i.test(userAgent),
    isFirefox: /firefox|fennec|fxios/i.test(userAgent),
  };
}

async function uploadToServer(data, name) {
  try {
    // const response = await fetch(url);
    // const videoBlob = await response.blob();
    const blob = new Blob([data], { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('video', blob, name);
    
    const uploadResponse = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (uploadResponse.status == 200) {
      const result = await uploadResponse.json();
      console.log('Server upload success:', result.message);
      showBeeToast(result.message || 'Upload successful');
    } else {
      const errorResult = await uploadResponse.json();
      console.error('Server upload failed:', errorResult);
      showBeeToast(errorResult.message || 'Upload failed');
    }
  } catch (error) {
    console.error('Error uploading to server:', error);
    showBeeToast(error.message || 'Upload failed');
  }
}

async function callApiDeleteVideo(itemId) {
  try {
    const formData = new FormData();
    formData.append("id", itemId);
    const res = await fetch("/delete-video", {
      method: "POST",
      body: formData,
    });
    console.log(res);
  } catch (error) {
    console.log(error);
  }
}