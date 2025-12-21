const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // ✅ Add this

const PUBLIC_DIR = path.join(__dirname, 'public');




function addVersionToDir(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      addVersionToDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css') || entry.name.endsWith('.html'))) {
      addVersionToFile(fullPath);
    }
  }
}


/**
 * ✅ Fast hash using file stats + content from 3 positions
 * Samples: First 1KB + Middle 1KB + Last 1KB
 * @param {string} filePath - Full path to file
 * @returns {string} - Short hash (12 characters)
 */
function getFileHashFast(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const hash = crypto.createHash('md5');

    // ✅ Hash: inode + size (removed mtime for stability)
    hash.update(stats.size.toString());

    // ✅ Read 1KB from 3 positions: start, middle, end
    const sampleSize = 1024;
    const fileSize = stats.size;

    if (fileSize === 0) {
      // Empty file
      return hash.digest('hex').substring(0, 12);
    }

    const fd = fs.openSync(filePath, 'r');

    try {
      // 1️⃣ First 1KB (or entire file if smaller)
      const firstSize = Math.min(sampleSize, fileSize);
      const firstBuffer = Buffer.alloc(firstSize);
      fs.readSync(fd, firstBuffer, 0, firstSize, 0);
      hash.update(firstBuffer);

      // 2️⃣ Middle 1KB (if file is large enough)
      if (fileSize > sampleSize * 2) {
        const middlePos = Math.floor((fileSize - sampleSize) / 2);
        const middleBuffer = Buffer.alloc(sampleSize);
        fs.readSync(fd, middleBuffer, 0, sampleSize, middlePos);
        hash.update(middleBuffer);
      }

      // 3️⃣ Last 1KB (if file is large enough and different from start)
      if (fileSize > sampleSize) {
        const lastPos = fileSize - sampleSize;
        const lastSize = Math.min(sampleSize, fileSize);
        const lastBuffer = Buffer.alloc(lastSize);
        fs.readSync(fd, lastBuffer, 0, lastSize, lastPos);
        hash.update(lastBuffer);
      }
    } finally {
      fs.closeSync(fd);
    }

    return hash.digest('hex').substring(0, 12);
  } catch (error) {
    console.error('Error fast hashing:', filePath, error.message);
    // Fallback to inode-based hash
    try {
      const stats = fs.statSync(filePath);
      const hash = crypto.createHash('md5');
      hash.update(stats.ino.toString());
      hash.update(stats.size.toString());
      return hash.digest('hex').substring(0, 12);
    } catch {
      return 'err-' + Date.now().toString();
    }
  }
}

function addVersionToFile(filePath) {
  if (fs.existsSync(filePath)) {
    let textContent = fs.readFileSync(filePath, 'utf8');
    let hasChanged = false;
    textContent = textContent.replace(/[^"\s']*(?:\.js|\.css|\.wasm)[^"\s']*\?v=[^"\s']+/g, (match) => {

      var subFilePath = match.split('?v=')[0];

      // ✅ Xử lý đường dẫn relative/absolute đúng cách
      let fullFilePath;

      if (subFilePath.startsWith('/')) {
        // ✅ Nếu subFilePath bắt đầu bằng /, nó là absolute từ public root
        // Loại bỏ / đầu tiên và nối với PUBLIC_DIR
        const relativeFromPublic = subFilePath.substring(1); // Bỏ / đầu tiên
        fullFilePath = path.join(__dirname, 'public', relativeFromPublic);
      } else {
        // ✅ Nếu subFilePath không bắt đầu bằng /, nó là relative từ file hiện tại
        fullFilePath = path.join(path.dirname(filePath), subFilePath);
      }

      //đường dẫn mẹ là: /Users/hung/Git/beeconvert/public/blog-page/blog-1.html
      //đường dẫn con là: /js/main.js
      //nối lại thành: /Users/hung/Git/beeconvert/public/blog-page/js/main.js bị sai  

      if (fs.existsSync(fullFilePath)) {

        // console.log('Updating version for:', subFilePath, fullFilePath, filePath);
        const fileVersion = getFileHashFast(fullFilePath);
        hasChanged = true;
        return `${subFilePath}?v=${fileVersion}`;
      } else {
        console.error('File does not exist:', subFilePath, fullFilePath, filePath);
      }
      return match;
    });
    if (hasChanged) {
      fs.writeFileSync(filePath, textContent);
    }
  }
}
const count_loop = 2;// chạy 2 lần để đảm bảo tất cả các tham chiếu chéo đều được cập nhật
for (let i = 0; i < count_loop; i++) {
  addVersionToDir(PUBLIC_DIR);
}

//addVersionToDir(PUBLIC_DIR)
// addVersionToFile(path.join(__dirname, 'public/libs/convert-lib/constant.js'));
// addVersionToFile(path.join(__dirname, 'public/css/styles.css'));
// addVersionToFile(path.join(__dirname, 'public/index.html'));

