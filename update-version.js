const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// const setBranch = 'main';
// const isMainBranch =
//   process.env.VERCEL_GIT_COMMIT_REF === setBranch ||
//   process.env.BRANCH_NAME === setBranch ||
//   process.env.GIT_BRANCH === setBranch;

// if (!isMainBranch) {
//   console.log('⏭️  Not on main branch -> skip versioning public HTML/CSS/JS');
//   process.exit(0);
// }

// let BUILD_VERSION;
// try {
//   const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ||
//     process.env.GIT_COMMIT_SHA ||
//     execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
//   const timestamp = Date.now();
//   BUILD_VERSION = `${commitSha}-${timestamp}`;
//   console.log(`📌 Updating versions in public/ with BUILD_VERSION = ${BUILD_VERSION}`);
// } catch (error) {
//   BUILD_VERSION = Date.now().toString();
//   console.log(`⚠️  Could not get commit hash, using timestamp: ${BUILD_VERSION}`);
// }

const PUBLIC_DIR = path.join(__dirname, 'public');

// function updateHtmlFiles(baseDir) {
//   const entries = fs.readdirSync(baseDir, { withFileTypes: true });

//   for (const entry of entries) {
//     const fullPath = path.join(baseDir, entry.name);

//     if (entry.isDirectory()) {
//       updateHtmlFiles(fullPath);
//     } else if (entry.isFile() && entry.name.endsWith('.html')) {
//       let content = fs.readFileSync(fullPath, 'utf8');
//       let changed = false;

//       content = content.replace(
//         /(href|src)=["']([^"']*(?:\.js|\.css|\.wasm))(["'])/gi,
//         (match, attr, filePath, quote) => {
//           if (filePath.includes('?v=')) return match;

//           changed = true;
//           return `${attr}="${filePath}?v=${BUILD_VERSION}"`;
//         }
//       );

//       content = content.replace(
//         /(href|src)=["']([^"']*(?:\.js|\.css|\.wasm))\?v=[^"']*(["'])/gi,
//         (match, attr, filePath, quote) => {
//           changed = true;
//           return `${attr}="${filePath}?v=${BUILD_VERSION}"`;
//         }
//       );

//       if (changed) {
//         fs.writeFileSync(fullPath, content, 'utf8');
//         console.log(`  ✓ Updated: ${path.relative(PUBLIC_DIR, fullPath)}`);
//       }
//     }
//   }
// }



// function updateCssFiles(baseDir) {
//   const entries = fs.readdirSync(baseDir, { withFileTypes: true });

//   for (const entry of entries) {
//     const fullPath = path.join(baseDir, entry.name);

//     if (entry.isDirectory()) {
//       updateCssFiles(fullPath);
//     } else if (entry.isFile() && entry.name.endsWith('.css')) {
//       let content = fs.readFileSync(fullPath, 'utf8');
//       let changed = false;

//       // ✅ Update @import statements trong CSS
//       content = content.replace(
//         /@import\s+url\(['"]([^'"]*\.css)(\?v=[^'"]*)?['"]\)/gi,
//         (match, filePath, existingVersion) => {
//           if (existingVersion) {
//             // Update existing version
//             const cleanPath = filePath.split('?v=')[0];
//             changed = true;
//             return `@import url('${cleanPath}?v=${BUILD_VERSION}')`;
//           } else {
//             // Add version
//             changed = true;
//             return `@import url('${filePath}?v=${BUILD_VERSION}')`;
//           }
//         }
//       );

//       if (changed) {
//         fs.writeFileSync(fullPath, content, 'utf8');
//         console.log(`  ✓ Updated CSS: ${path.relative(PUBLIC_DIR, fullPath)}`);
//       }
//     }
//   }
// }

// function addVersionToFile(filePath) {
//   if (!fs.existsSync(filePath)) return;

//   let textContent = fs.readFileSync(filePath, 'utf8');
//   let hasChanged = false;

//   textContent = textContent.replace(/[^"\s']*(?:\.js|\.css|\.wasm)[^"\s']*(\?v=[^"\s']+)?/g, (match) => {
//     let [subFilePath,] = match.split('?v=');
//     const fullFilePath = path.join(PUBLIC_DIR, subFilePath);

//     if (fs.existsSync(fullFilePath)) {
//       hasChanged = true;
//       return `${subFilePath}?v=${BUILD_VERSION}`;
//     }
//     return match;
//   });

//   if (hasChanged) {
//     fs.writeFileSync(filePath, textContent, 'utf8');
//     console.log(`  ✓ Updated (inline refs): ${path.relative(__dirname, filePath)}`);
//   }
// }

// updateHtmlFiles(PUBLIC_DIR);
// updateJsFiles(PUBLIC_DIR);
// updateCssFiles(PUBLIC_DIR); // ✅ Thêm dòng này

// console.log('Done updating versions in public/');


function addVersionToDir(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      addVersionToDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css') || entry.name.endsWith('.html'))) {
      addVersionToFile(fullPath);
     //console.log('Processing JS file:', fullPath);
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
        let lastModified = fs.statSync(fullFilePath).mtime.getTime();
        hasChanged = true;
        return `${subFilePath}?v=${lastModified}`;
      } else {
        console.error('File does not exist:', subFilePath,fullFilePath,filePath);
      }
      return match;
    });
    if (hasChanged) {
      fs.writeFileSync(filePath, textContent);
    }
  }
}
// addVersionToDir(PUBLIC_DIR)
// addVersionToFile(path.join(__dirname, 'public/libs/convert-lib/constant.js'));
// addVersionToFile(path.join(__dirname, 'public/css/styles.css'));
// addVersionToFile(path.join(__dirname, 'public/index.html'));