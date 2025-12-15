const { spawnSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const branch = process.env.VERCEL_GIT_COMMIT_REF || '';
// ✅ Cho phép build trên cả main và develop
const shouldBuild = true // branch === 'main' || branch === 'develop';

if (shouldBuild) {
  const distDir = path.join(__dirname, 'dist');
  
  if (fs.existsSync(distDir)) {
    console.log('🗑️  Removing old dist directory...');
    fs.removeSync(distDir);
  }
  
  
  console.log('📌 Running update-version to add cache busting to public/*.html...');
  const updateVersionResult = spawnSync('npm', ['run', 'update-version'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });
  
  if (updateVersionResult.status !== 0) {
    console.error('❌ update-version failed');
    process.exit(updateVersionResult.status ?? 1);
  }
  
  console.log(`🚀 Running production build (npm run build:prod) on branch "${branch}"…`);
  const result = spawnSync('npm', ['run', 'build:prod'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });
  
  if (result.status === 0) {
    const cssDir = path.join(distDir, 'public', 'css');
    if (fs.existsSync(cssDir)) {
      try {
        const cssFiles = fs.readdirSync(cssDir, { recursive: true });
        console.log(`📋 Built CSS files: ${cssFiles.filter(f => f.endsWith('.css')).length} files`);
      } catch (error) {
        console.warn(`⚠️  Could not verify CSS files: ${error.message}`);
      }
    }
  }
  
  process.exit(result.status ?? 0);
}

console.log(`⚙️ Preview build on branch "${branch}" – skipping build:prod`);
process.exit(0);