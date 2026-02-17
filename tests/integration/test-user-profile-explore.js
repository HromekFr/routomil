#!/usr/bin/env node
/**
 * Explore Garmin Connect User Profile API endpoints
 * Try different path variations to find the working endpoint
 */

const fs = require('fs');
const https = require('https');

const GARMIN_BASE = 'connect.garmin.com';

function makeRequest(path, cookieString) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GARMIN_BASE,
      path: path,
      method: 'GET',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://connect.garmin.com/modern/'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          location: res.headers.location
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testEndpoint(path, cookieString, description) {
  try {
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`   Path: ${path}`);

    const response = await makeRequest(path, cookieString);

    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);

    if (response.location) {
      console.log(`   Redirect: ${response.location}`);
    }

    // Try to parse as JSON
    if (response.body && response.body.trim().startsWith('{')) {
      try {
        const json = JSON.parse(response.body);
        console.log(`   ✅ Valid JSON response!`);
        console.log(`   Keys: ${Object.keys(json).join(', ')}`);

        // Check for user info
        if (json.displayName) console.log(`   📝 Display Name: ${json.displayName}`);
        if (json.fullName) console.log(`   📝 Full Name: ${json.fullName}`);
        if (json.profileImageUrlLarge) console.log(`   🖼️  Profile Image: ${json.profileImageUrlLarge}`);

        return json;
      } catch (e) {
        console.log(`   ⚠️  Not valid JSON`);
      }
    } else {
      console.log(`   ⚠️  Not JSON (HTML response)`);
    }

    return null;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🧪 Garmin Connect User Profile API Explorer\n');

  if (process.argv.length < 3) {
    console.log('Usage: node test-user-profile-explore.js cookies.txt');
    process.exit(1);
  }

  const cookieFile = process.argv[2];
  const content = fs.readFileSync(cookieFile, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const cookieString = lines.join('; ');

  console.log(`📖 Loaded ${lines.length} cookies\n`);
  console.log('=' .repeat(60));

  // Test various endpoint variations
  const endpoints = [
    // Old API paths
    ['/userprofile-service/userprofile', 'Old userprofile service'],
    ['/userprofile-service/socialProfile', 'Old social profile service'],

    // Modern proxy paths
    ['/modern/proxy/userprofile-service/userprofile', 'Modern proxy userprofile'],
    ['/modern/proxy/userprofile-service/socialProfile', 'Modern proxy social profile'],

    // App proxy paths (new?)
    ['/app/proxy/userprofile-service/userprofile', 'App proxy userprofile'],
    ['/app/proxy/userprofile-service/socialProfile', 'App proxy social profile'],

    // Web API paths
    ['/web-api/userprofile-service/userprofile', 'Web API userprofile'],
    ['/web-api/userprofile-service/socialProfile', 'Web API social profile'],

    // Direct modern paths
    ['/modern/profile', 'Modern profile page'],
    ['/modern/userprofile', 'Modern userprofile'],

    // User service paths
    ['/userprofile-service/user', 'User service user'],
    ['/modern/proxy/userprofile-service/user', 'Modern proxy user service'],

    // Try with displayName endpoint
    ['/proxy/userprofile-service/userprofile', 'Proxy userprofile'],
    ['/proxy/userprofile-service/socialProfile', 'Proxy social profile'],
  ];

  const results = [];

  for (const [path, description] of endpoints) {
    const result = await testEndpoint(path, cookieString, description);
    if (result) {
      results.push({ path, description, data: result });
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n');
  console.log('=' .repeat(60));
  console.log('\n📊 RESULTS\n');

  if (results.length > 0) {
    console.log(`✅ Found ${results.length} working endpoint(s):\n`);
    results.forEach(r => {
      console.log(`   • ${r.path}`);
      console.log(`     ${r.description}`);
      if (r.data.displayName) console.log(`     Display Name: ${r.data.displayName}`);
      console.log('');
    });

    // Save first successful result
    if (results[0]) {
      fs.writeFileSync('profile-found.json', JSON.stringify(results[0].data, null, 2));
      console.log('💾 Profile data saved to profile-found.json\n');
    }
  } else {
    console.log('❌ No working endpoints found\n');
    console.log('💡 Suggestion: Use Chrome DevTools Network tab to inspect');
    console.log('   what endpoints the actual Garmin Connect website uses.\n');
  }
}

main();
