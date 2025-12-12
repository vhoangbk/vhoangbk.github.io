class DualRange {
  thumbWidth = 22;
  constructor(idContainer, options = {}) {
    const element = document.getElementById(idContainer);
    if (!element) {
      throw new Error(`Element with id "${idContainer}" not found`);
    }
    this.element = element;
    this.min = options.min ?? 0;
    this.max = options.max ?? 0;
    this.minDefault = options.minDefault ?? 0;
    this.maxDefault = options.maxDefault ?? 0;
    this.onChangeValue = options.onChangeValue;
    this.gap = options.gap ?? 0;
    this.videoElement = options.videoElement;
    this.trackRatio = 0;

    this.boundHandleInput = this.handleInput.bind(this);
    this.addStyle();
    this.render();
    this.updateTrack();
  }

  addStyle = () => {
    const style = document.createElement("style");
    style.innerHTML = `
      .range-container {
        position: relative;
        height: 10px;
      }

      .range-container input[type="range"] {
        position: absolute;
        width: 100%;
        pointer-events: none;
        appearance: none;
        height: 5px;
        margin: 0;
        padding: 0;
        opacity: 1;
        background: transparent;
      }

      .range-container input[type="range"]::-webkit-slider-thumb {
        pointer-events: all;
        width: ${this.thumbWidth}px;
        height: ${this.thumbWidth}px;
        border-radius: 50%;
        background: #ffd134;
        border: 2px solid #f7af1a;
        cursor: pointer;
        appearance: none;
      }
      
      .range-container input[type="range"]:disabled::-webkit-slider-thumb {
        background: #fbe49f;
        border-color: #f8d495;
      }

      .slider-track {
        position: absolute;
        height: 5px;
        border-radius: 2.5px;
        background: #0000004d;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  };

  render = () => {
    let template = `
      <div class="range-container">
        <div class="slider-track"></div>
        <input type="range" class="min-range"/>
        <input type="range" class="max-range"/>
      </div>
    `;

    this.element.innerHTML = template;

    this.minRange = this.element.querySelector(
      ".range-container input[type=range]"
    );
    this.maxRange = this.element.querySelectorAll(
      ".range-container input[type=range]"
    )[1];
    this.track = document.querySelector(".slider-track");

    this.minRange.min = this.min.toString();
    this.minRange.max = this.max.toString();
    this.minRange.value = this.minDefault.toString();

    this.maxRange.min = this.min.toString();
    this.maxRange.max = this.max.toString();
    this.maxRange.value = this.maxDefault.toString();

    this.minRange.addEventListener("input", this.boundHandleInput);
    this.maxRange.addEventListener("input", this.boundHandleInput);

    this.calculateTrackRatio();
    this.updateTrack();
  };

  updateValue = (minValue, maxValue) => {
    if (this.minRange && this.maxRange) {
      let minVal = Number(minValue);
      if (minVal > this.max - this.trackRatio) {
        minVal = this.max - this.trackRatio;
      }
      let maxVal = Number(maxValue);
      if (maxVal - minVal < this.trackRatio) {
        maxVal = minVal + this.trackRatio + this.gap;
      }
      this.minRange.value = minVal.toString();
      this.maxRange.value = maxVal.toString();
      this.updateTrack();
    }
  };

  setDisabled = (isDisabled) => {
    // if (this.minRange && this.maxRange) {
    //   this.minRange.disabled = isDisabled;
    //   this.maxRange.disabled = isDisabled;
    // }
    // this.track.style.opacity = isDisabled ? "0.5" : "1";
    this.track.style.opacity = "1";
  };
  
  calculateTrackRatio = () => {
    if (!this.minRange || !this.maxRange) return;
    const rect = this.minRange.getBoundingClientRect();
    this.trackRatio = Math.floor((this.thumbWidth / rect.width) * (this.max - this.min));
  };

  updateTrack() {
    if (!this.minRange || !this.maxRange || !this.track) return;
    const percent1 =  Number(this.minRange.value) / this.max * 100;
    const percent2 = Number(this.maxRange.value) / this.max * 100;
    this.track.style.background = `linear-gradient(to right, #0000004d ${percent1}%, #ffd134 ${percent1}%, #ffd134 ${percent2}%, #0000004d ${percent2}%)`;
  }

  handleInput(e) {
    if (!this.minRange || !this.maxRange) return;
    const target = e.target;
    const isMinRange = target === this.minRange;

    let minValue = parseInt(this.minRange.value);
    let maxValue = parseInt(this.maxRange.value);

    if (maxValue - minValue <= this.gap + this.trackRatio) {
      if (isMinRange) {
        minValue = Math.max(0, maxValue - (this.gap + this.trackRatio));
        this.minRange.value = minValue.toString();
      } else {
        maxValue = minValue + this.gap + this.trackRatio;
        this.maxRange.value = maxValue.toString();
      }
    }

    this.updateTrack();

    let newMinValue = isMinRange
      ? minValue +
        (minValue / (maxValue - this.trackRatio) * this.trackRatio)
      : minValue;

    let newMaxValue = isMinRange
      ? maxValue
      : maxValue -
        (this.max - maxValue) / (this.max - minValue - this.trackRatio) *
          this.trackRatio;

    this.onChangeValue?.({
      min: (newMinValue / 1000).toFixed(3),
      max: (newMaxValue / 1000).toFixed(3),
      type: isMinRange ? "min" : "max",
    });
  }

  destroy() {
    if (this.minRange) {
      this.minRange.removeEventListener("change", this.boundHandleInput);
    }
    if (this.maxRange) {
      this.maxRange.removeEventListener("change", this.boundHandleInput);
    }
    this.element.innerHTML = "";
  }
}
