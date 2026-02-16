#!/usr/bin/env node
// Syncs version from package.json to manifest.json
// Run automatically by npm version hook

const fs = require('fs');
const path = require('path');

function syncVersion() {
  const rootDir = path.join(__dirname, '..');

  // Read package.json version
  const packagePath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const version = packageJson.version;

  if (!version) {
    console.error('Error: No version found in package.json');
    process.exit(1);
  }

  // Read manifest.json
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Update manifest version
  manifest.version = version;

  // Write back to manifest.json
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`✅ Synced version to ${version} in manifest.json`);
}

syncVersion();
