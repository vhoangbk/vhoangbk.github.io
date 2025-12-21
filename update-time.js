// update-time.js
const fs = require('fs');
const path = require('path');

function getAllFiles(dir, files = []) {
  fs.readdirSync(dir).forEach(name => {
    const filepath = path.join(dir, name);
    // IGNORE node_modules, .git, build-info.json itself
    if (name === 'node_modules' || name === '.git') return;
    if (path.basename(filepath) === 'build-info.json') return;
    try {
      const stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        getAllFiles(filepath, files);
      } else {
        files.push({ path: filepath, mtimeMs: stat.mtimeMs });
      }
    } catch (e) { /* ignore perms/etc */ }
  });
  return files;
}

// Trả về lastUpdate và fileCount
function getLastUpdateData() {
  const files = getAllFiles(process.cwd());

  const lastUpdate = files.length > 0
    ? files.reduce((max, f) => Math.max(max, f.mtimeMs), 0)
    : Date.now();

  const fileCount = files.length;

  return { lastUpdate, fileCount };
}

function writeUpdateTimeIfChanged() {
  const outPath = path.join(process.cwd(), 'public', 'build-info.json');
  const newData = {
  lastUpdate: Math.floor(Date.now()),
  fileCount: getAllFiles(process.cwd()).length
};

  let existing = null;
  try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch(e){}

  // Nếu mtime hoặc số lượng file thay đổi → ghi lại
  if (existing &&
      existing.lastUpdate === newData.lastUpdate &&
      existing.fileCount === newData.fileCount) {
    console.log('No change in files, not rewriting build-info.json.');
    return;
  }

  fs.writeFileSync(outPath, JSON.stringify(newData, null, 2), 'utf8');
  console.log('Wrote build-info.json ->', new Date(newData.lastUpdate).toISOString(),
              `(files: ${newData.fileCount})`);
}

writeUpdateTimeIfChanged();
