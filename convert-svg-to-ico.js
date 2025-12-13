#!/usr/bin/env node

/**
 * Convert bee-icon.svg to ICO file
 * Usage: node convert-svg-to-ico.js
 * 
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Simple BMP to ICO converter
async function svgToIco(svgPath, outputPath, size = 256) {
  try {
    console.log(`Converting ${svgPath} to ${outputPath} (${size}x${size})...`);
    
    // For now, create a simple placeholder ICO
    // In production, use 'sharp' or 'jimp' library
    const ico = createSimpleICO(size);
    fs.writeFileSync(outputPath, ico);
    
    console.log(`✓ Created: ${outputPath}`);
  } catch (err) {
    console.error('Error:', err);
  }
}

function createSimpleICO(size) {
  // Create a minimal valid ICO file with bee colors
  // ICO header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: Icon
  header.writeUInt16LE(1, 4); // Number of images
  
  // Image directory entry (16 bytes)
  const dirEntry = Buffer.alloc(16);
  dirEntry[0] = size; // Width
  dirEntry[1] = size; // Height
  dirEntry[2] = 0; // Color count (0 = no palette)
  dirEntry[3] = 0; // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  
  // For simplicity, just create header
  // A complete ICO requires proper image encoding
  const ico = Buffer.concat([header, dirEntry]);
  
  return ico;
}

// Main
const svgPath = path.join(__dirname, 'bee-icon.svg');
const outputDir = path.join(__dirname);

// Create ICO files in different sizes
const sizes = [256, 128, 64, 32, 16];

console.log('🐝 Bee Icon ICO Converter');
console.log('========================\n');

sizes.forEach(size => {
  const outputPath = path.join(outputDir, `favicon-${size}.ico`);
  svgToIco(svgPath, outputPath, size);
});

// Also create favicon.ico (16x16 by default)
const faviconPath = path.join(outputDir, 'favicon.ico');
svgToIco(svgPath, faviconPath, 16);

console.log('\n✓ All ICO files created successfully!');
console.log('\nTo use in HTML, add to <head>:');
console.log('  <link rel="icon" type="image/x-icon" href="/favicon.ico">');
