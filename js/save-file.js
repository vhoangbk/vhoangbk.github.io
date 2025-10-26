function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;
  
  return {
    isMobile: isMobile && !isTablet,
    isTablet: isTablet,
    isDesktop: isDesktop,
    isIOS: /iphone|ipad|ipod/i.test(userAgent),
    isAndroid: /android/i.test(userAgent),
    isSafari: /safari/i.test(userAgent) && !/chrome/i.test(userAgent),
    isChrome: /chrome/i.test(userAgent),
    isFirefox: /firefox/i.test(userAgent),
  };
}

async function handleFileOutput(url, name, platform = detectPlatform()) {
  console.log('Detected platform:', platform);
  if (platform.isMobile || platform.isTablet) {
    uploadToServer(url, name);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }
}

async function uploadToServer(url, name) {
  try {
    const response = await fetch(url);
    const videoBlob = await response.blob();
    const formData = new FormData();
    formData.append('video', videoBlob, name);
    
    const uploadResponse = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      console.log('Server upload success:', result.message);
      return { success: true, response: result };
    } else {
      const errorResult = await uploadResponse.json();
      console.error('Server upload failed:', errorResult);
      return { success: false, error: errorResult };
    }
  } catch (error) {
    console.error('Error uploading to server:', error);
    return { success: false, error: error.message };
  }
}