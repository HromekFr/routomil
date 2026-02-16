#!/usr/bin/env node
/**
 * Test Garmin Connect Course API with cookies
 * Usage: node test-course-api.js cookies.txt [export.gpx]
 *
 * This is a REFERENCE IMPLEMENTATION that proves the Course API works.
 * Use this code as a guide when implementing the API in the extension.
 *
 * Key functions to reference:
 * - parseGPX() - Extracting track points from GPX XML
 * - convertToGarminCourse() - Converting GPX to Garmin Course JSON
 * - calculateDistance() - Haversine distance formula
 * - fetchCSRFToken() - Extracting CSRF token from page
 * - uploadCourse() - Posting course to Garmin API
 *
 * Successful test: Creates a course in Garmin Connect
 * View at: https://connect.garmin.com/modern/course/<courseId>
 */

const fs = require('fs');
const https = require('https');
const { DOMParser } = require('xmldom');

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_GPX = 'export.gpx';
const GARMIN_BASE = 'connect.garmin.com';

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Parse GPX file and extract track points
 */
function parseGPX(gpxContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, 'text/xml');

  // Get track name
  const nameNode = doc.getElementsByTagName('name')[0];
  const courseName = nameNode ? nameNode.textContent : 'Imported Course';

  // Get all track points
  const trkpts = doc.getElementsByTagName('trkpt');
  const points = [];

  for (let i = 0; i < trkpts.length; i++) {
    const trkpt = trkpts[i];
    const lat = parseFloat(trkpt.getAttribute('lat'));
    const lon = parseFloat(trkpt.getAttribute('lon'));

    const eleNodes = trkpt.getElementsByTagName('ele');
    const ele = eleNodes.length > 0 ? parseFloat(eleNodes[0].textContent) : 0;

    points.push({ latitude: lat, longitude: lon, elevation: ele });
  }

  return { courseName, points };
}

/**
 * Convert GPX points to Garmin Course JSON format
 */
function convertToGarminCourse(courseName, points, userProfilePk = null) {
  if (points.length === 0) {
    throw new Error('No points in GPX file');
  }

  // Calculate distances and timestamps
  let cumulativeDistance = 0;
  const geoPoints = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    // Calculate distance from previous point
    if (i > 0) {
      const prev = points[i - 1];
      const dist = calculateDistance(prev.latitude, prev.longitude, point.latitude, point.longitude);
      cumulativeDistance += dist;
    }

    geoPoints.push({
      latitude: point.latitude,
      longitude: point.longitude,
      elevation: point.elevation,
      distance: cumulativeDistance,
      timestamp: i === 0 ? 0 : null
    });
  }

  // Calculate elevation gain/loss
  let elevationGain = 0;
  let elevationLoss = 0;

  for (let i = 1; i < points.length; i++) {
    const diff = points[i].elevation - points[i - 1].elevation;
    if (diff > 0) {
      elevationGain += diff;
    } else {
      elevationLoss += Math.abs(diff);
    }
  }

  // Calculate bounding box
  const lats = points.map(p => p.latitude);
  const lons = points.map(p => p.longitude);

  const boundingBox = {
    lowerLeft: {
      latitude: Math.min(...lats),
      longitude: Math.min(...lons)
    },
    upperRight: {
      latitude: Math.max(...lats),
      longitude: Math.max(...lons)
    },
    lowerLeftLatIsSet: true,
    lowerLeftLongIsSet: true,
    upperRightLatIsSet: true,
    upperRightLongIsSet: true
  };

  // Create course lines (simple: one segment)
  const courseLines = [{
    points: null,
    distanceInMeters: cumulativeDistance,
    courseId: null,
    sortOrder: 1,
    numberOfPoints: points.length,
    bearing: 0,
    coordinateSystem: "WGS84"
  }];

  // Build the course object
  const course = {
    activityTypePk: 10, // Cycling
    hasTurnDetectionDisabled: false,
    geoPoints: geoPoints,
    courseLines: courseLines,
    boundingBox: boundingBox,
    coursePoints: [],
    distanceMeter: cumulativeDistance,
    elevationGainMeter: parseFloat(elevationGain.toFixed(2)),
    elevationLossMeter: parseFloat(elevationLoss.toFixed(2)),
    startPoint: {
      longitude: points[0].longitude,
      latitude: points[0].latitude,
      timestamp: null,
      elevation: points[0].elevation,
      distance: 0
    },
    elapsedSeconds: null,
    openStreetMap: false,
    coordinateSystem: "WGS84",
    rulePK: 2,
    courseName: courseName,
    matchedToSegments: false,
    includeLaps: false,
    hasPaceBand: false,
    hasPowerGuide: false,
    favorite: false,
    speedMeterPerSecond: null,
    sourceTypeId: 3
  };

  if (userProfilePk) {
    course.userProfilePk = userProfilePk;
  }

  return course;
}

/**
 * Fetch CSRF token from Garmin Connect
 */
function fetchCSRFToken(cookieString, path = '/modern') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GARMIN_BASE,
      path: path,
      method: 'GET',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    const req = https.request(options, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;

        // Check if it's a path-only redirect (not to SSO/login)
        if (location && !location.includes('sso.garmin.com') && !location.includes('/signin')) {
          console.log(`   → Following redirect to: ${location}`);
          const newPath = location.startsWith('http') ? new URL(location).pathname : location;
          return fetchCSRFToken(cookieString, newPath).then(resolve).catch(reject);
        } else {
          console.log(`   ⚠️  Authentication redirect to: ${location}\n`);
          reject(new Error('Authentication failed - redirected to login'));
          return;
        }
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract CSRF token from meta tag
        const match = data.match(/<meta name="csrf-token" content="([^"]+)"/);
        if (match) {
          resolve(match[1]);
        } else {
          // Try alternate format
          const match2 = data.match(/csrf-token["']\s*content=["']([^"']+)/i);
          if (match2) {
            resolve(match2[1]);
          } else {
            // Save response for debugging
            fs.writeFileSync('csrf-response.html', data);
            console.log('   💾 Response saved to csrf-response.html for debugging\n');
            reject(new Error('CSRF token not found in page'));
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Upload course to Garmin Connect
 */
function uploadCourse(courseData, cookieString, csrfToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(courseData);

    const options = {
      hostname: GARMIN_BASE,
      path: '/gc-api/course-service/course',
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': '*/*',
        'connect-csrf-token': csrfToken,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://connect.garmin.com',
        'Referer': 'https://connect.garmin.com/modern/import-data'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🧪 Garmin Connect Course API Test\n');

  // Check arguments
  if (process.argv.length < 3) {
    console.log(`Usage: node test-course-api.js <cookies-file> [gpx-file]

Create a cookies.txt file with your cookies in this format:

session=your_session_value_here
SESSIONID=your_sessionid_value_here
JWT_WEB=your_jwt_value_here
GARMIN-SSO=your_sso_value
GARMIN-SSO-CUST-GUID=your_guid

Then run:
  node test-course-api.js cookies.txt export.gpx
`);
    process.exit(1);
  }

  const cookieFile = process.argv[2];
  const gpxFile = process.argv[3] || DEFAULT_GPX;

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

  // Read GPX file
  if (!fs.existsSync(gpxFile)) {
    console.error(`❌ GPX file not found: ${gpxFile}`);
    process.exit(1);
  }

  console.log(`📖 Reading GPX file: ${gpxFile}`);
  const gpxContent = fs.readFileSync(gpxFile, 'utf-8');
  const { courseName, points } = parseGPX(gpxContent);
  console.log(`   ✓ Course name: ${courseName}`);
  console.log(`   ✓ Points: ${points.length}\n`);

  // Convert to Garmin format
  console.log('🔄 Converting to Garmin Course format...');
  const courseData = convertToGarminCourse(courseName, points);
  console.log(`   ✓ Distance: ${(courseData.distanceMeter / 1000).toFixed(2)} km`);
  console.log(`   ✓ Elevation gain: ${courseData.elevationGainMeter.toFixed(1)} m`);
  console.log(`   ✓ Elevation loss: ${courseData.elevationLossMeter.toFixed(1)} m\n`);

  // Fetch CSRF token
  console.log('🔑 Fetching CSRF token...');
  try {
    const csrfToken = await fetchCSRFToken(cookieString);
    console.log(`   ✓ Token: ${csrfToken}\n`);

    // Upload course
    console.log('📤 Uploading course to Garmin Connect...');
    const result = await uploadCourse(courseData, cookieString, csrfToken);

    console.log(`\n📊 Response Status: ${result.status}\n`);

    if (result.status === 200 && result.data.courseId) {
      console.log('✅ SUCCESS! Course created!\n');
      console.log(`Course ID: ${result.data.courseId}`);
      console.log(`Course Name: ${result.data.courseName}`);
      console.log(`Distance: ${(result.data.distanceMeter / 1000).toFixed(2)} km`);
      console.log(`View at: https://connect.garmin.com/modern/course/${result.data.courseId}\n`);
    } else {
      console.log('❌ Upload failed\n');
      console.log('Response:', JSON.stringify(result.data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
