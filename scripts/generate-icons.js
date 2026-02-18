#!/usr/bin/env node
// Script to generate PNG icons from source image (assets/routomil_icon_cropped.jpg)

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('Note: sharp is not installed. To auto-generate PNG icons:');
    console.log('  npm install sharp --save-dev');
    console.log('');
    console.log('Alternatively, manually resize assets/routomil_icon_cropped.jpg');
    console.log('and place PNG files in assets/icons/. Required sizes: 16x16, 48x48, 128x128');
    return;
  }

  const sizes = [16, 48, 128];
  const sourceImage = path.join(__dirname, '..', 'assets', 'routomil_icon_cropped.jpg');
  const iconsDir = path.join(__dirname, '..', 'assets', 'icons');

  if (!fs.existsSync(sourceImage)) {
    console.error(`Source image not found: ${sourceImage}`);
    process.exit(1);
  }

  for (const size of sizes) {
    const pngPath = path.join(iconsDir, `icon${size}.png`);
    await sharp(sourceImage)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(pngPath);
    console.log(`Generated: icon${size}.png`);
  }

  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
