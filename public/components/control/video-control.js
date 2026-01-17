function addControlvideo(elementContainer, videoEl) {

  let timeoutId;
  let buttonPlay;
  let inputRange;

  function backgroundStyle(percent) {
    let themeColor = '--gray-500';
    const appUI = isDisplayed('.app--container');
    themeColor = appUI ? '--theme-color' : '--gray-500';
    return `linear-gradient(to right, var(${themeColor}) 0%, var(${themeColor}) ${percent}%, #D9D9D9 ${percent}%, #D9D9D9 100%)`;
  }

  function hasCSSClass(className) {
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        continue;
      }

      for (const rule of rules) {
        if (rule.selectorText?.includes(`.${className}`)) {
          return true;
        }
      }
    }
    return false;
  }

  let hasStyle = hasCSSClass('input-video-slider');
  if (!hasStyle) {
    const style = document.createElement("style");
    style.textContent = `
    .input-video-slider {
      width: 100%;
      height: 0.16rem;
      border-radius: 0.08rem;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      -webkit-appearance: none;
      accent-color: unset;
      cursor: pointer;
      transition: none;
      background: #D9D9D9;
    }

    .input-video-slider::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: 1.3rem;
      height: 1.3rem;
      background: var(--theme-color);
      border: 2px solid var(--theme-color-line);
      border-radius: 50%;
      cursor: pointer;
      transition: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .input-video-slider::-moz-range-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: 1.3rem;
      height: 1.3rem;
      background: var(--theme-color);
      border: 2px solid var(--theme-color-line);
      border-radius: 50%;
      cursor: pointer;
      transition: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .control-btn {
      width: 24px;
      height: 24px;
      background-image: url('/images/play.svg');
      background-size: cover;
      background-position: center;
      border: none;
      cursor: pointer;
      background-color: transparent;
    }

    #id-control-video {
      padding: 0 var(--common-padding);
    }

    .control-container {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }

    .control-btn.playing {
      background-image: url('/images/pause.svg');
    }

    .control-btn.paused {
      background-image: url('/images/play.svg');
    }
  `;
    document.head.appendChild(style);
  }

  let template = `
    <div class="control-container">
      <input disabled type="button" id="id-control-play" class="control-btn paused" />
      <input disabled class="input-video-slider" style="flex: 1" type="range" min="0" max="${Math.floor(videoEl.duration)}" step="0.1" value="0" id="id-control-seek">
    </div>
  `;

  elementContainer.innerHTML = template;

  setTimeout(() => {
    videoEl.currentTime = 0.1;
  }, 50)

  buttonPlay = document.getElementById("id-control-play")
  inputRange = document.getElementById("id-control-seek");

  inputRange.style.background = backgroundStyle(0);
  inputRange.max = APP_STATE.selectedFileInfo?.duration || 0;

  buttonPlay.addEventListener("click", () => {
    videoEl.paused ? videoEl.play() : videoEl.pause();
  });
  
  inputRange.addEventListener("change", () => {
    clearTimeout(timeoutId);
    videoEl.pause()
    videoEl.currentTime = inputRange.value;
    updateBackgroundControl();
  });

  function updateBackgroundControl() {
    const percent = inputRange.value / inputRange.max * 100;
    inputRange.style.background = backgroundStyle(percent);
  }

  inputRange.addEventListener("input", () => {
    videoEl.pause()
    updateBackgroundControl();
    debounce(() => {
      videoEl.currentTime = inputRange.value;
    }, 300)();
  });

  function debounce(func, delay) {
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  videoEl.addEventListener("timeupdate", () => {
    console.log('timeupdate');
    if (inputRange.value != videoEl.currentTime) {
      inputRange.value = videoEl.currentTime;
      updateBackgroundControl();
    }
  });

  videoEl.addEventListener("play", () => {
    buttonPlay.classList.remove('paused');
    buttonPlay.classList.add('playing');
  });

  videoEl.addEventListener("pause", () => {
    buttonPlay.classList.remove('playing');
    buttonPlay.classList.add('paused');
  });

  videoEl.addEventListener('loadedmetadata', () => {
    inputRange.disabled = false
    buttonPlay.disabled = false
    inputRange.max = Math.floor(videoEl.duration);
  });
}



