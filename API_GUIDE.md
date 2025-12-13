# API Guide - POST Data Handler

Tài liệu này mô tả các API endpoints để xử lý POST data, tương tự như `postDataSync` và `postFileOperationSync` từ phía client.

## Cài đặt

Các dependencies đã được cài đặt:
- `body-parser`: Xử lý JSON và URL-encoded data
- `multer`: Xử lý multipart/form-data và file uploads
- `compression`: Nén response
- `cors`: Xử lý Cross-Origin requests

## API Endpoints

### 1. POST Binary Data
**Endpoint:** `POST /api/data`

Xử lý binary data từ client (tương tự `postDataSync`).

**Request:**
```javascript
const data = new Uint8Array([1, 2, 3, 4, 5]);

// Async
fetch('/api/data', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/octet-stream'
    },
    body: data
});

// Sync (giống postDataSync)
function postDataSync(url, data) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, false);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(data);
    if (xhr.status == 200) {
        return xhr.response;
    }
}
```

**Response:**
```
Status: 200
Body: "Data received successfully"
```

---

### 2. File Operations
**Endpoint:** `POST /api/file-operation`

Xử lý các thao tác với file (tương tự `postFileOperationSync`).

#### 2.1. Write File
**Action:** `write`

**Request:**
```javascript
// Async
const formData = new FormData();
formData.append('filename', 'output.mp4');
formData.append('action', 'write');
formData.append('position', 0);
formData.append('data', blob); // Blob hoặc File

fetch('/api/file-operation', {
    method: 'POST',
    body: formData
});

// Sync (giống postFileOperationSync)
function postFileOperationSync(filename, action, data, position) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/file-operation", false);
    
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('action', action);
    formData.append('position', position || 0);
    
    if (action === 'write' && data) {
        if (data instanceof Blob || data instanceof File) {
            formData.append('data', data);
        } else if (data instanceof ArrayBuffer) {
            formData.append('data', new Blob([data]));
        }
    }
    
    xhr.send(formData);
    
    if (xhr.status == 200) {
        return JSON.parse(xhr.responseText);
    }
}
```

**Response:**
```json
{
    "success": true,
    "bytesWritten": 1024,
    "position": 0
}
```

#### 2.2. Read File
**Action:** `read` (POST) hoặc GET request

**Request:**
```javascript
// Method 1: GET request
fetch('/api/file-operation?filename=output.mp4&position=0&length=1024')
    .then(res => res.arrayBuffer())
    .then(data => console.log(data));

// Method 2: POST request
const formData = new FormData();
formData.append('filename', 'output.mp4');
formData.append('action', 'read');
formData.append('position', 0);
formData.append('length', 1024);

fetch('/api/file-operation', {
    method: 'POST',
    body: formData
});

// Sync (giống getFileDataSync)
function getFileDataSync(filename, position, length) {
    const xhr = new XMLHttpRequest();
    const url = `/api/file-operation?filename=${encodeURIComponent(filename)}&position=${position}&length=${length}`;
    
    xhr.open("GET", url, false);
    xhr.responseType = 'arraybuffer';
    xhr.send(null);
    
    if (xhr.status == 200 || xhr.status == 206) {
        return xhr.response;
    }
}
```

**Response:**
- GET: Binary data với status 206
- POST: JSON với data encoded base64

#### 2.3. Get File Size
**Action:** `size`

**Request:**
```javascript
// GET request
fetch('/api/file-operation?filename=output.mp4&sizeOnly=true')
    .then(res => res.json())
    .then(data => console.log(data.size));

// Sync
function getFileSizeSync(filename) {
    const xhr = new XMLHttpRequest();
    const url = `/api/file-operation?filename=${encodeURIComponent(filename)}&sizeOnly=true`;
    
    xhr.open("GET", url, false);
    xhr.send(null);
    
    if (xhr.status == 200) {
        const result = JSON.parse(xhr.responseText);
        return result.size;
    }
}
```

**Response:**
```json
{
    "success": true,
    "size": 2048576
}
```

#### 2.4. Delete File
**Action:** `delete`

**Request:**
```javascript
const formData = new FormData();
formData.append('filename', 'output.mp4');
formData.append('action', 'delete');

fetch('/api/file-operation', {
    method: 'POST',
    body: formData
});
```

**Response:**
```json
{
    "success": true
}
```

---

## Cấu hình Server

### Body Parser
```javascript
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw({ 
    type: 'application/octet-stream', 
    limit: '500mb' 
}));
```

### Multer (File Upload)
```javascript
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB
    }
});
```

---

## File Storage

Files được lưu trong thư mục `data/` ở root của project:
- Path: `/Users/hung/Git/beeconvert/data/`
- Tự động tạo thư mục nếu chưa tồn tại
- Sử dụng `path.basename()` để đảm bảo an toàn
- Kiểm tra path traversal attack

---

## Testing

Mở file `test-api.html` trong browser để test các API:

```bash
npm run dev
# Hoặc
npm start

# Sau đó mở: http://localhost:8000/test-api.html
```

File test bao gồm:
1. Test POST binary data
2. Test file operations (write, read, size, delete)
3. Test postDataSync (synchronous)
4. Test postFileOperationSync (synchronous)

---

## Error Handling

Tất cả API đều trả về JSON error khi có lỗi:

```json
{
    "success": false,
    "error": "Error message"
}
```

Common HTTP status codes:
- `200`: Success
- `206`: Partial Content (for file reads)
- `400`: Bad Request (missing parameters, invalid path)
- `404`: File Not Found
- `500`: Server Error

---

## Security

1. **Path Traversal Protection**: Sử dụng `path.basename()` và kiểm tra path
2. **File Size Limit**: 500MB maximum
3. **CORS**: Enabled cho cross-origin requests
4. **Content Type Validation**: Kiểm tra content type phù hợp

---

## Tích hợp với convert-worker.js

Các API này được thiết kế để tương thích với:
- `postDataSync()` trong `common-utils.js`
- `postFileOperationSync()` trong `common-utils.js`
- `writeOutputData()` trong `convert-worker.js`
- `readInputData()` trong `convert-worker.js`

---

## Examples

### Ví dụ 1: Ghi video output từ FFmpeg worker
```javascript
// Trong convert-worker.js
function writeOutputData(stream, buffer, offset, length, position, canOwn) {
    const filename = stream.node.name;
    const data = new Uint8Array(buffer.subarray(offset, offset + length));
    
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('action', 'write');
    formData.append('position', position);
    formData.append('data', new Blob([data]));
    
    postFileOperationSync(filename, 'write', new Blob([data]), position);
    
    return length;
}
```

### Ví dụ 2: Đọc input file
```javascript
function readInputData(stream, buffer, offset, length, position) {
    const filename = stream.node.name;
    const data = getFileDataSync(filename, position, length);
    
    if (data) {
        const bytes = new Uint8Array(data);
        buffer.set(bytes, offset);
        return bytes.length;
    }
    
    return 0;
}
```

---

## Notes

- Tất cả operations đều support cả async và sync mode
- Sync mode sử dụng `XMLHttpRequest` với `async: false`
- Files được lưu trong memory buffer trước khi ghi vào disk
- Hỗ trợ partial read/write cho large files
