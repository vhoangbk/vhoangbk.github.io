const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const setBranch = 'main';
const isMainBranch =
  process.env.VERCEL_GIT_COMMIT_REF === setBranch ||
  process.env.BRANCH_NAME === setBranch ||
  process.env.GIT_BRANCH === setBranch;

if (!isMainBranch) {
  console.log('⏭️  Not on main branch -> skip versioning public HTML/CSS/JS');
  process.exit(0);
}

let BUILD_VERSION;
try {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || 
                    process.env.GIT_COMMIT_SHA ||
                    execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const timestamp = Date.now();
  BUILD_VERSION = `${commitSha}-${timestamp}`;
  console.log(`📌 Updating versions in public/ with BUILD_VERSION = ${BUILD_VERSION}`);
} catch (error) {
  BUILD_VERSION = Date.now().toString();
  console.log(`⚠️  Could not get commit hash, using timestamp: ${BUILD_VERSION}`);
}

const PUBLIC_DIR = path.join(__dirname, 'public');

function updateHtmlFiles(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      updateHtmlFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      content = content.replace(
        /(href|src)=["']([^"']*(?:\.js|\.css|\.wasm))(["'])/gi,
        (match, attr, filePath, quote) => {
          if (filePath.includes('?v=')) return match;

          changed = true;
          return `${attr}="${filePath}?v=${BUILD_VERSION}"`;
        }
      );

      content = content.replace(
        /(href|src)=["']([^"']*(?:\.js|\.css|\.wasm))\?v=[^"']*(["'])/gi,
        (match, attr, filePath, quote) => {
          changed = true;
          return `${attr}="${filePath}?v=${BUILD_VERSION}"`;
        }
      );

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`  ✓ Updated: ${path.relative(PUBLIC_DIR, fullPath)}`);
      }
    }
  }
}

function updateJsFiles(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      updateJsFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      content = content.replace(
        /importScripts\(["']([^"']*(?:\.js|\.wasm))["']\)/gi,
        (match, filePath) => {
          if (filePath.includes('?v=')) {
            const cleanPath = filePath.split('?v=')[0];
            changed = true;
            return `importScripts("${cleanPath}?v=${BUILD_VERSION}")`;
          } else {
            changed = true;
            return `importScripts("${filePath}?v=${BUILD_VERSION}")`;
          }
        }
      );

      content = content.replace(
        /new\s+Worker\(([^)]+)\)/gi,
        (match, urlArg) => {
          const urlMatch = urlArg.match(/["']([^"']*(?:\.js|\.wasm))["']/);
          if (urlMatch) {
            const filePath = urlMatch[1];
            if (!filePath.match(/^(https?|blob|data):/i) && !filePath.startsWith('/')) {
              if (filePath.includes('?v=')) {
                const cleanPath = filePath.split('?v=')[0];
                changed = true;
                return match.replace(filePath, `${cleanPath}?v=${BUILD_VERSION}`);
              } else {
                changed = true;
                return match.replace(filePath, `${filePath}?v=${BUILD_VERSION}`);
              }
            }
          }
          return match;
        }
      );

      content = content.replace(
        /(const\s+\w+_URL\s*=\s*["'])([^"']*(?:\.js|\.wasm))(["'])/gi,
        (match, prefix, filePath, suffix) => {
          if (!filePath.includes('?v=') && !filePath.match(/^(https?|blob|data):/i)) {
            changed = true;
            return `${prefix}${filePath}?v=${BUILD_VERSION}${suffix}`;
          }
          return match;
        }
      );

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`  ✓ Updated JS: ${path.relative(PUBLIC_DIR, fullPath)}`);
      }
    }
  }
}

function updateCssFiles(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      updateCssFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // ✅ Update @import statements trong CSS
      content = content.replace(
        /@import\s+url\(['"]([^'"]*\.css)(\?v=[^'"]*)?['"]\)/gi,
        (match, filePath, existingVersion) => {
          if (existingVersion) {
            // Update existing version
            const cleanPath = filePath.split('?v=')[0];
            changed = true;
            return `@import url('${cleanPath}?v=${BUILD_VERSION}')`;
          } else {
            // Add version
            changed = true;
            return `@import url('${filePath}?v=${BUILD_VERSION}')`;
          }
        }
      );

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`  ✓ Updated CSS: ${path.relative(PUBLIC_DIR, fullPath)}`);
      }
    }
  }
}

function addVersionToFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  let textContent = fs.readFileSync(filePath, 'utf8');
  let hasChanged = false;

  textContent = textContent.replace(/[^"\s']*(?:\.js|\.css|\.wasm)[^"\s']*(\?v=[^"\s']+)?/g, (match) => {
    let [subFilePath,] = match.split('?v=');
    const fullFilePath = path.join(PUBLIC_DIR, subFilePath);

    if (fs.existsSync(fullFilePath)) {
      hasChanged = true;
      return `${subFilePath}?v=${BUILD_VERSION}`;
    }
    return match;
  });

  if (hasChanged) {
    fs.writeFileSync(filePath, textContent, 'utf8');
    console.log(`  ✓ Updated (inline refs): ${path.relative(__dirname, filePath)}`);
  }
}

updateHtmlFiles(PUBLIC_DIR);
updateJsFiles(PUBLIC_DIR);
updateCssFiles(PUBLIC_DIR); // ✅ Thêm dòng này

console.log('Done updating versions in public/');