const uploadAreaWeb = document.getElementById('uploadFileDesktop');

if(uploadAreaWeb) {
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

    const inputFile = uploadAreaWeb.querySelector('input[type="file"]');

    uploadAreaWeb.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadAreaWeb.classList.add('dragover');
    });

    uploadAreaWeb.addEventListener('dragleave', () => {
        uploadAreaWeb.classList.remove('dragover');
    });

    uploadAreaWeb.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadAreaWeb.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            if (inputFile) {
                inputFile.files = e.dataTransfer.files;
                handleFileChange(inputFile, 'uploadFileDesktop', false);
            }
        } else {
            alert('Please drop a valid video!');
        }
    });
}

