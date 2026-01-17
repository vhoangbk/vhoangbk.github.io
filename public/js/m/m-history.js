const pageSize = 10;
let currentPage = 0;
let isLoading = false;
let canLoadMore = false;

async function getHistoryList() {
  console.log("Loading history from API... page:", currentPage);
  try {
    isLoading = true;
    const res = await fetch(`/get-saved?pageSize=${pageSize}&page=${currentPage}`, { cache: "no-store" });
    isLoading = false;
    if (res.status === 200) {
      let historyList = await res.json();
      canLoadMore = historyList.length == pageSize;
      console.log("data", historyList);
      return historyList
    } else {
      return [];
    }
  } catch (error) {
    isLoading = false;
    console.error("Error loading history from API:", error);
    return [];
  }
}

function formatHistoryTime(timestamp) {
  if (timestamp == null) return "";
  const num = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  if (!Number.isFinite(num)) return "";

  const ms = num < 1e12 ? num * 1000 : num;

  const date = new Date(ms);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${hours}:${minutes} ${day}-${month}-${year}`;
}

function getExtFileName(fileName) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex !== -1 && lastDotIndex < fileName.length - 1) {
    const ext = fileName.substring(lastDotIndex + 1).toLowerCase();
    // Validate extension (only alphanumeric, max 5 chars)
    if (/^[a-z0-9]{1,5}$/.test(ext)) {
      return ext;
    }
  }
}

function bytesToMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function secondsToHMS(seconds) {
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");

  return hh == "00" ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

function convertMediaCode(mediaCode) {
  if (!mediaCode) return "unknown";
  if (mediaCode.includes("vp9")) return "vp9";
  if (mediaCode.includes("avc")) return "h264";
  if (mediaCode.includes("hevc")) return "h265";
  return "av1"
}

function renderItem(item){
  const afterSize = bytesToMB(item.size);
  const thumbUrl = toDataUrlFromThumb(
    item.thumb,
    item.mime || "image/jpeg"
  );
  return `
      <div id="id-cell-${
        item.id
      }" class="app-item-content-history" onclick="showHistoryVideoDialogById(event, '${
        item.id
      }', '${item.displayName}', '${thumbUrl}')" style="gap: 10px; cursor: pointer; position: relative; flex-direction: row; display: flex; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #E2E2E2;">
        <div style="width: 60px; height: 60px; flex-shrink: 0; overflow: hidden; border-radius: 4px; background-color: #f0f0f0; display: flex; align-items: center; justify-content: center;">
          ${item.thumb ? `<img class="lazy" data-src="${thumbUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover;"/>` : `<img class="lazy" src="/images/play_cycle.svg" alt="" style="width: 100%; height: 100%; object-fit: cover;"/>`}
        </div>
        
        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; ">
          <div style="white-space: nowrap; text-overflow: ellipsis; margin-right: 40px; overflow: hidden; color: #272727; font-size: 15px; font-weight: 700;">${escapeHtml(
            item.title
          )}</div>
          <div>
            <img src="/images/m/time.svg" alt="" class="icon-convert">
            <span class="value-time-convert" style="color: #504F4F; font-size: 13px;">${formatHistoryTime(
              item.dateAdded
            )}</span>
          </div>
          <div class="app-info-before-convert--container" style="display: flex; justify-content: space-between; color: #504F4F; font-size: 13px;">
            <span>${item.duration === 0 ? '' :secondsToHMS(item.duration)}</span>
            <span>${escapeHtml(convertMediaCode(item.codec || getExtFileName(item.displayName)))}</span>
            <span>${(item.width === 0 || item.height === 0) ? '' : `${escapeHtml(item.width)}x${escapeHtml(item.height)}`}</span>
            <span>${afterSize} MB</span>
          </div>
        </div>
        <div id="inner" style="cursor: pointer; position: absolute; top: 0px; right: 0px; height: 30px; padding-left: 30px; display: flex; align-items: center; justify-content: center; z-index: 999;">
          <svg fill="#000000" width="20px" height="20px" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg">
              <path d="M960 1468.235c93.448 0 169.412 75.965 169.412 169.412 0 93.448-75.964 169.412-169.412 169.412-93.448 0-169.412-75.964-169.412-169.412 0-93.447 75.964-169.412 169.412-169.412Zm0-677.647c93.448 0 169.412 75.964 169.412 169.412 0 93.448-75.964 169.412-169.412 169.412-93.448 0-169.412-75.964-169.412-169.412 0-93.448 75.964-169.412 169.412-169.412Zm0-677.647c93.448 0 169.412 75.964 169.412 169.412 0 93.447-75.964 169.412-169.412 169.412-93.448 0-169.412-75.965-169.412-169.412 0-93.448 75.964-169.412 169.412-169.412Z" fill-rule="evenodd"/>
          </svg>
        </div>
        
      </div>
    `;
}

function showLoading(){
  const container = document.querySelector(".app-list-content-history");
  // Check if loading already exists
  let loaddingEl = document.getElementById("id_loading");
  if (loaddingEl) return;
  loaddingEl = document.createElement("div");
  loaddingEl.id = "id_loadding";
  loaddingEl.style.marginBottom = "20px";
  loaddingEl.style.width = "100%";
  loaddingEl.style.textAlign = "center";
  loaddingEl.innerHTML = `<div  class="spinner"></div>`
  container.appendChild(loaddingEl);
}

function hideLoading(){
  const loaddingEl = document.getElementById("id_loadding");    
  if (loaddingEl) {
    loaddingEl.remove();
  }
}

async function renderHistoryList(historyList) {
  const container = document.querySelector(".app-list-content-history");

  if (currentPage === 0) {
    container.innerHTML = "";
    if (historyList.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; padding: 2rem; color: #939393;">No conversion history yet</div>';
      return;
    }
  }

  let divItems = document.createElement("div");
  divItems.innerHTML = historyList
    .map((item) => {
      return renderItem(item);
    })
    .join("");

  container.appendChild(divItems)
  
  if (typeof LazyLoad !== 'undefined') {
    const lazyLoadInstance = new LazyLoad({
      elements_selector: ".lazy",
      threshold: 0
    });
    lazyLoadInstance.update();
  }
}

async function loadMoreData(page) {
  showLoading();
  let result = await getHistoryList();
  hideLoading();
  renderHistoryList(result);
}

async function deleteItemById(itemId) {
  try {
    const formData = new FormData();
    formData.append("id", itemId);
    const res = await fetch("/delete-video", {
      method: "POST",
      body: formData,
    });
    if (res.status == 200) {
      showBeeToast("The video has been deleted");
      const el = document.getElementById(`id-cell-${itemId}`);
      if (el) {
        el.remove();
      }
    } else {
      console.error("Error deleting video:", res);
      if (res.status !== 403) {
        showBeeToast("Occurred an error while deleting the video");
      }
      
    }
  } catch (error) {
    console.error("Error deleting video:", error);
    showBeeToast(`Occurred an error while deleting the video ${error.message}`);
  }
}

function shareItemById(itemId, name) {
  console.log("shareItemById:", itemId, name);
  const platform = detectPlatform();
  if (platform.isBeeConvertApp && platform.isAndroid) {
    window.AndroidInterface.shareVideo(itemId, name);
  } else if (platform.isBeeConvertApp && platform.isIOS) {
    window.webkit.messageHandlers.BeeBridge.postMessage({
      action: "shareVideo",
      id: itemId,
    });
  }
}

async function showHistoryVideoDialogById(event, itemId, name, poster) {
  const inner = event.target.closest("#inner");
  if (inner) {
    let actionSheet = new ActionSheet({
      options: [
        {
          icon: "/images/delete.svg",
          label: "Delete",
        },
        {
          icon: "/images/share.svg",
          label: "Share",
        },
        {
          icon: "/images/close.svg",
          label: "Close",
        },
      ],
      onSelect: (index) => {
        if (index === 0) {
          const platform = detectPlatform();
          if (platform.isBeeConvertApp && platform.isAndroid) {
            const confirmDialog = new ConfirmDialog({
              message: "Do you really want to delete the file?",
              cancelText: "Cancel",
              acceptText: "Delete",
              onAccept: () => {
                deleteItemById(itemId);
              },
              onCancel: () => {},
            });
            confirmDialog.open();
          } else {
            deleteItemById(itemId);
          }
        } else if (index === 1) {
          shareItemById(itemId, name);
        }
      },
    });
    actionSheet.open();
    return;
  }

  const url = "/video-data?id=" + itemId;
  console.log("url video:", url);
  openVideoPlayerUrl(url, poster);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function onResumeHistoryPage() {
  currentPage = 0;
  isLoading = false;
  canLoadMore = false;

  const container = document.querySelector(".app-list-content-history");
  container.innerHTML = "";

  showLoading();
  let result = await getHistoryList();
  hideLoading();
  renderHistoryList(result);
  handleScroll();
}

function toDataUrlFromThumb(thumb, mime = "image/jpeg") {
  if (!thumb) return null;
  if (thumb.startsWith("data:")) return thumb;
  return `data:${mime};base64,${thumb}`;
}


let scrollThrottleTimer = null;

function handleScroll() {
  const mainElement = document.querySelector('#historyOverlay .dialog-overlay-main');
  
  // Calculate scroll position
  const scrollTop = mainElement.scrollTop;
  const scrollHeight = mainElement.scrollHeight;
  const clientHeight = mainElement.clientHeight;
  
  // Trigger load more when near bottom (100px threshold)
  if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoading && canLoadMore) {
    currentPage += 1;
    loadMoreData(currentPage);
  }
}

function initScrollListener() {
  const mainElement = document.querySelector('#historyOverlay .dialog-overlay-main');
  mainElement.removeEventListener('scroll', throttledHandleScroll);
  mainElement.addEventListener('scroll', throttledHandleScroll);
}

function throttledHandleScroll() {
  if (scrollThrottleTimer) return;
  
  scrollThrottleTimer = setTimeout(() => {
    handleScroll();
    scrollThrottleTimer = null;
  }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
  initScrollListener();
});