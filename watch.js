// watch.js
const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');

const projectRoot = process.cwd();
const buildInfoPath = path.join(projectRoot, 'build-info.json');

let timer = null;
const DEBOUNCE_MS = 200;

const watcher = chokidar.watch(projectRoot, {
  ignored: [
    /node_modules/,
    /\.git/,
    /public[\/\\]build-info\.json$/
  ],
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }
});


function scheduleUpdate() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    exec('node update-time.js', (err, stdout, stderr) => {
      if (err) console.error('update-time error', err);
      if (stdout) console.log(stdout.trim());
      if (stderr) console.error(stderr.trim());
    });
  }, DEBOUNCE_MS);
}

watcher.on('all', (event, path) => {
  console.log('fs event', event, path);
  scheduleUpdate();
});
