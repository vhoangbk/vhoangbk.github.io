# Tài liệu chi tiết: FS.write() trong FFmpeg WASM

## 📝 Tổng quan

Function `FS.write()` là một phần của **Emscripten File System API**, được sử dụng trong FFmpeg WASM để ghi dữ liệu vào file system ảo.

---

## 🔍 Định nghĩa Function

### Location trong code:
- **File:** `ffmpeg-mt-gpl.js`
- **Line:** 2558
- **Scope:** `FS.write(stream, buffer, offset, length, position, canOwn)`

```javascript
write(stream, buffer, offset, length, position, canOwn) {
    // Validation checks
    if (length < 0 || position < 0) {
        throw new FS.ErrnoError(28)
    }
    if (FS.isClosed(stream)) {
        throw new FS.ErrnoError(8)
    }
    if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(8)
    }
    if (FS.isDir(stream.node.mode)) {
        throw new FS.ErrnoError(31)
    }
    if (!stream.stream_ops.write) {
        throw new FS.ErrnoError(28)
    }
    
    // Handle append mode
    if (stream.seekable && stream.flags & 1024) {
        FS.llseek(stream, 0, 2)
    }
    
    // Determine position
    var seeking = typeof position != "undefined";
    if (!seeking) {
        position = stream.position
    } else if (!stream.seekable) {
        throw new FS.ErrnoError(70)
    }
    
    // Perform write operation
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
    
    // Update stream position
    if (!seeking) stream.position += bytesWritten;
    
    return bytesWritten
}
```

---

## 📊 Các tham số (Parameters)

### 1. **stream** (Object)
- **Type:** `FS.FSStream` object
- **Mô tả:** Stream object đại diện cho file đã được mở
- **Properties quan trọng:**
  - `stream.node` - Node của file
  - `stream.flags` - Flags của stream (read/write/append)
  - `stream.position` - Vị trí hiện tại trong stream
  - `stream.seekable` - File có thể seek không
  - `stream.stream_ops` - Stream operations
  - `stream.fd` - File descriptor

**Ví dụ:**
```javascript
var stream = FS.open('/output.mp4', 'w+');
// stream = {
//   node: {...},
//   flags: 577,  // Write + Create
//   position: 0,
//   seekable: true,
//   stream_ops: {...}
// }
```

---

### 2. **buffer** (Uint8Array hoặc ArrayBuffer)
- **Type:** `Uint8Array`, `ArrayBuffer`, hoặc array-like object
- **Mô tả:** Buffer chứa dữ liệu cần ghi
- **Thường là:** `HEAP8`, `HEAPU8` từ WebAssembly memory

**Ví dụ:**
```javascript
// Buffer từ WASM memory
var buffer = ffmpegModule.HEAPU8;

// Hoặc buffer riêng
var buffer = new Uint8Array([1, 2, 3, 4, 5]);
```

**Lưu ý quan trọng:**
- Nếu `buffer.buffer === GROWABLE_HEAP_I8().buffer`, thì `canOwn` sẽ được set thành `false`
- Điều này để tránh buffer bị invalidate khi WASM memory grow

---

### 3. **offset** (Number)
- **Type:** `Number` (Integer)
- **Mô tả:** Vị trí bắt đầu trong buffer để lấy dữ liệu ghi
- **Unit:** Bytes
- **Range:** `0` đến `buffer.length - 1`

**Ví dụ:**
```javascript
var buffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

// Ghi từ vị trí 3 trong buffer
FS.write(stream, buffer, 3, 5, 0, false);
// Sẽ ghi: [3, 4, 5, 6, 7] vào file
```

**Sơ đồ:**
```
Buffer:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
                    ^----- offset = 3
         Ghi:      [3, 4, 5, 6, 7]
                    |<-- length=5 -->|
```

---

### 4. **length** (Number)
- **Type:** `Number` (Integer)
- **Mô tả:** Số lượng bytes cần ghi
- **Unit:** Bytes
- **Validation:** Phải >= 0

**Ví dụ:**
```javascript
// Ghi 1024 bytes
FS.write(stream, buffer, 0, 1024, 0, false);

// Ghi toàn bộ buffer
FS.write(stream, buffer, 0, buffer.length, 0, false);
```

**Lưu ý:**
- Nếu `length = 0`, function trả về 0 ngay lập tức
- `length` không được vượt quá `buffer.length - offset`

---

### 5. **position** (Number hoặc undefined)
- **Type:** `Number` (Integer) hoặc `undefined`
- **Mô tả:** Vị trí trong file để bắt đầu ghi
- **Unit:** Bytes (từ đầu file)
- **Behavior:**
  - Nếu `undefined`: Ghi từ `stream.position` hiện tại (sequential write)
  - Nếu có giá trị: Ghi tại vị trí cụ thể (random access write)

**Ví dụ:**
```javascript
// Sequential write (position = undefined)
FS.write(stream, buffer1, 0, 100);  // Ghi tại position 0
FS.write(stream, buffer2, 0, 100);  // Ghi tại position 100

// Random access write (position được chỉ định)
FS.write(stream, buffer1, 0, 100, 0);     // Ghi tại byte 0
FS.write(stream, buffer2, 0, 100, 500);   // Ghi tại byte 500
FS.write(stream, buffer3, 0, 100, 1000);  // Ghi tại byte 1000
```

**Validation:**
- `position < 0` → Throw error 28 (EINVAL)
- Nếu stream không seekable và position được chỉ định → Throw error 70 (ESPIPE)

---

### 6. **canOwn** (Boolean)
- **Type:** `Boolean`
- **Mô tả:** Cho phép stream "sở hữu" buffer (optimization)
- **Default:** `false`

**Behavior:**

#### `canOwn = true` (Ownership transfer)
- Stream có thể **directly reference** buffer thay vì copy
- **Performance:** Rất nhanh (zero-copy)
- **Risk:** Buffer không được modify sau khi ghi
- **Use case:** Khi buffer chỉ dùng một lần

```javascript
var buffer = new Uint8Array(1024);
// Fill buffer...

// Transfer ownership - stream sẽ reference trực tiếp buffer này
FS.write(stream, buffer, 0, 1024, 0, true);

// ⚠️ KHÔNG được modify buffer sau đây!
// buffer[0] = 99; // BAD! Sẽ làm corrupt data
```

#### `canOwn = false` (Copy mode)
- Stream sẽ **copy** data từ buffer
- **Performance:** Chậm hơn (có copy overhead)
- **Safety:** An toàn, có thể reuse buffer sau khi ghi
- **Use case:** Khi buffer được reuse nhiều lần

```javascript
var buffer = new Uint8Array(1024);

// Copy mode - stream sẽ copy data
FS.write(stream, buffer, 0, 1024, 0, false);

// ✅ OK - có thể modify và reuse buffer
buffer.fill(0);
FS.write(stream, buffer, 0, 1024, 1024, false);
```

**Special case:**
```javascript
// Nếu buffer là WASM heap, canOwn tự động = false
if (buffer.buffer === GROWABLE_HEAP_I8().buffer) {
    canOwn = false  // Force to false để tránh issues khi heap grow
}
```

---

## 🔄 Flow của Function

```
┌─────────────────────────────────────────┐
│ 1. Validate parameters                   │
│    - Check length >= 0, position >= 0    │
│    - Check stream không closed            │
│    - Check stream có write permission    │
│    - Check không phải directory           │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│ 2. Handle append mode                    │
│    if (stream.flags & 1024)              │
│        Seek to end of file               │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│ 3. Determine write position              │
│    - Nếu position undefined:             │
│      → Dùng stream.position              │
│    - Nếu position có giá trị:            │
│      → Dùng position (seeking write)     │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│ 4. Call stream_ops.write()               │
│    (MEMFS.stream_ops.write)              │
│    ├─> Check writeOutputData()           │
│    │   (custom hook trong convert-worker)│
│    └─> Fallback to default MEMFS write  │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│ 5. Update stream position                │
│    if (!seeking)                         │
│        stream.position += bytesWritten   │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│ 6. Return bytesWritten                   │
└─────────────────────────────────────────┘
```

---

## 🎯 MEMFS.stream_ops.write() Implementation

Đây là implementation thực sự của write trong MEMFS:

```javascript
write(stream, buffer, offset, length, position, canOwn) {
    // 1. Check if buffer is from WASM heap
    if (buffer.buffer === GROWABLE_HEAP_I8().buffer) {
        canOwn = false  // Cannot own WASM heap buffer
    }
    
    if (!length) return 0;  // Nothing to write
    
    var node = stream.node;
    node.mtime = node.ctime = Date.now();  // Update timestamps
    
    // 2. Try custom writeOutputData hook (hungnote custom)
    var writeResult = self.writeOutputData(stream, buffer, offset, length, position, canOwn);
    if (writeResult >= 0) {
        FS.truncate(node, 0);  // Truncate file
        return writeResult;
    }
    
    // 3. Handle buffer ownership (optimization)
    if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        if (canOwn) {
            // Zero-copy: directly use buffer
            node.contents = buffer.subarray(offset, offset + length);
            node.usedBytes = self.getLengthInput(node.name, length);
            return length
        } else if (node.usedBytes === 0 && position === 0) {
            // First write: can slice buffer
            node.contents = buffer.slice(offset, offset + length);
            node.usedBytes = self.getLengthInput(node.name, length);
            return length
        } else if (position + length <= node.usedBytes) {
            // Overwrite existing data
            node.contents.set(buffer.subarray(offset, offset + length), position);
            return length
        }
    }
    
    // 4. Expand file storage if needed
    MEMFS.expandFileStorage(node, position + length);
    
    // 5. Copy data to file
    if (node.contents.subarray && buffer.subarray) {
        node.contents.set(buffer.subarray(offset, offset + length), position)
    } else {
        for (var i = 0; i < length; i++) {
            node.contents[position + i] = buffer[offset + i]
        }
    }
    
    node.usedBytes = Math.max(node.usedBytes, position + length);
    return length
}
```

---

## 🔗 Integration với convert-worker.js

### Custom Hook: writeOutputData()

Trong `convert-worker.js`, có một custom hook `self.writeOutputData()` được gọi trước khi write thực sự:

```javascript
self.writeOutputData = function (stream, buffer, offset, length, position, canOwn) {
    var filename = stream.node.name;
    
    // Kiểm tra nếu file cần ghi vào writable stream
    if (self.writable_map[filename]) {
        writeQueue.push({
            writableFileName: filename,
            data: new Uint8Array(buffer.subarray(offset, offset + length)),
            position: position
        });
        return length;  // Return > 0 để skip MEMFS write
    }
    
    // Kiểm tra nếu ghi vào remote URL
    if (filename.indexOf('blob%3Ahttp') == 0 || 
        filename.indexOf('http%3A') == 0 || 
        filename.indexOf('https%3A') == 0) {
        
        filename = decodeURIComponent(filename);
        postDataSync(filename, new Uint8Array(buffer.subarray(offset, offset + length)));
        return length;
    }
    
    return -1;  // Fallback to default MEMFS write
}
```

---

## 📚 Ví dụ thực tế

### Example 1: Sequential write (video encoding)
```javascript
// FFmpeg đang encode video
var stream = FS.open('/output.mp4', 'w+');

// Write video header
FS.write(stream, headerBuffer, 0, headerSize, undefined, false);
// stream.position = headerSize

// Write video frames
for (var i = 0; i < frameCount; i++) {
    var frameData = encodeFrame(i);
    FS.write(stream, frameData, 0, frameData.length, undefined, false);
    // stream.position tự động tăng
}

FS.close(stream);
```

### Example 2: Random access write (cache file)
```javascript
var stream = FS.open('/cache.dat', 'w+');

// Write chunk 1 at position 0
FS.write(stream, chunk1, 0, chunk1.length, 0, false);

// Write chunk 3 at position 2000 (skip chunk 2)
FS.write(stream, chunk3, 0, chunk3.length, 2000, false);

// Write chunk 2 at position 1000 (fill gap)
FS.write(stream, chunk2, 0, chunk2.length, 1000, false);

FS.close(stream);
```

### Example 3: Zero-copy optimization
```javascript
var stream = FS.open('/temp.bin', 'w');

// Create buffer chỉ dùng một lần
var buffer = new Uint8Array(1024 * 1024);
fillBuffer(buffer);

// Transfer ownership - zero copy
FS.write(stream, buffer, 0, buffer.length, 0, true);

// ⚠️ KHÔNG được dùng buffer sau đây!

FS.close(stream);
```

### Example 4: Write to remote URL (custom hook)
```javascript
// File name là encoded URL
var outputUrl = 'blob%3Ahttp%3A//example.com/output.mp4';
var stream = FS.open(outputUrl, 'w');

// writeOutputData() sẽ intercept và post data lên server
FS.write(stream, videoData, 0, videoData.length, 0, false);
// → postDataSync('http://example.com/output.mp4', videoData)

FS.close(stream);
```

---

## ⚠️ Error Codes

| Error Code | Constant | Mô tả |
|------------|----------|--------|
| 8 | EBADF | Stream đã closed hoặc không có write permission |
| 28 | EINVAL | Invalid arguments (length < 0, position < 0) |
| 31 | EISDIR | Đang cố gắng write vào directory |
| 70 | ESPIPE | Stream không seekable nhưng có position |

---

## 🎯 Performance Tips

1. **Sử dụng canOwn = true khi có thể**
   - Giảm memory copy
   - Tăng tốc độ đáng kể với large buffers

2. **Sequential writes nhanh hơn random access**
   - Không cần tính toán position
   - Cache-friendly

3. **Batch writes thay vì nhiều small writes**
   ```javascript
   // ❌ Slow - nhiều system calls
   for (var i = 0; i < 1000; i++) {
       FS.write(stream, smallBuffer, 0, 10);
   }
   
   // ✅ Fast - batch write
   var bigBuffer = new Uint8Array(10000);
   // Fill bigBuffer...
   FS.write(stream, bigBuffer, 0, 10000);
   ```

4. **Avoid writing to WASM heap buffer**
   - `canOwn` sẽ bị force = false
   - Copy buffer ra ngoài WASM heap trước

---

## 🔧 Debug Tips

```javascript
// Log write operations
var originalWrite = FS.write;
FS.write = function(stream, buffer, offset, length, position, canOwn) {
    console.log('FS.write:', {
        filename: stream.node.name,
        offset: offset,
        length: length,
        position: position,
        canOwn: canOwn,
        streamPos: stream.position
    });
    return originalWrite.call(this, stream, buffer, offset, length, position, canOwn);
};
```

---

## 📖 Tài liệu tham khảo

1. **Emscripten File System API**: https://emscripten.org/docs/api_reference/Filesystem-API.html
2. **POSIX write()**: Similar behavior to standard POSIX write system call
3. **MEMFS**: In-memory file system implementation in Emscripten

---

## 💡 Summary

| Parameter | Type | Mô tả | Required |
|-----------|------|--------|----------|
| `stream` | FSStream | File stream đã open | ✅ |
| `buffer` | Uint8Array | Buffer chứa data | ✅ |
| `offset` | Number | Vị trí bắt đầu trong buffer | ✅ |
| `length` | Number | Số bytes cần ghi | ✅ |
| `position` | Number\|undefined | Vị trí ghi trong file | ❌ |
| `canOwn` | Boolean | Cho phép transfer ownership | ❌ |

**Return:** Number of bytes written (bytesWritten)

**Key Points:**
- ✅ Hỗ trợ sequential và random access write
- ✅ Zero-copy optimization với `canOwn = true`
- ✅ Custom hooks qua `writeOutputData()`
- ✅ Tự động update stream position
- ⚠️ WASM heap buffer không thể own
- ⚠️ Validation nghiêm ngặt (errors 8, 28, 31, 70)
