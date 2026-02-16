#!/usr/bin/env node
// Script to generate PNG icons from SVG

const fs = require('fs');
const path = require('path');

// This script requires 'sharp' to be installed: npm install sharp --save-dev
// If sharp is not available, you can manually convert SVG to PNG using online tools

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('Note: sharp is not installed. To auto-generate PNG icons:');
    console.log('  npm install sharp --save-dev');
    console.log('');
    console.log('Alternatively, manually convert the SVG icons in assets/icons/ to PNG format.');
    console.log('Required sizes: 16x16, 48x48, 128x128');
    return;
  }

  const sizes = [16, 48, 128];
  const iconsDir = path.join(__dirname, '..', 'assets', 'icons');

  for (const size of sizes) {
    const svgPath = path.join(iconsDir, `icon${size}.svg`);
    const pngPath = path.join(iconsDir, `icon${size}.png`);

    if (fs.existsSync(svgPath)) {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      console.log(`Generated: icon${size}.png`);
    }
  }

  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
