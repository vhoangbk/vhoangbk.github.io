const uploadAreaWeb = document.getElementById('uploadFileConvertWeb');
const uploadAreaMobile = document.getElementById('uploadFileWebMobile');

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

[uploadAreaWeb, uploadAreaMobile].filter(Boolean).forEach(uploadArea => {
    const inputFile = uploadArea.querySelector('input[type="file"]');

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
            if (inputFile) {
                inputFile.files = e.dataTransfer.files;
                handleFileChange(inputFile);
            }
        } else {
            alert('Please drop a valid video!');
        }
    });
});