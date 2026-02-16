#!/usr/bin/env node
// Creates a distributable ZIP file from the built extension

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function packageExtension() {
  const rootDir = path.join(__dirname, '..');

  // Read version from package.json
  const packagePath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const version = packageJson.version;

  // Check dist directory exists
  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  // Create ZIP filename
  const zipName = `routomil-v${version}.zip`;
  const zipPath = path.join(rootDir, zipName);

  // Remove old ZIP if exists
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
    console.log(`Removed old ${zipName}`);
  }

  // Create ZIP using system zip command (available on macOS and Ubuntu)
  // Exclude source maps (.map files)
  try {
    execSync(`cd dist && zip -r ../${zipName} . -x "*.map"`, {
      cwd: rootDir,
      stdio: 'inherit',
    });

    const stats = fs.statSync(zipPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`\n✅ Extension packaged successfully!`);
    console.log(`   File: ${zipName}`);
    console.log(`   Size: ${sizeKB} KB`);
  } catch (error) {
    console.error('Error: Failed to create ZIP file');
    process.exit(1);
  }
}

packageExtension();
