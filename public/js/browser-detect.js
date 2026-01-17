/**
 * Detects the user's browser name, version, and OS.
 * @returns {Object} { name, version, os, isMobile }
 */
function getBrowserInfo() {
  var ua = navigator.userAgent;
  var tem;
  var M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];

  // Check for Edge (Legacy) or IE
  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/.exec(ua) || [];
    return { name: 'IE', version: (tem[1] || ''), os: getOS() };
  }

  // Check for Opera
  if (M[1] === 'Chrome') {
    tem = ua.match(/\b(OPR|Edge|Edg)\/(\d+)/);
    if (tem != null) {
      return {
        name: tem[1].replace('OPR', 'Opera').replace('Edg', 'Edge'),
        version: tem[2],
        os: getOS()
      };
    }
  }

  // Check for Firefox, Safari, Chrome
  M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
  if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);

  return {
    name: M[0],
    version: M[1],
    os: getOS(),
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  };
}

/**
 * Detects the Operating System
 */
function getOS() {
  var userAgent = window.navigator.userAgent,
    platform = window.navigator.platform,
    macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
    windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
    iosPlatforms = ['iPhone', 'iPad', 'iPod'],
    os = null;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'Mac OS';
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = 'iOS';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (!os && /Linux/.test(platform)) {
    os = 'Linux';
  }

  return os;
}

// Usage Example:
// const info = getBrowserInfo();
// console.log(`User is on ${info.name} version ${info.version} on ${info.os}`);

/**
 * Checks if the user is using Firefox and suggests using Chrome/Safari/Edge.
 * Shows a toast message that re-appears after 24 hours if dismissed.
 */
function checkAndShowBrowserSuggestion() {
  const info = getBrowserInfo();

  // Only target Firefox users
  if (info.name !== 'Firefox') {
    return;
  }

  const STORAGE_KEY = 'browser_suggestion_dismissed_at';
  const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Check cooldown
  const dismissedAt = localStorage.getItem(STORAGE_KEY);
  if (dismissedAt) {
    const elapsed = Date.now() - parseInt(dismissedAt, 10);
    if (elapsed < COOLDOWN_MS) {
      return; // Still in cooldown
    }
  }

  // Create Banner UI
  const banner = document.createElement('div');
  banner.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #333;
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 15px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 16px;
        max-width: 90%;
        width: 320px;
        opacity: 0; 
        animation: fadeInScale 0.4s ease-out forwards;
    `;

  // Inject keyframes style
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes fadeInScale {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  `;
  document.head.appendChild(style);

  const text = document.createElement('span');
  text.innerHTML = 'For the best performance, we recommend using <br><b>Google Chrome</b> or <b>Safari</b>.';
  text.style.lineHeight = '1.5';

  // Close Button (Accept/Dismiss)
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Got it';
  closeBtn.style.cssText = `
        background: #007bff;
        border: none;
        color: white;
        padding: 10px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        width: 100%;
        margin-top: 5px;
    `;

  closeBtn.onclick = function () {
    // Save dismissal timestamp
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    // Remove banner with animation
    banner.style.opacity = '0';
    banner.style.transform = 'translate(-50%, -50%) scale(0.9)';
    banner.style.transition = 'all 0.3s ease-in';
    setTimeout(() => {
      banner.remove();
      style.remove();
    }, 300);
  };

  banner.appendChild(text);
  banner.appendChild(closeBtn);

  // Add animation keyframes if needed (simplest way is inline or just rely on CSS transitions)
  // Here we inject it to body
  document.body.appendChild(banner);
}

// Auto-run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndShowBrowserSuggestion);
} else {
  checkAndShowBrowserSuggestion();
}

// Usage Example:
// const info = getBrowserInfo();
// console.log(`User is on ${info.name} version ${info.version} on ${info.os}`);
