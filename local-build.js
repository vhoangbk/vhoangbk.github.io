const { spawnSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async  function build(){
  const DIST_NAME = 'dist';
  const distDir = path.join(__dirname, DIST_NAME);
  if (fs.existsSync(distDir)) {
    console.log('Removing old dist directory...');
    fs.removeSync(distDir);
  }

  console.log('webpack build start...');
  const webpackBuild = spawnSync('npx webpack', ['--config', 'webpack.config.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  console.log('remove update version...');
  spawnSync('rm', [`${DIST_NAME}/update-version.js`], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  console.log('updating log...');
  const updateLogResult = spawnSync('node', [`${DIST_NAME}/update-log.js`], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  console.log('remove update log...');
  spawnSync('rm', [`${DIST_NAME}/update-log.js`], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  console.log('env obfuscate_enable: ', process.env.obfuscate_enable);
  if (process.env.obfuscate_enable === 'true') {
    console.log('obfuscate javascript...');
    spawnSync('javascript-obfuscator', [`${DIST_NAME}/public`, '--output', `${DIST_NAME}/public`, '--compact', `true`, '--control-flow-flattening', `true`,
      '--exclude', `${DIST_NAME}/public/libs`], {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });
  }

}

build().then(() => {
  console.log('Build process completed successfully.');
}).catch(console.error);