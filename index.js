const express = require("express");
const path = require("path");
const compression = require('compression');
const cors = require("cors");
const bodyParser = require('body-parser');
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw({ 
  type: 'application/octet-stream', 
  limit: '50000mb' 
}));

const isVercelProd = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const isDev = !isVercelProd && process.env.NODE_ENV !== 'production';
const distPublicDir = path.join(__dirname, "dist", "public");
const fallbackPublicDir = path.join(__dirname, "public");

let publicDir = fallbackPublicDir;
if (isVercelProd) {
  // Trên Vercel, luôn dùng dist/public
  publicDir = distPublicDir;
  console.log(`📁 Serving static assets from ${publicDir}`);
} else {
  // Local dev, dùng public
  publicDir = fallbackPublicDir;
  console.log(`📁 Serving static assets from ${fallbackPublicDir}`);
}

const multer = require('multer');

app.use(bodyParser.raw({ 
  type: 'application/octet-stream', 
  limit: '50000mb' 
}));


// Lưu trạng thái file descriptors đang mở
const openFiles = new Map();

// Cấu hình multer để xử lý file upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50000 * 1024 * 1024 // 500MB
  }
});

//=======
app.use((req, res, next) => {
 // console.log('Setting COOP/COEP headers');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

app.get('/m-index.html', (req, res) => {
  res.redirect(301, '/m');
});

app.use(express.static(publicDir, {
  maxAge: '1d',
  lastModified: true,
  etag: true,
  setHeaders: (res, path) => {

    // if (path.endsWith('.html') || path.endsWith('/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    // }

    // if (path.match(/\.(js|css)$/)) {
    //   res.setHeader('Cache-Control', 'public, max-age=31536000');
    // }

    if (path.endsWith('app_settings.js')) {
      res.setHeader('Cache-Control', 'public, max-age=60'); // 60 giây = 1 phút
      res.setHeader('ETag', `"${Date.now()}"`); // ETag động để force revalidate
    }
  }
}));

app.post('/upload-stream', upload.single('data'), async (req, res) => {
  try {
    const { filename, position, action } = req.body;

    if (!filename || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing filename or action' 
      });
    }

    const dataDir = path.join(__dirname, 'converted_files');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, path.basename(filename));

    // Kiểm tra path traversal
    if (filename.includes('..') || !filePath.startsWith(dataDir)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid file path' 
      });
    }

    if (action === 'write') {
      // Xử lý ghi file

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No data provided' 
        });
      }

      const buffer = req.file.buffer;
      const writePosition = parseInt(position) || 0;
      
      // Mở file để ghi nếu chưa mở
      let fd;
      if (openFiles.has(filePath)) {
        fd = openFiles.get(filePath);
        console.log('📝 Using existing file descriptor for:', filename);
      } else {
        fd = fs.openSync(filePath, 'w+');
        openFiles.set(filePath, fd);
        console.log('📂 Opened new file descriptor for:', filename);
      }
      
      // Ghi dữ liệu tại vị trí chỉ định
      fs.writeSync(fd, buffer, 0, buffer.length, writePosition);
      console.log('=============✍️ Wrote', buffer.length, 'bytes to', filename, 'at position', writePosition);
      
      // Flush dữ liệu xuống disk ngay lập tức
      // try {
      //   fs.fsyncSync(fd);
      //   console.log('💾 Data flushed to disk for:', filename);
      // } catch (err) {
      //   console.warn('⚠️ fsyncSync warning:', err.message);
      // }
      
      // KHÔNG đóng file ở đây, chờ action 'complete'

      res.json({ 
        success: true, 
        bytesWritten: buffer.length,
        message: 'Data written successfully, file remains open'
      });

    } else if (action === 'complete') {
      // Xử lý thông báo hoàn thành và đóng file
      console.log('📋 Data Complete Notification:');
      console.log('  Filename:', filename);
      console.log('  Timestamp:', new Date().toISOString());
      
      // Đóng file descriptor nếu đang mở - QUAN TRỌNG: chỉ closeSync ở đây
      if (openFiles.has(filePath)) {
        const fd = openFiles.get(filePath);
        fs.closeSync(fd);  // ⭐ CHỈ GỌI closeSync KHI ACTION LÀ 'complete'
        openFiles.delete(filePath);
        console.log('🔒 File descriptor closed for:', filename);
      }
      
      // Kiểm tra file đã được tạo thành công
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log('  Final file size:', stats.size, 'bytes');
        
        // Tạo URL đầy đủ với protocol, host và port
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host') || `localhost:${PORT}`;
        const fileUrl = `${protocol}://${host}/converted_files/${path.basename(filename)}`;

        res.json({
          success: true,
          message: 'File operation completed successfully',
          filename: filename,
          fileSize: stats.size,
          timestamp: Date.now(),
          status: 'completed',
          fileClosed: true,
          fileUrl: fileUrl
        });
      } else {
        res.json({
          success: true,
          message: 'Completion notification received (no file found)',
          filename: filename,
          timestamp: Date.now(),
          status: 'completed',
          fileClosed: false
        });
      }

    } else if (action === 'delete') {

      // Xử lý xóa file
      if (fs.existsSync(filePath)) {
        // Đóng file descriptor nếu đang mở
        if (openFiles.has(filePath)) {
          const fd = openFiles.get(filePath);
          fs.closeSync(fd);
          openFiles.delete(filePath);
          console.log('🔒 File descriptor closed for (before delete):', filename);
        }

        fs.unlinkSync(filePath);
        console.log('🗑️ Deleted file:', filename);
        res.json({ 
          success: true, 
          message: 'File deleted successfully' 
        });
      }
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Only "write" and "complete" are supported.' 
      });
    }

  } catch (error) {
    console.error('❌ Error in file operation:', error);
    
    // Nếu có lỗi, cần đóng file descriptor để tránh memory leak
    const { filename } = req.body;
    if (filename) {
      const dataDir = path.join(__dirname, 'data');
      const filePath = path.join(dataDir, path.basename(filename));
      
      if (openFiles.has(filePath)) {
        try {
          const fd = openFiles.get(filePath);
          fs.closeSync(fd);
          openFiles.delete(filePath);
          console.log('🔒 Emergency close file descriptor for:', filename);
        } catch (closeError) {
          console.error('Error closing file descriptor:', closeError);
        }
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
// Serve converted files
app.use('/converted_files', express.static(path.join(__dirname, 'converted_files'), {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, filePath) => {
    // Set proper Content-Type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.mp4') {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (ext === '.avi') {
      res.setHeader('Content-Type', 'video/x-msvideo');
    } else if (ext === '.mov') {
      res.setHeader('Content-Type', 'video/quicktime');
    } else if (ext === '.webm') {
      res.setHeader('Content-Type', 'video/webm');
    } else if (ext === '.jpg' || ext === '.jpeg') {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    } else if (ext === '.gif') {
      res.setHeader('Content-Type', 'image/gif');
    } else if (ext === '.webp') {
      res.setHeader('Content-Type', 'image/webp');
    } else if (ext === '.ico') {
      res.setHeader('Content-Type', 'image/x-icon');
    }
    // Enable download for all converted files
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
  }
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/m", (req, res) => {
  res.sendFile(path.join(publicDir, "m-index.html"));
});

// Cache-Control phân tách môi trường
// app.use((req, res, next) => {
//   const url = req.path;

  // if (isDev) {
  //   // 🚫 DEV MODE = disable cache hoàn toàn
  //   res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  //   res.setHeader('Pragma', 'no-cache');
  //   res.setHeader('Expires', '0');
  //   return next();
  // }

  // 🟢 PRODUCTION MODE
  // if (url.endsWith('.html')) {
  //   res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  // }
  // else if (url.match(/\.(css|js|wasm)(\?v=\d+)?$/)) {
  //   // Có version: cache dài
  //   if (url.includes('?v=')) {
  //     res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  //   } else {
  //     res.setHeader('Cache-Control', 'no-cache');
  //   }
  // }
  // else if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/)) {
  //   res.setHeader('Cache-Control', 'public, max-age=31536000');
  // }

//   next();
// });

module.exports = app;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log("✅ Server running on port:", PORT);
  });
}

