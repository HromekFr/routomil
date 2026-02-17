#!/usr/bin/env node
/**
 * Test Garmin Connect User Profile API with cookies
 * Usage: node test-user-profile-api.js cookies.txt
 *
 * This test verifies we can fetch user profile information including:
 * - Display name
 * - Profile image URLs
 * - Other profile metadata
 *
 * Tests two endpoints:
 * 1. /userprofile-service/userprofile/profile - Main profile data
 * 2. /userprofile-service/socialProfile - Social profile with images
 */

const fs = require('fs');
const https = require('https');

// ============================================================================
// Configuration
// ============================================================================

const GARMIN_BASE = 'connect.garmin.com';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Make HTTPS request to Garmin Connect
 */
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
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    const req = https.request(options, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;

        // Check if redirected to SSO/login (means not authenticated)
        if (location && (location.includes('sso.garmin.com') || location.includes('/signin'))) {
          console.log(`   ⚠️  Authentication redirect to: ${location}\n`);
          reject(new Error('Authentication failed - redirected to login'));
          return;
        }

        console.log(`   → Following redirect to: ${location}`);
        const newPath = location.startsWith('http') ? new URL(location).pathname : location;
        return makeRequest(newPath, cookieString).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Test /userprofile-service/userprofile/profile endpoint
 */
async function testProfileEndpoint(cookieString) {
  console.log('📋 Testing: /userprofile-service/userprofile/profile\n');

  try {
    const response = await makeRequest('/userprofile-service/userprofile/profile', cookieString);

    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);

    if (response.status !== 200) {
      console.log(`   ❌ Failed with status ${response.status}`);
      console.log(`   Response: ${response.body.substring(0, 500)}\n`);
      return null;
    }

    // Try to parse JSON
    let profile;
    try {
      profile = JSON.parse(response.body);
    } catch (e) {
      console.log(`   ❌ Failed to parse JSON response`);
      console.log(`   Response: ${response.body.substring(0, 500)}\n`);
      return null;
    }

    console.log(`   ✅ Success!\n`);
    console.log('   Profile Data:');
    console.log(`   - Display Name: ${profile.displayName || 'N/A'}`);
    console.log(`   - Full Name: ${profile.fullName || 'N/A'}`);
    console.log(`   - Email: ${profile.emailAddress ? '[REDACTED]' : 'N/A'}`);
    console.log(`   - User ID: ${profile.userProfileId || profile.id || 'N/A'}`);
    console.log(`   - Profile Image: ${profile.profileImageUrl || profile.profileImageUrlLarge || 'N/A'}`);

    // Show all available fields
    console.log(`\n   Available fields: ${Object.keys(profile).join(', ')}\n`);

    // Save full response for inspection
    fs.writeFileSync('profile-response.json', JSON.stringify(profile, null, 2));
    console.log('   💾 Full response saved to profile-response.json\n');

    return profile;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    return null;
  }
}

/**
 * Test /userprofile-service/socialProfile endpoint
 */
async function testSocialProfileEndpoint(cookieString) {
  console.log('📋 Testing: /userprofile-service/socialProfile\n');

  try {
    const response = await makeRequest('/userprofile-service/socialProfile', cookieString);

    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);

    if (response.status !== 200) {
      console.log(`   ❌ Failed with status ${response.status}`);
      console.log(`   Response: ${response.body.substring(0, 500)}\n`);
      return null;
    }

    // Try to parse JSON
    let profile;
    try {
      profile = JSON.parse(response.body);
    } catch (e) {
      console.log(`   ❌ Failed to parse JSON response`);
      console.log(`   Response: ${response.body.substring(0, 500)}\n`);
      return null;
    }

    console.log(`   ✅ Success!\n`);
    console.log('   Social Profile Data:');
    console.log(`   - Display Name: ${profile.displayName || 'N/A'}`);
    console.log(`   - Full Name: ${profile.fullName || 'N/A'}`);
    console.log(`   - Profile Image (Large): ${profile.profileImageUrlLarge || 'N/A'}`);
    console.log(`   - Profile Image (Medium): ${profile.profileImageUrlMedium || 'N/A'}`);
    console.log(`   - Profile Image (Small): ${profile.profileImageUrlSmall || 'N/A'}`);
    console.log(`   - User Profile ID: ${profile.userProfileId || 'N/A'}`);

    // Show all available fields
    console.log(`\n   Available fields: ${Object.keys(profile).join(', ')}\n`);

    // Save full response for inspection
    fs.writeFileSync('social-profile-response.json', JSON.stringify(profile, null, 2));
    console.log('   💾 Full response saved to social-profile-response.json\n');

    return profile;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    return null;
  }
}

/**
 * Test modern/proxy path (alternative endpoint format)
 */
async function testProxyEndpoint(cookieString) {
  console.log('📋 Testing: /modern/proxy/userprofile-service/socialProfile\n');

  try {
    const response = await makeRequest('/modern/proxy/userprofile-service/socialProfile', cookieString);

    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);

    if (response.status !== 200) {
      console.log(`   ⚠️  Failed with status ${response.status}`);
      console.log(`   Response: ${response.body.substring(0, 200)}\n`);
      return null;
    }

    let profile;
    try {
      profile = JSON.parse(response.body);
    } catch (e) {
      console.log(`   ⚠️  Failed to parse JSON\n`);
      return null;
    }

    console.log(`   ✅ Success! (proxy path works)\n`);
    return profile;
  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}\n`);
    return null;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🧪 Garmin Connect User Profile API Test\n');
  console.log('=' .repeat(60));
  console.log('\n');

  // Check arguments
  if (process.argv.length < 3) {
    console.log(`Usage: node test-user-profile-api.js <cookies-file>

Create a cookies.txt file with your cookies in this format:

session=your_session_value_here
SESSIONID=your_sessionid_value_here
JWT_WEB=your_jwt_value_here
GARMIN-SSO=your_sso_value
GARMIN-SSO-CUST-GUID=your_guid

To get your cookies:
1. Open Chrome and go to https://connect.garmin.com
2. Log in to your Garmin account
3. Open DevTools (F12) -> Application tab -> Cookies
4. Copy the cookie values to cookies.txt

Then run:
  node test-user-profile-api.js cookies.txt
`);
    process.exit(1);
  }

  const cookieFile = process.argv[2];

  // Read cookies
  if (!fs.existsSync(cookieFile)) {
    console.error(`❌ Cookie file not found: ${cookieFile}`);
    process.exit(1);
  }

  console.log(`📖 Reading cookies from: ${cookieFile}`);
  const content = fs.readFileSync(cookieFile, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  if (lines.length === 0) {
    console.error('❌ No cookies found in file');
    process.exit(1);
  }

  const cookieString = lines.join('; ');
  console.log(`   ✓ Found ${lines.length} cookie(s)\n`);
  console.log('=' .repeat(60));
  console.log('\n');

  // Test all endpoints
  const profile = await testProfileEndpoint(cookieString);
  console.log('=' .repeat(60));
  console.log('\n');

  const socialProfile = await testSocialProfileEndpoint(cookieString);
  console.log('=' .repeat(60));
  console.log('\n');

  const proxyProfile = await testProxyEndpoint(cookieString);
  console.log('=' .repeat(60));
  console.log('\n');

  // Summary
  console.log('📊 SUMMARY\n');
  console.log(`Profile Endpoint:        ${profile ? '✅ Working' : '❌ Failed'}`);
  console.log(`Social Profile Endpoint: ${socialProfile ? '✅ Working' : '❌ Failed'}`);
  console.log(`Proxy Endpoint:          ${proxyProfile ? '✅ Working' : '⚠️  Not available'}\n`);

  if (profile || socialProfile) {
    console.log('✅ SUCCESS! We can fetch user profile data.\n');
    console.log('Recommended endpoint for extension:');
    if (socialProfile && (socialProfile.profileImageUrlLarge || socialProfile.profileImageUrlMedium)) {
      console.log('   → /userprofile-service/socialProfile (has profile images)\n');
    } else if (profile) {
      console.log('   → /userprofile-service/userprofile/profile\n');
    }
  } else {
    console.log('❌ FAILED! Could not fetch user profile data.');
    console.log('   Check your cookies or try logging in again.\n');
    process.exit(1);
  }
}

main();
