/**
 * IndexedDB File Storage System - Singleton Pattern
 * Supports unlimited file size with chunking
 * Features: Create, Delete, Append, Insert at any position
 */

class IndexedDBFileStorage {
    // ✅ Static instance per context (main thread or worker)
    static instance = null;
    static initPromise = null;

    constructor(dbName = 'FileStorageDB', version = 1) {
        // ✅ Return existing instance if available
        if (IndexedDBFileStorage.instance) {
            console.log('♻️ Reusing existing IndexedDBFileStorage instance');
            return IndexedDBFileStorage.instance;
        }

        console.log('🆕 Creating new IndexedDBFileStorage instance');
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
        
        // ✅ Store instance
        IndexedDBFileStorage.instance = this;
    }

    /**
     * ✅ Get singleton instance (async safe)
     * @param {string} dbName - Database name
     * @param {number} version - Database version
     * @returns {Promise<IndexedDBFileStorage>}
     */
    static async getInstance(dbName = 'FileStorageDB', version = 1) {
        if (!IndexedDBFileStorage.instance) {
            IndexedDBFileStorage.instance = new IndexedDBFileStorage(dbName, version);
        }
        
        // ✅ Ensure initialized
        if (!IndexedDBFileStorage.instance.db) {
            if (!IndexedDBFileStorage.initPromise) {
                console.log('🔌 Initializing IndexedDB...');
                IndexedDBFileStorage.initPromise = IndexedDBFileStorage.instance.init();
            }
            await IndexedDBFileStorage.initPromise;
        }
        
        return IndexedDBFileStorage.instance;
    }

    /**
     * ✅ Reset singleton (for cleanup or testing)
     */
    static resetInstance() {
        if (IndexedDBFileStorage.instance) {
            IndexedDBFileStorage.instance.close();
            IndexedDBFileStorage.instance = null;
            IndexedDBFileStorage.initPromise = null;
            console.log('♻️ IndexedDBFileStorage instance reset');
        }
    }

    /**
     * Initialize database
     */
    async init() {
        if (this.db) {
            console.log('✅ Database already initialized');
            return this.db;
        }

        return new Promise((resolve, reject) => {
            console.log(`🔌 Opening IndexedDB: ${this.dbName} v${this.version}`);
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log(`✅ IndexedDB opened: ${this.dbName}`);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log(`🔧 Upgrading IndexedDB schema to version ${this.version}`);

                // Store file metadata
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                    fileStore.createIndex('name', 'name', { unique: true });
                    fileStore.createIndex('created', 'created', { unique: false });
                    fileStore.createIndex('modified', 'modified', { unique: false });
                    console.log('✅ Created "files" object store');
                }

                // Store file chunks
                if (!db.objectStoreNames.contains('chunks')) {
                    const chunkStore = db.createObjectStore('chunks', { keyPath: ['fileId', 'chunkIndex'] });
                    chunkStore.createIndex('fileId', 'fileId', { unique: false });
                    console.log('✅ Created "chunks" object store');
                }
            };
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('🔒 IndexedDB connection closed');
        }
    }

    /**
     * Create a new file
     * @param {string} filename - File name
     * @param {string} mimeType - MIME type
     * @returns {Promise<string>} File ID
     */
    async createFile(filename, mimeType = 'application/octet-stream') {
        if (!this.db) await this.init();

        // ✅ Check if file already exists
        const existingFile = await this.findFileByName(filename);
        if (existingFile) {
            console.warn(`⚠️ File "${filename}" already exists. Deleting old file...`);
            await this.deleteFile(existingFile.id);
        }
        
        console.log(`Creating file: ${filename} with MIME type: ${mimeType}`);
        const fileId = this._generateFileId();
        const now = Date.now();

        const fileMetadata = {
            id: fileId,
            name: filename,
            mimeType: mimeType,
            size: 0,
            chunkCount: 0,
            created: now,
            modified: now
        };

        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.add(fileMetadata);

            request.onsuccess = () => resolve(fileId);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a file and all its chunks
     * @param {string} fileId - File ID
     */
    async deleteFile(fileId) {
        if (!this.db) await this.init();

        return new Promise(async (resolve, reject) => {
            try {
                // Delete all chunks first
                await this._deleteAllChunks(fileId);

                // Delete file metadata
                const transaction = this.db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');
                const request = store.delete(fileId);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

        /**
     * Delete all files and chunks in database
     * @returns {Promise<{deletedFiles: number, deletedChunks: number}>}
     */
    async deleteAllFiles() {
        if (!this.db) await this.init();

        // ✅ Get files list BEFORE deletion
        const files = await this.listFiles();
        const totalFiles = files.length;
        const totalChunks = files.reduce((sum, file) => sum + file.chunkCount, 0);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files', 'chunks'], 'readwrite');
            const fileStore = transaction.objectStore('files');
            const chunkStore = transaction.objectStore('chunks');

            // ✅ Clear chunks first
            const chunkClearRequest = chunkStore.clear();
            
            chunkClearRequest.onerror = () => {
                console.error('Failed to clear chunks:', chunkClearRequest.error);
            };

            // ✅ Then clear files
            const fileClearRequest = fileStore.clear();
            
            fileClearRequest.onerror = () => {
                console.error('Failed to clear files:', fileClearRequest.error);
            };

            // ✅ Wait for transaction to complete
            transaction.oncomplete = () => {
                console.log(`🗑️ Deleted ${totalFiles} files and ${totalChunks} chunks`);
                resolve({
                    deletedFiles: totalFiles,
                    deletedChunks: totalChunks
                });
            };

            transaction.onerror = () => {
                console.error('Transaction failed:', transaction.error);
                reject(transaction.error);
            };

            transaction.onabort = () => {
                console.error('Transaction aborted');
                reject(new Error('Transaction aborted'));
            };
        });
    }

    /**
     * Append data to the end of file
     * @param {string} fileId - File ID
     * @param {Uint8Array|ArrayBuffer} data - Data to append
     */
    async appendData(fileId, data) {
        if (!this.db) await this.init();

        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        // Convert to Uint8Array if needed
        const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data);

        // Calculate position to append
        const position = metadata.size;

        return this.writeData(fileId, position, uint8Data);
    }

    /**
     * Write data at specific position
     * @param {string} fileId - File ID
     * @param {number} position - Position to write
     * @param {Uint8Array|ArrayBuffer} data - Data to write
     */
    async writeData(fileId, position, data) {
        if (!this.db) await this.init();

        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        // Convert to Uint8Array if needed
        const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data);

        // Calculate chunk indices
        const startChunkIndex = Math.floor(position / this.CHUNK_SIZE);
        const endPosition = position + uint8Data.length;
        const endChunkIndex = Math.floor((endPosition - 1) / this.CHUNK_SIZE);

        // Process each affected chunk
        for (let chunkIndex = startChunkIndex; chunkIndex <= endChunkIndex; chunkIndex++) {
            await this._writeToChunk(fileId, chunkIndex, position, uint8Data);
        }

        // Update file metadata
        const newSize = Math.max(metadata.size, endPosition);
        const newChunkCount = Math.ceil(newSize / this.CHUNK_SIZE);
        await this._updateFileMetadata(fileId, {
            size: newSize,
            chunkCount: newChunkCount,
            modified: Date.now()
        });
    }

    /**
     * Read data from file
     * @param {string} fileId - File ID
     * @param {number} start - Start position
     * @param {number} length - Length to read
     * @returns {Promise<Uint8Array>}
     */
    async readData(fileId, start = 0, length = null) {
        if (!this.db) await this.init();

        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        // ✅ Fix: Tính toán đúng read length
        const actualReadLength = length !== null ? Math.min(length, metadata.size - start) : (metadata.size - start);
        
        // ✅ Validate range
        if (start >= metadata.size) {
            return new Uint8Array(0);
        }
        
        if (actualReadLength <= 0) {
            return new Uint8Array(0);
        }

        const endPosition = start + actualReadLength;

        // Calculate chunk range
        const startChunkIndex = Math.floor(start / this.CHUNK_SIZE);
        const endChunkIndex = Math.floor((endPosition - 1) / this.CHUNK_SIZE);

        // ✅ Tạo result array với size chính xác
        const result = new Uint8Array(actualReadLength);
        let resultOffset = 0;

        // Read chunks và copy chỉ phần cần thiết
        for (let chunkIndex = startChunkIndex; chunkIndex <= endChunkIndex; chunkIndex++) {
            const chunk = await this._readChunk(fileId, chunkIndex);
            if (!chunk) continue;

            // ✅ Tính toán vị trí trong chunk
            const chunkStart = chunkIndex * this.CHUNK_SIZE;
            const chunkEnd = chunkStart + this.CHUNK_SIZE;

            // ✅ Tính offset trong chunk hiện tại
            const readStartInChunk = Math.max(0, start - chunkStart);
            const readEndInChunk = Math.min(this.CHUNK_SIZE, endPosition - chunkStart);
            
            // ✅ Copy chỉ phần cần thiết từ chunk
            const bytesToCopy = readEndInChunk - readStartInChunk;
            result.set(
                chunk.data.subarray(readStartInChunk, readEndInChunk),
                resultOffset
            );
            
            resultOffset += bytesToCopy;
        }

        return result;
    }
    /**
     * Get file as Blob
     * @param {string} fileId - File ID
     * @returns {Promise<Blob>}
     */
    async getFileAsBlob(fileId) {
        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        const data = await this.readData(fileId);
        return new Blob([data], { type: metadata.mimeType });
    }

    /**
     * Get file metadata
     * @param {string} fileId - File ID
     */
    async getFileMetadata(fileId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.get(fileId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * List all files
     */
    async listFiles() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Find file by name
     * @returns {Promise<string|null>} File ID or null if not found
     */
    async findFileByName(filename) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const index = store.index('name');
            const request = index.get(filename);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
 * Check if file exists by ID
 * @param {string} fileId - File ID
 * @returns {Promise<boolean>}
 */
    async fileExists(fileId) {
        if (!this.db) await this.init();

        const metadata = await this.getFileMetadata(fileId);
        return metadata !== null && metadata !== undefined;
    }


    // =====================>>>>> large file support
    /**
 * Get file as Blob (⚠️ RAM limited - use getFileAsStream for large files)
 * @param {string} fileId - File ID
 * @returns {Promise<Blob>}
 */
    async getFileAsBlob(fileId) {
        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        // ⚠️ Warning for large files
        if (metadata.size > 100 * 1024 * 1024) { // 100MB
            console.warn(`⚠️ File size is ${this._formatBytes(metadata.size)}. Consider using getFileAsStream() to avoid RAM issues.`);
        }

        const data = await this.readData(fileId);
        return new Blob([data], { type: metadata.mimeType });
    }

    /**
     * ✅ Stream file data chunk by chunk (RAM efficient for large files)
     * @param {string} fileId - File ID
     * @param {Function} onChunk - Callback(chunkData, chunkIndex, totalChunks)
     * @param {number} readChunkSize - Chunk size to read (default: CHUNK_SIZE)
     */
    async streamFileData(fileId, onChunk, readChunkSize = null) {
        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        const chunkSize = readChunkSize || this.CHUNK_SIZE;
        const totalChunks = Math.ceil(metadata.size / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const length = Math.min(chunkSize, metadata.size - start);
            const chunkData = await this.readData(fileId, start, length);

            await onChunk(chunkData, i, totalChunks);
        }
    }

    /**
     * ✅ Get file as ReadableStream (RAM efficient for large files)
     * @param {string} fileId - File ID
     * @returns {Promise<ReadableStream>}
     */
    async getFileAsStream(fileId) {
        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        const storage = this;
        let position = 0;

        return new ReadableStream({
            async pull(controller) {
                if (position >= metadata.size) {
                    controller.close();
                    return;
                }

                const chunkSize = storage.CHUNK_SIZE;
                const length = Math.min(chunkSize, metadata.size - position);
                const data = await storage.readData(fileId, position, length);

                controller.enqueue(data);
                position += length;
            }
        });
    }

    /**
     * ✅ Create download link for large files (uses streaming)
     * @param {string} fileId - File ID
     * @returns {Promise<string>} - Blob URL
     */
    async createStreamingBlobURL(fileId) {
        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        // For small files, use regular Blob
        if (metadata.size <= 50 * 1024 * 1024) { // 50MB
            const blob = await this.getFileAsBlob(fileId);
            return createBlobUrl(blob, 'createStreamingBlobURL');
            //return URL.createObjectURL(blob);
        }

        // For large files, create streaming blob
        const stream = await this.getFileAsStream(fileId);
        const response = new Response(stream, {
            headers: { 'Content-Type': metadata.mimeType }
        });
        const blob = await response.blob();
        return createBlobUrl(blob, 'createStreamingBlobURL');
    }

    /**
     * ✅ Export file to disk using streaming (RAM efficient)
     * @param {string} fileId - File ID
     * @param {string} filename - Output filename
     */
    async exportFileStreaming(fileId, filename = null) {
        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        const outputFilename = filename || metadata.name;

        // Check if File System Access API is available
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: outputFilename,
                    types: [{
                        description: 'Video File',
                        accept: { [metadata.mimeType]: ['.mp4', '.webm'] }
                    }]
                });

                const writable = await handle.createWritable();

                // Stream data to file
                await this.streamFileData(fileId, async (chunkData, index, total) => {
                    await writable.write(chunkData);
                    console.log(`Writing chunk ${index + 1}/${total}`);
                });

                await writable.close();
                console.log('✅ File exported successfully');
            } catch (error) {
                console.error('Export failed:', error);
                throw error;
            }
        } else {
            // Fallback: use blob URL download
            const url = await this.createStreamingBlobURL(fileId);
            const a = document.createElement('a');
            a.href = url;
            a.download = outputFilename;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    /**
     * ✅ Copy file to another storage location (streaming)
     * @param {string} sourceFileId - Source file ID
     * @param {string} destFilename - Destination filename
     * @param {IndexedDBFileStorage} destStorage - Destination storage (optional, default: this)
     */
    async copyFileStreaming(sourceFileId, destFilename, destStorage = null) {
        const metadata = await this.getFileMetadata(sourceFileId);
        if (!metadata) throw new Error('Source file not found');

        const destination = destStorage || this;
        const destFileId = await destination.createFile(destFilename, metadata.mimeType);

        // Stream copy
        await this.streamFileData(sourceFileId, async (chunkData, index, total) => {
            await destination.appendData(destFileId, chunkData);
            console.log(`Copying chunk ${index + 1}/${total}`);
        });

        return destFileId;
    }


    // <<<<<===================== large file support


    // ========== Private Methods ==========

    _generateFileId() {
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async _writeToChunk(fileId, chunkIndex, globalPosition, data) {
        // Calculate chunk boundaries
        const chunkStart = chunkIndex * this.CHUNK_SIZE;
        const chunkEnd = chunkStart + this.CHUNK_SIZE;

        // Calculate data range to write to this chunk
        const writeStartInChunk = Math.max(0, globalPosition - chunkStart);
        const writeEndInChunk = Math.min(this.CHUNK_SIZE, globalPosition + data.length - chunkStart);

        // Calculate data range
        const dataStart = Math.max(0, chunkStart - globalPosition);
        const dataEnd = dataStart + (writeEndInChunk - writeStartInChunk);

        // Read existing chunk or create new
        let chunkData = await this._readChunk(fileId, chunkIndex);
        if (!chunkData) {
            chunkData = {
                fileId: fileId,
                chunkIndex: chunkIndex,
                data: new Uint8Array(this.CHUNK_SIZE)
            };
        }

        // Write data to chunk
        chunkData.data.set(data.slice(dataStart, dataEnd), writeStartInChunk);

        // Save chunk
        return this._saveChunk(chunkData);
    }

    async _readChunk(fileId, chunkIndex) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chunks'], 'readonly');
            const store = transaction.objectStore('chunks');
            const request = store.get([fileId, chunkIndex]);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _saveChunk(chunkData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chunks'], 'readwrite');
            const store = transaction.objectStore('chunks');
            const request = store.put(chunkData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async _deleteAllChunks(fileId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chunks'], 'readwrite');
            const store = transaction.objectStore('chunks');
            const index = store.index('fileId');
            const request = index.openCursor(IDBKeyRange.only(fileId));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async _updateFileMetadata(fileId, updates) {
        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) throw new Error('File not found');

        Object.assign(metadata, updates);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.put(metadata);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get storage usage statistics
     */
    async getStorageStats() {
        const files = await this.listFiles();
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const totalChunks = files.reduce((sum, file) => sum + file.chunkCount, 0);

        return {
            fileCount: files.length,
            totalSize: totalSize,
            totalChunks: totalChunks,
            chunkSize: this.CHUNK_SIZE,
            formattedSize: this._formatBytes(totalSize)
        };
    }

    _formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Delete database completely (nuclear option)
     * @returns {Promise<boolean>}
     */
    async deleteDatabase() {
        // Close connection first
        this.close();

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);

            request.onsuccess = () => {
                console.log(`🗑️ Database "${this.dbName}" deleted completely`);
                resolve(true);
            };

            request.onerror = () => reject(request.error);
            
            request.onblocked = () => {
                console.warn('⚠️ Database deletion blocked. Close all tabs/connections first.');
                reject(new Error('Database deletion blocked'));
            };
        });
    }

    /**
     * Clear database and reinitialize (Complete reset)
     * @returns {Promise<boolean>}
     */
    async clearAndReset() {
        await this.deleteDatabase();
        await this.init();
        console.log('✅ Database cleared and reinitialized');
        return true;
    }
}

// ✅ Export singleton getter for easy access
if (typeof self !== 'undefined') {
    self.getFileStorage = async () => {
        return await IndexedDBFileStorage.getInstance();
    };
}

// ========== Usage Examples ==========

async function exampleUsage() {
    // ✅ Use singleton pattern
    const storage = await IndexedDBFileStorage.getInstance();

    // 1. Create a new file
    const fileId = await storage.createFile('video.mp4', 'video/mp4');
    console.log('Created file:', fileId);

    // 2. Append data (simulating video chunks)
    const chunk1 = new Uint8Array(1024 * 1024); // 1MB
    chunk1.fill(65); // Fill with 'A'
    await storage.appendData(fileId, chunk1);
    console.log('Appended 1MB data');

    const chunk2 = new Uint8Array(2 * 1024 * 1024); // 2MB
    chunk2.fill(66); // Fill with 'B'
    await storage.appendData(fileId, chunk2);
    console.log('Appended 2MB data');

    // 3. Insert data at specific position
    const insertData = new Uint8Array(512 * 1024); // 512KB
    insertData.fill(67); // Fill with 'C'
    await storage.writeData(fileId, 500 * 1024, insertData); // Insert at 500KB
    console.log('Inserted 512KB at position 500KB');

    // 4. Read data
    const readData = await storage.readData(fileId, 0, 1024); // Read first 1KB
    console.log('Read first 1KB:', readData);

    // 5. Get file metadata
    const metadata = await storage.getFileMetadata(fileId);
    console.log('File metadata:', metadata);

    // 6. Get file as Blob
    const blob = await storage.getFileAsBlob(fileId);
    console.log('File as Blob:', blob);

    // 7. List all files
    const files = await storage.listFiles();
    console.log('All files:', files);

    // 8. Get storage stats
    const stats = await storage.getStorageStats();
    console.log('Storage stats:', stats);

    // 9. Delete file
    await storage.deleteFile(fileId);
    console.log('Deleted file');

    // Clean up
    storage.close();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexedDBFileStorage;
}
