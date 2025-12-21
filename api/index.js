const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require('body-parser');
const fs = require("fs");
const multer = require('multer');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw({ 
  type: 'application/octet-stream', 
  limit: '50000mb' 
}));

// Lưu trạng thái file descriptors đang mở
const openFiles = new Map();

// Cấu hình multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50000 * 1024 * 1024 // 500MB
  }
});

// API Route: Upload stream
app.post('/upload-stream', upload.single('data'), async (req, res) => {
  try {
    const { filename, action } = req.body;

    if (!filename || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing filename or action' 
      });
    }

    // Sử dụng /tmp trên Vercel (writable directory)
    const dataDir = path.join('/tmp', 'converted_files');
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
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No data provided' 
        });
      }

      const buffer = req.file.buffer;
      
      let fd;
      if (openFiles.has(filePath)) {
        fd = openFiles.get(filePath);
      } else {
        fd = fs.openSync(filePath, 'a+');
        openFiles.set(filePath, fd);
      }
      
      fs.writeSync(fd, buffer, 0, buffer.length);

      res.json({ 
        success: true, 
        bytesWritten: buffer.length,
        message: 'Data written successfully'
      });

    } else if (action === 'complete') {
      if (openFiles.has(filePath)) {
        const fd = openFiles.get(filePath);
        fs.closeSync(fd);
        openFiles.delete(filePath);
      }
      
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host') || 'localhost';
        const fileUrl = `${protocol}://${host}/api/converted_files/${path.basename(filename)}`;

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
          message: 'Completion notification received',
          filename: filename,
          timestamp: Date.now(),
          status: 'completed'
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
    
    const { filename } = req.body;
    if (filename) {
      const dataDir = path.join('/tmp', 'converted_files');
      const filePath = path.join(dataDir, path.basename(filename));
      
      if (openFiles.has(filePath)) {
        try {
          const fd = openFiles.get(filePath);
          fs.closeSync(fd);
          openFiles.delete(filePath);
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

// Serve converted files từ /tmp
app.use('/converted_files', express.static(path.join('/tmp', 'converted_files'), {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon'
    };
    if (contentTypes[ext]) {
      res.setHeader('Content-Type', contentTypes[ext]);
    }
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
  }
}));

module.exports = app;
