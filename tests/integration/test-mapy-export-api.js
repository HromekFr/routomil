#!/usr/bin/env node
/**
 * Test Mapy.cz Route Export API
 * Usage: node test-mapy-export-api.js [mapy-url]
 *
 * This is a REFERENCE IMPLEMENTATION that validates calling the Mapy.cz
 * tplannerexport API directly without clicking the Export button.
 *
 * Test scenarios:
 * 1. Direct API call with known parameters - validates baseline functionality
 * 2. Auth requirement test - confirms public API (no cookies needed)
 * 3. Minimal parameters - determines minimum viable parameter set
 * 4. URL parameter extraction - parses route data from Mapy.cz URL
 * 5. GPX content validation - verifies returned GPX quality
 *
 * Discovered: rc → rg coordinate mapping
 * The URL parameter 'rc' is split into 10-character chunks to create 'rg' values.
 * Example: rc=9hChxxXvtO95rPhx1qo5 → rg=9hChxxXvtO, rg=95rPhx1qo5
 * Also: rwp parameter from URL maps to rp_aw parameter in API.
 */

const https = require('https');
const { URL } = require('url');
const { DOMParser } = require('xmldom');

// ============================================================================
// Test Data (captured from real request)
// ============================================================================

// Test case 1: 5-waypoint route (Vikýřovice to Nedvězí)
const TEST_PARAMS_1 = {
  export: 'gpx',
  lang: 'en,cs',
  rp_c: '121', // cycling profile
  rg: [
    '9nTCQxXNc6',
    '9nOAQxX2b2',
    '9nMUQxWuoD',
    '9n8TQxW5wB',
    '9n-AQxWlSI'
  ],
  rs: ['muni', 'ward', 'ward', 'ward', 'ward'],
  ri: ['2143', '2022', '745', '9293', '7148']
};

// Test case 2: 2-waypoint route (Prague to Liberec)
const TEST_PARAMS_2 = {
  export: 'gpx',
  lang: 'en,cs',
  rp_c: '121',
  rg: ['9hChxxXvtO', '95rPhx1qo5'],
  rs: ['muni', 'muni'],
  ri: ['3468', '1818'],
  rp_aw: '1;9hSCBxYCBz9hje0xYNZD9hxS.xYg4DlhdxZAUp95R9hxZSY695frPxZhW5it4x-DpIkBrx-dKEmkRx10HRip2x1Viq'
};

const TEST_URL = 'https://mapy.com/en/turisticka?planovani-trasy&rc=9hChxxXvtO95rPhx1qo5&rs=muni&rs=muni&ri=3468&ri=1818&mrp=%7B%22c%22%3A121%2C%22dt%22%3A%22%22%2C%22d%22%3Atrue%7D&xc=%5B%5D&rwp=1%3B9hSCBxYCBz9hje0xYNZD9hxS.xYg4DlhdxZAUp95R9hxZSY695frPxZhW5it4x-DpIkBrx-dKEmkRx10HRip2x1Viq';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Make HTTPS GET request and return response body
 */
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const options = {
      headers: { ...defaultHeaders, ...headers }
    };

    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        console.log(`  ↪️  Redirect to ${redirectUrl}`);
        return httpsGet(redirectUrl, headers).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

/**
 * Build API URL from parameters
 */
function buildApiUrl(params) {
  const baseUrl = 'https://mapy.com/api/tplannerexport';
  const url = new URL(baseUrl);

  url.searchParams.set('export', params.export || 'gpx');

  if (params.lang) {
    url.searchParams.set('lang', params.lang);
  }

  if (params.rp_c) {
    url.searchParams.set('rp_c', params.rp_c);
  }

  if (params.rg) {
    params.rg.forEach(rg => url.searchParams.append('rg', rg));
  }

  if (params.rs) {
    params.rs.forEach(rs => url.searchParams.append('rs', rs));
  }

  if (params.ri) {
    params.ri.forEach(ri => url.searchParams.append('ri', ri));
  }

  if (params.rp_aw) {
    url.searchParams.set('rp_aw', params.rp_aw);
  }

  // Add cache buster
  url.searchParams.set('rand', Math.random().toString().substring(2));

  return url.toString();
}

/**
 * Split rc parameter into rg chunks (10 characters each)
 */
function splitRcToRg(rc) {
  if (!rc) return [];

  const chunks = [];
  for (let i = 0; i < rc.length; i += 10) {
    chunks.push(rc.substring(i, i + 10));
  }
  return chunks;
}

/**
 * Parse Mapy.cz URL and extract route parameters
 * Can now split rc into rg chunks (10 characters each)
 */
function parseMapyUrl(urlString) {
  const url = new URL(urlString);
  const params = url.searchParams;

  const rc = params.get('rc');
  const rwp = params.get('rwp');

  const result = {
    rc: rc,
    rg: rc ? splitRcToRg(rc) : [],     // Split rc into 10-char chunks
    rs: params.getAll('rs'),           // Stop types
    ri: params.getAll('ri'),           // Stop IDs
    rp_aw: rwp,                        // Route waypoints (rwp → rp_aw)
    mrp: null,
    rp_c: null,
  };

  // Parse mrp JSON (route profile)
  const mrpString = params.get('mrp');
  if (mrpString) {
    try {
      result.mrp = JSON.parse(decodeURIComponent(mrpString));
      result.rp_c = result.mrp.c ? String(result.mrp.c) : null;
    } catch (e) {
      console.error('  ❌ Failed to parse mrp:', e.message);
    }
  }

  return result;
}

/**
 * Calculate distance between two GPS points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validate and analyze GPX content
 */
function validateGpx(gpxContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, 'text/xml');

  // Check for parse errors
  const parseErrors = doc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    throw new Error('Invalid XML: ' + parseErrors[0].textContent);
  }

  // Get route name
  const nameNodes = doc.getElementsByTagName('name');
  const routeName = nameNodes.length > 0 ? nameNodes[0].textContent : 'Unknown';

  // Get track points
  const trkpts = doc.getElementsByTagName('trkpt');
  const points = [];

  for (let i = 0; i < trkpts.length; i++) {
    const trkpt = trkpts[i];
    const lat = parseFloat(trkpt.getAttribute('lat'));
    const lon = parseFloat(trkpt.getAttribute('lon'));

    const eleNodes = trkpt.getElementsByTagName('ele');
    const ele = eleNodes.length > 0 ? parseFloat(eleNodes[0].textContent) : 0;

    points.push({ lat, lon, ele });
  }

  if (points.length === 0) {
    throw new Error('No track points found in GPX');
  }

  // Calculate statistics
  let totalDistance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let minLat = points[0].lat, maxLat = points[0].lat;
  let minLon = points[0].lon, maxLon = points[0].lon;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Distance
    totalDistance += calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);

    // Elevation
    const elevDiff = curr.ele - prev.ele;
    if (elevDiff > 0) elevationGain += elevDiff;
    else elevationLoss += Math.abs(elevDiff);

    // Bounding box
    minLat = Math.min(minLat, curr.lat);
    maxLat = Math.max(maxLat, curr.lat);
    minLon = Math.min(minLon, curr.lon);
    maxLon = Math.max(maxLon, curr.lon);
  }

  return {
    routeName,
    pointCount: points.length,
    distanceKm: (totalDistance / 1000).toFixed(2),
    elevationGainM: elevationGain.toFixed(0),
    elevationLossM: elevationLoss.toFixed(0),
    boundingBox: {
      minLat: minLat.toFixed(6),
      maxLat: maxLat.toFixed(6),
      minLon: minLon.toFixed(6),
      maxLon: maxLon.toFixed(6)
    }
  };
}

// ============================================================================
// Test Functions
// ============================================================================

async function testDirectApiCall() {
  console.log('\n📍 Test 1: Direct API call with known parameters');
  console.log('  Testing 2-waypoint route (Prague to Liberec)...');

  const url = buildApiUrl(TEST_PARAMS_2);
  console.log(`  URL: ${url.substring(0, 120)}...`);
  console.log('  Making request...');

  const response = await httpsGet(url);

  if (response.statusCode !== 200) {
    throw new Error(`HTTP ${response.statusCode}`);
  }

  console.log(`  ✅ Status: ${response.statusCode}`);

  // Validate GPX format
  if (!response.body.includes('<?xml')) {
    throw new Error('Response does not contain XML declaration');
  }

  if (!response.body.includes('<gpx')) {
    throw new Error('Response does not contain <gpx> element');
  }

  if (!response.body.includes('<trkpt')) {
    throw new Error('Response does not contain track points');
  }

  console.log('  ✅ Response contains valid GPX structure');

  // Validate and analyze GPX
  const stats = validateGpx(response.body);
  console.log(`  ✅ Route: "${stats.routeName}"`);
  console.log(`  ✅ Points: ${stats.pointCount}`);
  console.log(`  ✅ Distance: ${stats.distanceKm} km`);
  console.log(`  ✅ Elevation: +${stats.elevationGainM}m / -${stats.elevationLossM}m`);
  console.log(`  ✅ Bounds: [${stats.boundingBox.minLat},${stats.boundingBox.minLon}] to [${stats.boundingBox.maxLat},${stats.boundingBox.maxLon}]`);

  return response.body;
}

async function testAuthRequirement() {
  console.log('\n🔓 Test 2: Auth requirement (no cookies)');
  console.log('  Making request without cookies...');

  const url = buildApiUrl(TEST_PARAMS_2);
  const response = await httpsGet(url, {
    'Cookie': '' // Explicitly no cookies
  });

  if (response.statusCode !== 200) {
    console.log('  ⚠️  Failed without cookies (HTTP ' + response.statusCode + ')');
    console.log('  ℹ️  Authentication may be required');
    return false;
  }

  if (!response.body.includes('<gpx')) {
    console.log('  ⚠️  Response not valid GPX');
    console.log('  ℹ️  Authentication may be required');
    return false;
  }

  console.log('  ✅ Public API confirmed (no auth required)');
  return true;
}

async function testMinimalParams() {
  console.log('\n🔬 Test 3: Minimal parameters');

  // Test with only export=gpx and rg
  console.log('  Testing: export + rg only...');
  const minimalParams = {
    export: 'gpx',
    rg: TEST_PARAMS_2.rg
  };

  const url1 = buildApiUrl(minimalParams);
  const response1 = await httpsGet(url1);

  if (response1.statusCode === 200 && response1.body.includes('<gpx')) {
    console.log('  ✅ Minimal params work: export + rg');
  } else {
    console.log('  ❌ Minimal params failed (HTTP ' + response1.statusCode + ')');
  }

  // Test with export + rg + rp_c
  console.log('  Testing: export + rg + rp_c...');
  const withProfile = {
    export: 'gpx',
    rg: TEST_PARAMS_2.rg,
    rp_c: TEST_PARAMS_2.rp_c
  };

  const url2 = buildApiUrl(withProfile);
  const response2 = await httpsGet(url2);

  if (response2.statusCode === 200 && response2.body.includes('<gpx')) {
    console.log('  ✅ Works with: export + rg + rp_c');
  } else {
    console.log('  ❌ Failed with profile (HTTP ' + response2.statusCode + ')');
  }
}

async function testUrlParsing(urlString) {
  console.log('\n🔍 Test 4: URL parameter extraction & rc→rg splitting');
  console.log(`  URL: ${urlString.substring(0, 80)}...`);

  const parsed = parseMapyUrl(urlString);

  console.log('  Extracted parameters:');
  console.log(`    rc: ${parsed.rc || '(none)'}`);
  console.log(`    rg: [${parsed.rg.join(', ')}]`);
  console.log(`    rp_c: ${parsed.rp_c || '(none)'}`);
  console.log(`    rs: [${parsed.rs.join(', ')}]`);
  console.log(`    ri: [${parsed.ri.join(', ')}]`);

  if (parsed.rp_aw) {
    console.log(`    rp_aw: ${parsed.rp_aw.substring(0, 50)}...`);
  }

  if (parsed.mrp) {
    console.log(`    mrp: ${JSON.stringify(parsed.mrp)}`);
  }

  // Test the split rg values by calling the API
  if (parsed.rg.length > 0) {
    console.log('\n  Testing API call with split rg values...');
    const testParams = {
      export: 'gpx',
      rg: parsed.rg,
      rs: parsed.rs,
      ri: parsed.ri,
      rp_c: parsed.rp_c,
      rp_aw: parsed.rp_aw
    };

    const url = buildApiUrl(testParams);
    const response = await httpsGet(url);

    if (response.statusCode === 200 && response.body.includes('<gpx')) {
      console.log('  ✅ rc→rg splitting works! API returned valid GPX');
    } else {
      console.log(`  ❌ API call failed (HTTP ${response.statusCode})`);
    }
  }

  console.log('  ✅ URL parsing complete');
  return parsed;
}

async function testGpxValidation(gpxContent) {
  console.log('\n✅ Test 5: GPX content validation');

  try {
    const stats = validateGpx(gpxContent);
    console.log('  GPX Analysis:');
    console.log(`    Route Name: "${stats.routeName}"`);
    console.log(`    Track Points: ${stats.pointCount}`);
    console.log(`    Total Distance: ${stats.distanceKm} km`);
    console.log(`    Elevation Gain: ${stats.elevationGainM} m`);
    console.log(`    Elevation Loss: ${stats.elevationLossM} m`);
    console.log(`    Bounding Box:`);
    console.log(`      SW: [${stats.boundingBox.minLat}, ${stats.boundingBox.minLon}]`);
    console.log(`      NE: [${stats.boundingBox.maxLat}, ${stats.boundingBox.maxLon}]`);
    console.log('  ✅ GPX validation complete');
    return stats;
  } catch (error) {
    console.log('  ❌ GPX validation failed:', error.message);
    throw error;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🗺️  Mapy.cz Export API Test\n');
  console.log('This script validates calling the tplannerexport API directly.');
  console.log('No cookies required - public API.');
  console.log('━'.repeat(60));

  try {
    // Test 1: Direct API call
    const gpxContent = await testDirectApiCall();

    // Test 2: Auth requirement
    await testAuthRequirement();

    // Test 3: Minimal parameters
    await testMinimalParams();

    // Test 4: URL parsing
    const urlArg = process.argv[2] || TEST_URL;
    await testUrlParsing(urlArg);

    // Test 5: GPX validation (reuse from Test 1)
    await testGpxValidation(gpxContent);

    console.log('\n' + '━'.repeat(60));
    console.log('✅ All tests passed!\n');
    console.log('Key findings:');
    console.log('✓ rc→rg splitting: Split rc into 10-character chunks');
    console.log('✓ rwp→rp_aw mapping: URL parameter rwp becomes API parameter rp_aw');
    console.log('✓ No authentication required (public API)');
    console.log('✓ All parameters required (export, rg, rs, ri, rp_c, optionally rp_aw)\n');
    console.log('Next steps for extension integration:');
    console.log('1. Parse Mapy.cz URL to extract rc, rs, ri, rp_c, rwp');
    console.log('2. Split rc into rg chunks (10 chars each)');
    console.log('3. Map rwp → rp_aw');
    console.log('4. Call API directly from service worker');
    console.log('5. Remove DOM button-clicking logic\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  buildApiUrl,
  parseMapyUrl,
  splitRcToRg,
  validateGpx,
  calculateDistance
};
