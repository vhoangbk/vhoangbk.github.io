const uploadArea = document.getElementById('uploadFileConvert');
const inputFile = document.getElementById('inputFile');

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        console.log('File dropped:', file.name);
        inputFile.files = e.dataTransfer.files;
        handleFileChange(inputFile);
    } else {
        alert('Please drop a valid video!');
    }
});