const fs = require('fs');
const path = require('path');

function addVersionToFile(filePath) {
  if (fs.existsSync(filePath)) {
    let textContent = fs.readFileSync(filePath, 'utf8');
    let hasChanged = false;
    textContent = textContent.replace(/[^"\s']*(?:\.js|\.css|\.wasm)[^"\s']*\?v=[^"\s']+/g, (match) => {

      var subFilePath = match.split('?v=')[0];
      var fullFilePath = path.join(__dirname, 'www/public', subFilePath);

      if (fs.existsSync(fullFilePath)) {
        let lastModified = fs.statSync(fullFilePath).mtime.getTime();
        hasChanged = true;
        return `${subFilePath}?v=${lastModified}`;
      } else {
        console.log('File does not exist:', subFilePath);
      }
      return match;
    });
    if (hasChanged) {
      fs.writeFileSync(filePath, textContent);
    }
  }
}

addVersionToFile(path.join(__dirname, 'www/public/libs/videos-convert-libs/constant.js'));
addVersionToFile(path.join(__dirname, 'www/public/index.html'));

