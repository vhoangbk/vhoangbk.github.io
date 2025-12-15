const fs = require('fs-extra');
const path = require('path');
const { minify } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');
const csso = require('csso');
const glob = require('glob');

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const BUILD_DIR = path.join(__dirname, 'dist');
const BUILD_PUBLIC_DIR = path.join(BUILD_DIR, 'public');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Files không được minify hoặc obfuscate (bao gồm FFmpeg WASM loader)
const NO_MINIFY_FILES = [
  'ffmpeg',
  'worker',
  'wasm',
  'convert-worker',
  'encode-decode-worker',
  'ffmpeg-st-gpl',
  'ffmpeg-mt-gpl'
];

const NO_OBFUSCATE_FILES = [
  'ffmpeg',
  'worker',
  'wasm',
  'convert-worker',
  'encode-decode-worker',
  'ffmpeg-st-gpl',
  'ffmpeg-mt-gpl'
];

const RESERVED_GLOBALS = [
  'originalVideoSize',
  'APP_STATE',
  'VIDEO_STATE',
  'isRestoringSettings',
  'showAside',
  'window',
  'document',
  'console',
  'require',
  'module',
  'exports',
  'global'
];

function shouldMinify(filePath) {
  if (!isProduction) return false;
  const fileName = path.basename(filePath).toLowerCase();
  // Skip minify cho các file FFmpeg và WASM loader
  return !NO_MINIFY_FILES.some(pattern => fileName.includes(pattern));
}

function shouldObfuscate(filePath) {
  if (!isProduction) return false;
  const fileName = path.basename(filePath).toLowerCase();
  return !NO_OBFUSCATE_FILES.some(pattern => fileName.includes(pattern));
}

async function minifyJS(filePath) {
  try {
    const code = await fs.readFile(filePath, 'utf8');

    if (!isProduction) {
      return code;
    }

    // ✅ Skip minify hoàn toàn cho các file FFmpeg và WASM loader
    const shouldMinifyFile = shouldMinify(filePath);
    if (!shouldMinifyFile) {
      console.log(`⚠️  Skipping minify for ${path.relative(PUBLIC_DIR, filePath)} (FFmpeg/WASM file)`);
      return code; // Trả về code gốc không minify
    }

    const useObfuscate = shouldObfuscate(filePath);

    const terserOptions = {
      compress: {
        drop_console: false,
        drop_debugger: true,
        passes: 1, // ✅ Giảm passes từ 2 xuống 1 để tránh lỗi với code phức tạp
        unsafe: false, // ✅ Đảm bảo unsafe: false để không phá WASM loader
        ecma: 2020, // ✅ Tăng lên ES2020 để tương thích với WASM
        keep_classnames: true, // ✅ Giữ class names để tránh lỗi với WASM
        keep_fnames: true, // ✅ Giữ function names để tránh lỗi với WASM
      },
      mangle: {
        toplevel: false,
        properties: false,
        reserved: RESERVED_GLOBALS,
        keep_classnames: true, // ✅ Giữ class names
        keep_fnames: true, // ✅ Giữ function names
      },
      format: {
        comments: false,
        ecma: 2020, // ✅ Output ES2020 thay vì ES2015
        preserve_annotations: false,
      },
      parse: {
        ecma: 2020 // ✅ Parse ES2020 thay vì ES2015
      }
    };

    const minifiedResult = await minify(code, terserOptions);

    if (minifiedResult.error) {
      console.error(`⚠️  Minify error for ${filePath}:`, minifiedResult.error);
      return code;
    }

    const minifiedCode = minifiedResult.code || code;

    if (useObfuscate) {
      try {
        const obfuscationResult = JavaScriptObfuscator.obfuscate(minifiedCode, {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          debugProtection: false,
          debugProtectionInterval: 0,
          disableConsoleOutput: false,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          reservedNames: RESERVED_GLOBALS,
          selfDefending: false,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 10,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayEncoding: ['base64'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 2,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 4,
          stringArrayWrappersType: 'function',
          stringArrayThreshold: 0.75,
          transformObjectKeys: true,
          unicodeEscapeSequence: false
        });

        return obfuscationResult.getObfuscatedCode();
      } catch (obfuscateError) {
        console.error(`⚠️  Obfuscation error for ${filePath}:`, obfuscateError.message);
        return minifiedCode;
      }
    }

    return minifiedCode;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return await fs.readFile(filePath, 'utf8');
  }
}

// ✅ Sửa minifyCSS để nhận content thay vì filePath
async function minifyCSS(cssContent, filePath = null) {
  try {
    // ✅ Nếu đã có content, dùng luôn; nếu không thì đọc từ filePath
    const css = cssContent || (filePath ? await fs.readFile(filePath, 'utf8') : '');

    if (!isProduction) {
      return css;
    }

    const result = csso.minify(css, {
      restructure: true,
      comments: false,
      usage: false
    });

    return result.css;
  } catch (error) {
    console.error(`❌ Error minifying CSS ${filePath || 'content'}:`, error.message);
    return cssContent || (filePath ? await fs.readFile(filePath, 'utf8') : '');
  }
}

async function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  await fs.ensureDir(destDir);
  
  await fs.copyFile(src, dest);
  try {
    const copyTime = new Date();
    await fs.utimes(dest, copyTime, copyTime);
    console.log(`Set copy time for ${path.relative(PUBLIC_DIR, dest)} (copied at ${copyTime.toISOString()})`);

  } catch (err) {
    console.warn(`Failed to set timestamps/mode for ${dest}:`, err.message);
  }
}

async function processFile(srcPath, destPath) {
  const ext = path.extname(srcPath).toLowerCase();
  const relativePath = path.relative(PUBLIC_DIR, srcPath);

  try {
    if (ext === '.js') {
      const processed = await minifyJS(srcPath);
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, processed, 'utf8');
      const size = Buffer.byteLength(processed, 'utf8');
      const originalSize = (await fs.stat(srcPath)).size;
      const saved = ((originalSize - size) / originalSize * 100).toFixed(1);
      const isObfuscated = shouldObfuscate(srcPath);
      const isMinified = shouldMinify(srcPath);
      const status = !isMinified ? ' (skipped minify - FFmpeg/WASM file)' : 
                     saved !== '0.0' ? ` (${saved}% smaller${isObfuscated ? ', obfuscated' : ''})` : 
                     (isObfuscated ? ' (obfuscated)' : '');
      console.log(`✓ JS: ${relativePath}${status}`);
    } else if (ext === '.css') {
      // ✅ Log chi tiết source path
      const srcStats = await fs.stat(srcPath);
      const srcExists = await fs.pathExists(srcPath);
      console.log(`\n📄 CSS File: ${relativePath}`);
      console.log(`   📂 SOURCE: ${srcPath}`);
      console.log(`   ✅ Source exists: ${srcExists}`);
      console.log(`   📊 Source size: ${srcStats.size} bytes`);
      console.log(`   🕐 Source mtime: ${srcStats.mtime.toISOString()}`);
      
      // ✅ Đọc source content MỘT LẦN DUY NHẤT
      const sourceContent = await fs.readFile(srcPath, 'utf8');
      const sourceHash = require('crypto').createHash('md5').update(sourceContent).digest('hex').substring(0, 8);
      console.log(`   🔑 Source hash: ${sourceHash}`);
      console.log(`   📝 Source content preview: ${sourceContent.substring(0, 100)}...`);
      
      // ✅ Minify từ content đã đọc (KHÔNG đọc lại từ file)
      const minified = await minifyCSS(sourceContent, srcPath);
      const minifiedHash = require('crypto').createHash('md5').update(minified).digest('hex').substring(0, 8);
      console.log(`   🔑 Minified hash: ${minifiedHash}`);
      
      // ✅ Thêm build timestamp comment để force file mới
      const buildTimestamp = `/* Build: ${Date.now()} */\n`;
      const finalContent = isProduction ? minified : buildTimestamp + minified;
      const finalHash = require('crypto').createHash('md5').update(finalContent).digest('hex').substring(0, 8);
      console.log(`   🔑 Final hash: ${finalHash}`);
      
      // ✅ Log destination path
      console.log(`   📂 DESTINATION: ${destPath}`);
      
      // ✅ Check dest file cũ (nếu có)
      if (await fs.pathExists(destPath)) {
        const oldDestStats = await fs.stat(destPath);
        const oldDestContent = await fs.readFile(destPath, 'utf8');
        const oldDestHash = require('crypto').createHash('md5').update(oldDestContent).digest('hex').substring(0, 8);
        console.log(`   ⚠️  Old dest exists: size=${oldDestStats.size}B, hash=${oldDestHash}, mtime=${oldDestStats.mtime.toISOString()}`);
        console.log(`   📝 Old dest content preview: ${oldDestContent.substring(0, 100)}...`);
        await fs.remove(destPath);
        console.log(`   🗑️  Removed old dest file`);
      }
      
      // ✅ Write file mới
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, finalContent, 'utf8');
      console.log(`   ✅ Written to: ${destPath}`);
      
      // ✅ Verify sau khi write
      const destStats = await fs.stat(destPath);
      const destContent = await fs.readFile(destPath, 'utf8');
      const destHash = require('crypto').createHash('md5').update(destContent).digest('hex').substring(0, 8);
      const isMatch = destContent === finalContent;
      
      console.log(`   📊 Dest size: ${destStats.size} bytes`);
      console.log(`   🕐 Dest mtime: ${destStats.mtime.toISOString()}`);
      console.log(`   🔑 Dest hash: ${destHash}`);
      console.log(`   ✅ Content match: ${isMatch}`);
      console.log(`   ✅ File written: ${destContent.length > 0}`);
      console.log(`   📝 Dest content preview: ${destContent.substring(0, 100)}...`);
      
      // ✅ So sánh source và dest để verify
      if (sourceHash === oldDestHash && oldDestHash) {
        console.log(`   ⚠️  WARNING: Source and old dest have same hash! File may not have changed.`);
      }
      
      const saved = ((srcStats.size - destStats.size) / srcStats.size * 100).toFixed(1);
      console.log(`✓ CSS: ${relativePath} (${saved}% smaller)\n`);
      
    } else if (ext === '.wasm') {
      // ✅ WASM files: Copy trực tiếp, KHÔNG minify hoặc xử lý
      // WASM files phải giữ nguyên binary format để tránh STATUS_BREAKPOINT
      await copyFile(srcPath, destPath);
      console.log(`✓ WASM: ${relativePath} (copied as-is, no processing)`);
    } else {
      await copyFile(srcPath, destPath);
    }
  } catch (error) {
    console.error(`❌ Error processing ${relativePath}:`, error.message);
    console.error(`   Source: ${srcPath}`);
    console.error(`   Dest: ${destPath}`);
    console.error(`   Stack:`, error.stack);
    try {
      await copyFile(srcPath, destPath);
      console.log(`  → Copied original file as fallback`);
    } catch (copyError) {
      console.error(`  → Failed to copy fallback:`, copyError.message);
    }
  }
}

async function build() {
  console.log(`🚀 Building for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}...\n`);
  console.log(`   Source: ${PUBLIC_DIR}`);
  console.log(`   Output: ${BUILD_PUBLIC_DIR} (dist/public/)`);
  console.log(`   Structure: dist/index.js + dist/public/\n`);

  const BUILD_VERSION = Date.now().toString();
  console.log(`📌 Build Version: ${BUILD_VERSION}\n`);

  if (await fs.pathExists(BUILD_DIR)) {
    await fs.remove(BUILD_DIR);
    console.log(`🗑️  Removed old build directory\n`);
  }
  await fs.ensureDir(BUILD_PUBLIC_DIR);

  const files = glob.sync('**/*', {
    cwd: PUBLIC_DIR,
    nodir: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/.DS_Store']
  });

  console.log(`📦 Processing ${files.length} files into dist/public/...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const srcPath = path.join(PUBLIC_DIR, file);
    const destPath = path.join(BUILD_PUBLIC_DIR, file);

    try {
      await processFile(srcPath, destPath);
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to process ${file}:`, error.message);
    }
  }

  console.log(`\n📝 Updating HTML files with build version ${BUILD_VERSION}...`);
  const htmlFiles = glob.sync('**/*.html', { cwd: BUILD_PUBLIC_DIR });

  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(BUILD_PUBLIC_DIR, htmlFile);
    try {
      let content = await fs.readFile(htmlPath, 'utf8');
      let updated = false;

      content = content.replace(
        /(href|src)=["']([^"']*(?:\.js|\.css|\.wasm))(\?v=[^"']*)?["']/gi,
        (match, attr, filePath, existingVersion) => {
          if (existingVersion) {
            return match;
          }
          updated = true;
          return `${attr}="${filePath}?v=${BUILD_VERSION}"`;
        }
      );

      content = content.replace(
        /(href|src)=["']([^"']*(?:\.js|\.css|\.wasm))\?v=[^"']+["']/gi,
        (match, attr, filePath) => {
          updated = true;
          return `${attr}="${filePath}?v=${BUILD_VERSION}"`;
        }
      );

      if (updated) {
        await fs.writeFile(htmlPath, content, 'utf8');
        console.log(`  ✓ Updated: ${htmlFile}`);
      }
    } catch (error) {
      console.error(`  ❌ Error updating ${htmlFile}:`, error.message);
    }
  }

  const buildInfoPath = path.join(BUILD_PUBLIC_DIR, 'build-info.json');
  const buildInfo = {
    lastUpdate: parseInt(BUILD_VERSION),
    buildVersion: BUILD_VERSION,
    fileCount: successCount,
    buildTime: new Date().toISOString()
  };
  await fs.writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2), 'utf8');
  console.log(`  ✓ Updated: build-info.json`);

  console.log(`\n📋 Copying index.js to dist/index.js...`);
  const rootIndexJs = path.join(__dirname, 'index.js');
  const distIndexJs = path.join(BUILD_DIR, 'index.js');

  if (await fs.pathExists(rootIndexJs)) {
    let indexContent = await fs.readFile(rootIndexJs, 'utf8');

    indexContent = indexContent.replace(
      /const publicDir = path\.join\(__dirname,.*?\);/,
      `const publicDir = path.join(__dirname, "public");`
    );

    indexContent = indexContent.replace(
      /\(process\.env\.NODE_ENV === 'production' \|\| process\.env\.VERCEL\) \? "dist" : "public"/,
      '"public"'
    );

    await fs.writeFile(distIndexJs, indexContent, 'utf8');
    console.log(`  ✓ Copied and updated index.js to serve from public/`);
  }

  console.log(`\n📋 Verifying build output...`);
  const importantFiles = [
    'public/index.html',
    'public/js/main.js',
    'public/css/styles.css',
    'index.js'
  ];

  for (const file of importantFiles) {
    const filePath = path.join(BUILD_DIR, file);
    if (await fs.pathExists(filePath)) {
      const stats = await fs.stat(filePath);
      console.log(`  ✓ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      console.error(`  ❌ Missing: ${file}`);
    }
  }

  console.log(`\n✅ Build completed!`);
  console.log(`   Build Version: ${BUILD_VERSION}`);
  console.log(`   Success: ${successCount} files`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount} files`);
  }
  console.log(`   Output structure:`);
  console.log(`     dist/index.js (serves from dist/public/)`);
  console.log(`     dist/public/ (${successCount} files - minified & obfuscated)`);
  console.log(`   Mode: ${isProduction ? 'PRODUCTION (minified & obfuscated)' : 'DEVELOPMENT (unminified)'}\n`);
}

build().catch((error) => {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
});