# Phương án chia nhỏ convert-worker.js

File `convert-worker.js` hiện tại có **774 dòng code**, cần được chia nhỏ để dễ bảo trì và phát triển.

## 📊 Phân tích cấu trúc hiện tại

### 1. **State Variables** (Dòng 1-20)
- `is_check`, `count_read_input`
- `worker_pool`, `output_value`
- `above_max`, `current_cmd`, `enable_videodecoder`
- `file_map`, `writable_map`
- `nameInputs`, `nameOutputs`, `writeQueue`, `transferableObjects`

### 2. **Worker Management Functions** (Dòng 23-306)
- `isMultiThreadMode()` - Kiểm tra multi-thread mode
- `requestPause()`, `requestResume()` - Quản lý pause/resume
- `get_worker_name()` - Tạo tên worker
- `add_new_worker()` - Tạo worker mới (encoder/decoder)
- `add_new_encoder()`, `add_new_decoder()` - Thêm encoder/decoder
- `get_worker_by_name()` - Tìm worker theo tên
- `flush_coder()` - Flush coder
- `pausePerform()` - Xử lý pause
- `check_need_pause()` - Kiểm tra cần pause

### 3. **I/O Functions** (Dòng 70-180)
- `writeOutputData()` - Ghi dữ liệu đầu ra
- `readInputData()` - Đọc dữ liệu đầu vào
- `getLengthInput()` - Lấy độ dài input

### 4. **Frame/Packet Processing** (Dòng 348-507)
- `get_new_pkt()` - Lấy packet mới từ encoder
- `get_new_frame()` - Lấy frame mới từ decoder
- `request_decode_packet()` - Yêu cầu decode packet
- `request_encode_frame()` - Yêu cầu encode frame

### 5. **FFmpeg Integration** (Dòng 519-648)
- `process_ffmpeg()` - Xử lý FFmpeg command
- `createFFmpegModule()` - Tạo FFmpeg module
- `onmessage()` - Message handler

### 6. **File System Functions** (Dòng 650-774)
- `openFile()` - Mở file
- `new_event()` - Xử lý events
- `completeFfmpeg()` - Hoàn thành FFmpeg

---

## 🎯 Phương án chia nhỏ (Đề xuất)

### **Cấu trúc thư mục mới:**
```
public/libs/convert-lib/
├── convert-worker.js          (Main entry point - 100 dòng)
├── worker-modules/
│   ├── worker-state.js        (State management - 50 dòng)
│   ├── worker-pool-manager.js (Worker pool quản lý - 150 dòng)
│   ├── io-handler.js          (I/O operations - 150 dòng)
│   ├── frame-packet-handler.js (Frame/packet processing - 150 dòng)
│   ├── ffmpeg-manager.js      (FFmpeg integration - 150 dòng)
│   └── file-system-handler.js (File operations - 100 dòng)
```

---

## 📁 Chi tiết từng module

### **1. worker-state.js** (~50 dòng)
**Mục đích:** Quản lý state toàn cục

```javascript
// Exported variables and state
export const state = {
    is_check: 0,
    count_read_input: 0,
    worker_pool: [],
    output_value: [],
    above_max: 30,
    current_cmd: '',
    enable_videodecoder: true,
    file_map: {},
    writable_map: {},
    nameInputs: [],
    nameOutputs: [],
    writeQueue: [],
    transferableObjects: [],
    incompleteFfmpeg: 0,
    scale_width: 0,
    scale_height: 0,
    flag_addr: null,
    array_cmd: null,
    input_intent: null,
    ffmpegModule: null,
    isSharedArrayBufferSupported: false,
    wasm_url: null,
    app_settings: null,
    output_file: null
};

export function resetState() {
    state.worker_pool = [];
    state.output_value = [];
    state.transferableObjects = [];
    state.nameInputs = [];
    state.nameOutputs = [];
    // ...reset other state
}
```

---

### **2. worker-pool-manager.js** (~150 dòng)
**Mục đích:** Quản lý worker pool (encoder/decoder workers)

```javascript
import { state } from './worker-state.js';

export function isMultiThreadMode() {
    return state.isSharedArrayBufferSupported;
}

export function requestPause(index) {
    state.ffmpegModule.HEAPU8[state.flag_addr] = 1;
}

export function requestResume(index) {
    state.ffmpegModule.HEAPU8[state.flag_addr] = 0;
    state.ffmpegModule._resumeTranscode();
}

export function get_worker_name(file_index, stream_index, is_encoder) {
    if (is_encoder) {
        return `encoder-file_index=${file_index}-stream_index=${stream_index}`;
    } else {
        return `decoder-file_index=${file_index}-stream_index=${stream_index}`;
    }
}

export function add_new_worker(config, is_encoder) {
    // Logic tạo worker mới
    // ~100 dòng code
}

export function add_new_encoder(ptr, length) {
    // Logic thêm encoder
}

export function add_new_decoder(ptr, length) {
    // Logic thêm decoder
}

export function get_worker_by_name(name) {
    for (let i = 0; i < state.worker_pool.length; i++) {
        if (state.worker_pool[i].name === name) {
            return state.worker_pool[i];
    }
}

export function flush_coder(file_index, index, is_encoder) {
    // Logic flush coder
}

export async function pausePerform(is_last) {
    // Logic pause performance
    // ~50 dòng code
}

export function check_need_pause() {
    // Logic kiểm tra pause
}
```

---

### **3. io-handler.js** (~150 dòng)
**Mục đích:** Xử lý I/O operations (read/write)

```javascript
import { state } from './worker-state.js';

export function writeOutputData(stream, buffer, offset, length, position, canOwn) {
    // Logic ghi output data
    // ~70 dòng code hiện tại
}

export function readInputData(stream, buffer, offset, length, position) {
    // Logic đọc input data
    // ~50 dòng code hiện tại
}

export function getLengthInput(name, length) {
    if (state.file_map[name]) {
        length = state.file_map[name].size;
    } else if (name.indexOf('blob%3Ahttp') === 0 || 
               name.indexOf('http%3A') === 0 || 
               name.indexOf('https%3A') === 0) {
        length = getUrlLength(decodeURIComponent(name));
    }
    return length;
}

// Helper functions
function handleWriteToWritableStream(filename, data, position) {
    // Logic ghi vào writable stream
}

function handleWriteToRemoteUrl(filename, data) {
    // Logic ghi vào remote URL
}

function handleReadFromFile(filename, position, length) {
    // Logic đọc từ file
}

function handleReadFromUrl(url, position, length) {
    // Logic đọc từ URL
}
```

---

### **4. frame-packet-handler.js** (~150 dòng)
**Mục đích:** Xử lý frame và packet (encoding/decoding)

```javascript
import { state } from './worker-state.js';
import { get_worker_by_name, check_need_pause } from './worker-pool-manager.js';

export function get_new_pkt(file_index, stream_index, pkt_buffer, pts_pkt, duration_pkt, flag_pkt, size_pkt) {
    // Logic lấy packet mới từ encoder
    // ~50 dòng code hiện tại
}

export function get_new_frame(file_index, stream_index, frame_buffer, format_frame, size_frame, decoded_width, decoded_height, pts_frame, flag_frame, duration_frame) {
    // Logic lấy frame mới từ decoder
    // ~40 dòng code hiện tại
}

export function request_decode_packet(file_index, stream_index, data, size, pts, flag, duration) {
    // Logic yêu cầu decode packet
    // ~20 dòng code hiện tại
}

export function request_encode_frame(file_index, index, data, frame_size, format, width, height, pts, pkt_duration) {
    // Logic yêu cầu encode frame
    // ~40 dòng code hiện tại
}

export function get_resolution_output_encoder(code_id, width, height) {
    if (state.scale_width * state.scale_height) {
        return state.scale_width * 10000 + state.scale_height;
    } else {
        return 0;
    }
}

// Helper functions
function get_string_format_from_codec(format) {
    // Convert format từ codec
}

function int64ToArray(value) {
    // Convert int64 to array
}

function int32ToArray(value) {
    // Convert int32 to array
}
```

---

### **5. ffmpeg-manager.js** (~150 dòng)
**Mục đích:** Quản lý FFmpeg module và command processing

```javascript
import { state } from './worker-state.js';

export async function process_ffmpeg(array_cmd) {
    // Logic xử lý FFmpeg command
    // ~70 dòng code hiện tại
}

export async function createFFmpegModule(wasm_url, ffmpeg_url) {
    // Logic tạo FFmpeg module
    // ~60 dòng code hiện tại
}

export function set_flags(flag_addr) {
    state.flag_addr = flag_addr;
}

export function getScriptText() {
    return ``;
}

// Helper functions
function parseFFmpegCommand(array_cmd) {
    // Parse và xử lý command
}

function setupFFmpegCallbacks() {
    return {
        print: handlePrint,
        printErr: handlePrintErr,
        onExit: handleExit,
        locateFile: handleLocateFile,
        mainScriptUrlOrBlob: state.ffmpeg_url
    };
}

function handlePrint(text) {
    // Xử lý print callback
}

function handlePrintErr(text) {
    // Xử lý printErr callback
}

function handleExit(code) {
    // Xử lý exit callback
}
```

---

### **6. file-system-handler.js** (~100 dòng)
**Mục đích:** Xử lý file system operations

```javascript
import { state } from './worker-state.js';

export function openFile(path, flags, mode) {
    // Logic mở file
    // ~40 dòng code hiện tại
}

export async function new_event(event_name, event_value) {
    // Logic xử lý events
    // ~50 dòng code hiện tại
}

export async function completeFfmpeg(index) {
    // Logic hoàn thành FFmpeg
    // ~40 dòng code hiện tại
}

// Helper functions
function handleCloseStream(event_value) {
    // Xử lý close stream event
}

function handleOutputFile(fileName, data) {
    // Xử lý output file
}

function handleCachedUrl(fileName, data) {
    // Xử lý cached URL
}
```

---

### **7. convert-worker.js** (Main entry - ~100 dòng)
**Mục đích:** Entry point, import và export các functions

```javascript
importScripts("constant.js");
importScripts(CONVERT_UTILS_URL);

// Import all modules
importScripts("worker-modules/worker-state.js");
importScripts("worker-modules/worker-pool-manager.js");
importScripts("worker-modules/io-handler.js");
importScripts("worker-modules/frame-packet-handler.js");
importScripts("worker-modules/ffmpeg-manager.js");
importScripts("worker-modules/file-system-handler.js");

// Export to global scope (cho FFmpeg C code gọi)
self.set_flags = set_flags;
self.getScriptText = getScriptText;
self.writeOutputData = writeOutputData;
this.readInputData = readInputData;
this.pausePerform = pausePerform;
this.add_new_encoder = add_new_encoder;
this.add_new_decoder = add_new_decoder;
self.flush_coder = flush_coder;
self.get_new_pkt = get_new_pkt;
self.get_new_frame = get_new_frame;
self.request_decode_packet = request_decode_packet;
self.request_encode_frame = request_encode_frame;
self.getLengthInput = getLengthInput;
self.completeFfmpeg = completeFfmpeg;

// Main message handler
self.onmessage = async function (intent) {
    state.input_intent = intent;
    state.current_cmd = intent.data.cmd;
    state.wasm_url = intent.data.wasm_url;
    state.isSharedArrayBufferSupported = intent.data.isSharedArrayBufferSupported;
    
    importScripts(intent.data.ffmpeg_url);
    state.ffmpegModule = await createFFmpegModule(state.wasm_url, intent.data.ffmpeg_url);

    if (intent.data.app_settings) {
        state.app_settings = intent.data.app_settings;
    }

    if (state.current_cmd === CMD_PERFORM_CONVERT) {
        state.output_value = [];
        state.output_file = intent.data.value.output_file;

        if (intent.data.value.disable_videodecoder) {
            state.enable_videodecoder = false;
        }
        await process_ffmpeg(intent.data.value.cmd);
    } else if (state.current_cmd === CMD_GET_FILE_INFO) {
        state.output_value = [];
        await process_ffmpeg(intent.data.value.cmd);
    }
};
```

---

## 📝 Lộ trình triển khai

### **Phase 1: Chuẩn bị** (1-2 giờ)
1. ✅ Tạo folder `worker-modules/`
2. ✅ Backup file `convert-worker.js` hiện tại
3. ✅ Tạo các file module rỗng

### **Phase 2: Tách State** (30 phút)
1. ✅ Tạo `worker-state.js`
2. ✅ Di chuyển tất cả state variables
3. ✅ Test import trong main file

### **Phase 3: Tách Worker Pool** (1 giờ)
1. ✅ Tạo `worker-pool-manager.js`
2. ✅ Di chuyển worker management functions
3. ✅ Update imports và exports
4. ✅ Test functionality

### **Phase 4: Tách I/O Handler** (1 giờ)
1. ✅ Tạo `io-handler.js`
2. ✅ Di chuyển read/write functions
3. ✅ Test I/O operations

### **Phase 5: Tách Frame/Packet Handler** (1 giờ)
1. ✅ Tạo `frame-packet-handler.js`
2. ✅ Di chuyển encoding/decoding functions
3. ✅ Test frame processing

### **Phase 6: Tách FFmpeg Manager** (1 giờ)
1. ✅ Tạo `ffmpeg-manager.js`
2. ✅ Di chuyển FFmpeg integration code
3. ✅ Test FFmpeg operations

### **Phase 7: Tách File System** (30 phút)
1. ✅ Tạo `file-system-handler.js`
2. ✅ Di chuyển file system functions
3. ✅ Test file operations

### **Phase 8: Refactor Main File** (1 giờ)
1. ✅ Clean up `convert-worker.js`
2. ✅ Setup imports/exports
3. ✅ Test toàn bộ workflow

### **Phase 9: Testing & Documentation** (2 giờ)
1. ✅ Integration testing
2. ✅ Performance testing
3. ✅ Update documentation
4. ✅ Code review

---

## ⚠️ Lưu ý quan trọng

### **1. Web Worker Compatibility**
- Web Worker **KHÔNG hỗ trợ ES6 modules** natively
- Phải sử dụng `importScripts()` thay vì `import/export`
- Các module phải export vào global scope (`self` hoặc `this`)

### **2. Shared State**
- State phải được share giữa các modules
- Sử dụng object reference thay vì copy

### **3. FFmpeg C Code Integration**
- FFmpeg WASM gọi các functions qua global scope
- Phải expose functions lên `self` và `this`

### **4. Performance**
- Minimize số lượng `importScripts()` calls
- Reuse objects thay vì create mới
- Careful với memory leaks trong worker pool

---

## 🎁 Lợi ích sau khi refactor

1. ✅ **Code dễ đọc hơn**: Mỗi file < 200 dòng
2. ✅ **Dễ maintain**: Tách biệt concerns
3. ✅ **Dễ test**: Test từng module riêng
4. ✅ **Dễ mở rộng**: Thêm features mới dễ dàng
5. ✅ **Team collaboration**: Nhiều người có thể làm việc cùng lúc
6. ✅ **Reusability**: Có thể reuse modules trong projects khác

---

## 🚀 Bắt đầu ngay

Bạn muốn tôi bắt đầu implement refactor không? Tôi sẽ làm từng phase một và test kỹ trước khi chuyển phase tiếp theo.
