#!/usr/bin/env node
/**
 * Cookie formatter - cleans and validates cookie strings
 * Usage: node format-cookies.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🍪 Cookie Formatter\n');
console.log('Paste your cookie values below (one per line in format: name=value)');
console.log('Press Ctrl+D (Mac/Linux) or Ctrl+Z (Windows) when done.\n');

const cookies = [];

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed) {
    // Remove any whitespace and newlines within the value
    const cleaned = trimmed.replace(/\s+/g, ' ').trim();
    cookies.push(cleaned);
  }
});

rl.on('close', () => {
  if (cookies.length === 0) {
    console.log('\n❌ No cookies provided\n');
    process.exit(1);
  }

  console.log(`\n✓ Parsed ${cookies.length} cookie(s)\n`);

  // Join with semicolon and space
  const cookieString = cookies.join('; ');

  // Validate no invalid characters
  const hasInvalidChars = /[\r\n\t]/.test(cookieString);
  if (hasInvalidChars) {
    console.log('⚠️  Warning: Cookie string contains newlines or tabs. Cleaning...\n');
  }

  // Clean the string
  const cleanedString = cookieString.replace(/[\r\n\t]/g, '');

  console.log('📋 Formatted cookie string:\n');
  console.log('─'.repeat(80));
  console.log(cleanedString);
  console.log('─'.repeat(80));

  console.log('\n📝 To use with test script:\n');
  console.log('export GARMIN_COOKIES="' + cleanedString.replace(/"/g, '\\"') + '"');
  console.log('npm run diagnose\n');

  console.log('Or directly:\n');
  console.log('node test-upload.js export.gpx --cookies "' + cleanedString.replace(/"/g, '\\"') + '"\n');

  // Check for important cookies
  console.log('🔍 Cookie analysis:');
  const cookieNames = cookies.map(c => c.split('=')[0]);
  console.log(`   Found: ${cookieNames.join(', ')}\n`);

  const hasSession = cookieNames.some(n => n.toLowerCase() === 'session');
  const hasSessionId = cookieNames.some(n => n.toLowerCase() === 'sessionid');
  const hasJwt = cookieNames.some(n => n.toLowerCase().includes('jwt'));

  if (hasSession) console.log('   ✓ session cookie present');
  if (hasSessionId) console.log('   ✓ SESSIONID cookie present');
  if (hasJwt) console.log('   ✓ JWT token present');

  if (!hasSession && !hasSessionId) {
    console.log('   ⚠️  No session cookies found - upload may fail\n');
  } else {
    console.log('   ✓ Authentication cookies look valid\n');
  }
});

console.log('Example format:');
console.log('session=abc123...');
console.log('SESSIONID=xyz789...');
console.log('JWT_WEB=eyJhbG...\n');
