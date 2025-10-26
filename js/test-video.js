const select = document.getElementById('corner-select');

select.addEventListener('change', async function () {
const value = select.value;
if (value) {
    await loadFileFromUrl(value);
}
});

async function loadFileFromUrl(url) {
try {
    const file = await urlToFile(url);
    const event = { files: [file] };
    await handleFileChange(event, true);
    document.getElementById('resolutionSelect').value = '';
} catch (err) {
    console.error("Lỗi khi tải file:", err);
}
}

async function urlToFile(url) {
const response = await fetch(url);
if (!response.ok) {
    throw new Error(`Không thể tải file từ ${url}`);
}
const blob = await response.blob();
const filename = url.split('/').pop();
const file = new File([blob], filename, { type: blob.type });
return file;
}