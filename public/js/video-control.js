const slider = document.querySelector('.play-bar-slider');

function updateSliderBackground() {
  const value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
  slider.style.background = `linear-gradient(to right, var(--gray-500) ${value}%, #D9D9D9 ${value}%)`;
}

slider.addEventListener('input', updateSliderBackground);

updateSliderBackground();