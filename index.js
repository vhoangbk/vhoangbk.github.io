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

const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir, {
  maxAge: "1y",
  etag: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    if (path.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log("✅ Server running on port:", PORT);
  });
}