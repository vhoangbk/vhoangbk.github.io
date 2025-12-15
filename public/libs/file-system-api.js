function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
        // @ts-ignore - file size hacks
        request.oncomplete = request.onsuccess = () => resolve(request.result);
        // @ts-ignore - file size hacks
        request.onabort = request.onerror = () => reject(request.error);
    });
}

function createStore(dbName, storeName) {
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    const dbp = promisifyRequest(request);
    return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}

let defaultGetStoreFunc;
function defaultGetStore() {
    if (!defaultGetStoreFunc) {
        defaultGetStoreFunc = createStore('keyval-store', 'keyval');
    }
    return defaultGetStoreFunc;
}
/**
 * Get a value by its key.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function get(key, customStore = defaultGetStore()) {
    return customStore('readonly', (store) => promisifyRequest(store.get(key)));
}

/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function set(key, value, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.put(value, key);
        return promisifyRequest(store.transaction);
    });
}


/**
 * Update a value. This lets you see the old value and update it as an atomic operation.
 *
 * @param key
 * @param updater A callback that takes the old value and returns a new value.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function updateValue(key, updater, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) =>
        // Need to create the promise manually.
        // If I try to chain promises, the transaction closes in browsers
        // that use a promise polyfill (IE10/11).
        new Promise((resolve, reject) => {
            store.get(key).onsuccess = function () {
                try {
                    store.put(updater(this.result), key);
                    resolve(promisifyRequest(store.transaction));
                }
                catch (err) {
                    reject(err);
                }
            };
        }));
}
/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function deleteKey(key, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.delete(key);
        return promisifyRequest(store.transaction);
    });
}
/**
 * Clear all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function clearAll(customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.clear();
        return promisifyRequest(store.transaction);
    });
}
function eachCursor(customStore, callback) {
    return customStore('readonly', (store) => {
        // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
        // And openKeyCursor isn't supported by Safari.
        store.openCursor().onsuccess = function () {
            if (!this.result)
                return;
            callback(this.result);
            this.result.continue();
        };
        return promisifyRequest(store.transaction);
    });
}
/**
 * Get all keys in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function keys(customStore = defaultGetStore()) {
    const items = [];
    return eachCursor(customStore, (cursor) => items.push(cursor.key)).then(() => items);
}
/**
 * Get all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function values(customStore = defaultGetStore()) {
    const items = [];
    return eachCursor(customStore, (cursor) => items.push(cursor.value)).then(() => items);
}
/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function entries(customStore = defaultGetStore()) {
    const items = [];
    return eachCursor(customStore, (cursor) => items.push([cursor.key, cursor.value])).then(() => items);
}


/**
 * Get an array of strings from storage
 * @param {string} key - The key to get the array from storage
 * @returns {Promise<string[]>} - Returns array of strings or empty array if not found
 */
async function getStringArray(key) {
    try {
        const result = await get(key);
        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error('Error getting string array:', error);
        return [];
    }
}

/**
 * Save an array of strings to storage
 * @param {string} key - The key to save the array in storage
 * @param {string[]} stringArray - Array of strings to save
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
async function saveStringArray(key, stringArray) {
    try {
        if (!Array.isArray(stringArray)) {
            throw new Error('Second parameter must be an array');
        }

        // Ensure all items are strings
        const validatedArray = stringArray.map(item => String(item));

        await set(key, validatedArray);
        return true;
    } catch (error) {
        console.error('Error saving string array:', error);
        return false;
    }
}

/**
 * Add a string to an existing array in storage
 * @param {string} key - The key of the array in storage
 * @param {string} newString - String to add to the array
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
async function addToStringArray(key, newString) {
    try {
        const currentArray = await getStringArray(key);
        currentArray.push(String(newString));
        return await saveStringArray(key, currentArray);
    } catch (error) {
        console.error('Error adding to string array:', error);
        return false;
    }
}

/**
 * Remove a string from an array in storage
 * @param {string} key - The key of the array in storage
 * @param {string} stringToRemove - String to remove from the array
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
async function removeFromStringArray(key, stringToRemove) {
    try {
        const currentArray = await getStringArray(key);
        const filteredArray = currentArray.filter(item => item !== stringToRemove);
        return await saveStringArray(key, filteredArray);
    } catch (error) {
        console.error('Error removing from string array:', error);
        return false;
    }
}

/**
 * Clear a string array in storage
 * @param {string} key - The key of the array to clear
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
async function clearStringArray(key) {
    try {
        await deleteKey(key);
        return true;
    } catch (error) {
        console.error('Error clearing string array:', error);
        return false;
    }
}



async function verifyPermission(fileHandle, readWrite) {
    const options = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
}


let status


async function askSelectFolder(){
  return new Promise((resolve, reject) => {
    const confirmDialog = new ConfirmDialog({
      message: "This file exceeds 2GB. Please select a folder to save!",
      cancelText: "Cancel",
      acceptText: "Select folder",
      onAccept: () => {
        confirmDialog.close()
        resolve(true)
      },
      onCancel: () => {
        resolve(false)
      },
      type: 'none',
    });
    confirmDialog.open();
  });
}

let pathFileSave = null;

/**
 * detail: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
 * @param {*} type = ("desktop", "documents", "downloads", "music", "pictures", or "videos")
 */
async function pickDirectory(type) {
    if (pathFileSave) {
        console.log('da ton tai===', pathFileSave);
        return pathFileSave;
    }

    if (typeof window.showDirectoryPicker !== 'function') {
        return null;
    }

    let accepted = await askSelectFolder();
    if (!accepted) {
        return null;
    }

    pathFileSave = await window.showDirectoryPicker({
        startIn: type,
        mode: 'readwrite'
    });
    return pathFileSave;
}

const recentSavedFiles = 'recent-saved-files';
let index = 0;
async function getFSFileByExtension(extension, tryAgain = false) {

    const type = 'videos';
    try {
        const now = new Date();

        const hh = now.getHours().toString().padStart(2, '0');
        const min = now.getMinutes().toString().padStart(2, '0');
        const ss = now.getSeconds().toString().padStart(2, '0');
        const ms = now.getMilliseconds().toString().padStart(3, '0');
        const dateStr = `${hh}h-${min}m-${ss}s-${index++}`;
        const outputFileName = 'video-' + dateStr + extension;

        const dirHandle = await pickDirectory(type);
        if (!dirHandle) return null;
        const fileHandle = await dirHandle.getFileHandle(outputFileName, { create: true });
        if (await verifyPermission(fileHandle, true)) {
            addToStringArray(recentSavedFiles, outputFileName);
            return fileHandle;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error getting FS file by extension:', error);
        if (tryAgain === false) {
            var dirName = "dir-" + type;
            deleteKey(dirName);
            window[dirName] = null;
            return getFSFileByExtension(extension, true);
        } else {
            return null;
        }
    }
}


// async function deleteAllTmpFiles(exceptFileName = null) {
//     let type = 'videos';
//     var dirName = "dir-" + type;
//     var dirHandle = await get(dirName);
//     if (dirHandle) {
//         const currentArray = await getStringArray(recentSavedFiles);
//         if (currentArray.length === 0) {
//             return;
//         }
//         for await (const entry of dirHandle.values()) {
//             if (entry.kind === 'file' && entry.name.startsWith('video-') && currentArray.includes(entry.name)) {
//                 // Skip the file if it matches the exception
//                 if (exceptFileName && entry.name === exceptFileName) {
//                     console.log('Skipping file:', entry.name);
//                     continue;
//                 }
//                 console.log('Deleting tmp file:', entry.name);
//                 await dirHandle.removeEntry(entry.name);
//             }
//         }
//         clearStringArray(recentSavedFiles);
//     }
// }

// // Show a dialog warning about unsupported large output size (in English)
// function showOutputSizeWarningDialog() {
//     if (document.getElementById('output-size-warning-dialog')) return;
//     const dialog = document.createElement('div');
//     dialog.id = 'output-size-warning-dialog';
//     dialog.style = 'display:flex;position:fixed;z-index:9999;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);align-items:center;justify-content:center;';
//     dialog.innerHTML = `
//             <div style="background:#fff;padding:24px 32px;border-radius:10px;max-width:90vw;box-shadow:0 4px 24px rgba(0,0,0,0.2);text-align:center;">
//                 <h3 style="margin-top:0">Output size too large</h3>
//                 <p>Your browser does not support exporting files with such a large output size.<br>
//                 Please reduce the output file size or use another browser such as <b>Chrome</b>, <b>Edge</b>... to continue.</p>
//                 <button id="output-size-warning-close-btn" style="margin-top:16px;padding:8px 20px;border:none;background:#1976d2;color:#fff;border-radius:5px;cursor:pointer;">OK</button>
//             </div>
//         `;
//     document.body.appendChild(dialog);
//     document.getElementById('output-size-warning-close-btn').onclick = function () {
//         dialog.remove();
//     };
// }


/**
 * 
 * @param {*} name 
 * @param {*} tryAgain 
 * @returns FileSystemFileHandle
 */

async function getFSFileByName(name, tryAgain = false) {

    if (typeof window.showDirectoryPicker !== 'function') {
        return `Your browser does not support exporting files larger than 2GB.
Please use another browser such as Google Chrome, Microsoft Edge, Opera, etc. to continue.`;
    }

    const type = 'videos';
    try {
        const dirHandle = await pickDirectory(type);
        if (!dirHandle) return null;
        const fileHandle = await dirHandle.getFileHandle(name, { create: true });
        if (await verifyPermission(fileHandle, true)) {
            return fileHandle;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error getting FS file by extension:', error);
        if (tryAgain === false) {
            var dirName = "dir-" + type;
            deleteKey(dirName);
            window[dirName] = null;
            return getFSFileByName(name, true);
        } else {
            return null;
        }
    }
}

async function deleteFileSystemByName(filename) {
    try {
        if (pathFileSave) {
            if (await verifyPermission(pathFileSave, true)) {
                await pathFileSave.removeEntry(filename);
                console.log('File deleted:', filename);
            } else {
                console.warn('No permission to delete file:', filename);
            }
        }
    } catch (error) {
        console.error('Error deleting file by name:', error);
    }
}