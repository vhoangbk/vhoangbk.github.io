function showVideoPreview(selected_file_info) {
  console.log('selected_file_info', selected_file_info);
  const videoTitle = document.querySelector('.video-title');
  if (videoTitle) videoTitle.textContent = selected_file_info.name;
  const videoThumbnail = document.querySelector('.video-thumbnail');
  if (videoThumbnail) videoThumbnail.style.background = `url(${selected_file_info.thumbnail}) center/cover`;
  const videoDetails = document.querySelector('.video-details');
  if (videoDetails) videoDetails.innerHTML = `
      <span>${selected_file_info.mediaCode}</span>
      <span>${selected_file_info.width}x${selected_file_info.height}</span>
      <span>${Math.floor(selected_file_info.lengthInMB)}MB</span>
      <span> ${formatDuration(selected_file_info.duration)}</span>
  `;
  const videoPreview = document.getElementById('videoPreview');
  videoPreview.classList.add('show');

}

function formatDuration(duration) {
  if (!duration || !isFinite(duration)) return '0:00';
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  if (hours > 0) {
    return [hours, minutes, seconds]
      .map(n => n.toString().padStart(2, '0'))
      .join(':');
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

function onCloseVideoPreview() {
  document.getElementById('videoPreview').classList.remove('show');
  document.getElementById('uploadFileConvert').style.display = 'flex';
  document.getElementById("inputFile").value = null;
  APP_STATE.selectedFileInfo = null;
  APP_STATE.selectedFile = null;
  APP_STATE.modals.trimCrop = null;
  APP_STATE.configConvertVideo = null;
  disableConvertButton();
}

function disableConvertButton() {
  const convertBtn = document.querySelector('.convert-button');
  if (convertBtn) {
      APP_STATE.selectedFileInfo = null;
      APP_STATE.selectedFile = null;
      convertBtn.disabled = true;
  }
}