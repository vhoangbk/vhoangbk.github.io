const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const bodyParser = require('body-parser');
const multer = require('multer');

// Create Express app
const app = express();
const PORT = 8443;
const HOST = '0.0.0.0'; // To be accessible from LAN

// Middleware similar to index.js
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw({
  type: 'application/octet-stream',
  limit: '50000mb'
}));

const publicDir = path.join(__dirname, 'public');

// COOP/COEP Headers for SharedArrayBuffer / FFmpeg WASM
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Serve static files
app.use(express.static(publicDir));

// Handle main routes to serve index.html (SPA fallback if needed, or simple mapping)
app.get('/', (req, res) => {
  // Detect mobile UA logic could be here, but for dev we let user choose
  // Simple redirect logic from index.js if relevant, or just serve index.html
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/m', (req, res) => {
  res.sendFile(path.join(publicDir, 'm-index.html'));
});

// Basic API Mocks if needed (or copy relevant parts from index.js)
// For now, serving static files is the primary goal for testing WASM.
// If upload endpoints are needed, we can copy them. 
// Assuming user just wants to test the client-side heavy logic (WASM).

// SSL Options
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.crt'))
};

// Start HTTPS Server
https.createServer(sslOptions, app).listen(PORT, HOST, () => {
  console.log(`\n✅ HTTPS Dev Server running at https://localhost:${PORT}`);
  console.log(`✅ To test on mobile/external: https://${HOST}:${PORT}`);
  console.log(`⚠️  Note: You will see a security warning browser because cert is self-signed. Accept/Proceed to continue.\n`);
});
