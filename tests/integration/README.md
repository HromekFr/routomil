# Integration Tests

Standalone integration test scripts that validate external API functionality.

## Scripts

### test-course-api.js

Reference implementation for testing the Garmin Connect Course API.

**Purpose:** Proves that the Course API works and serves as a reference for the extension implementation.

**Requirements:**
- `cookies.txt` - Garmin Connect session cookies
- `export.gpx` - Sample GPX file to upload (optional, uses default)

**Usage:**
```bash
npm run test:api
# or
node tests/integration/test-course-api.js cookies.txt export.gpx
```

**Key functions:**
- `parseGPX()` - Extracting track points from GPX XML
- `convertToGarminCourse()` - Converting GPX to Garmin Course JSON
- `calculateDistance()` - Haversine distance formula
- `fetchCSRFToken()` - Extracting CSRF token from page
- `uploadCourse()` - Posting course to Garmin API

**Output:** Creates a course in Garmin Connect at `https://connect.garmin.com/modern/course/<courseId>`

---

### test-mapy-export-api.js

Reference implementation for testing the Mapy.cz Route Export API.

**Purpose:** Validates calling the Mapy.cz tplannerexport API directly without user interaction.

**Usage:**
```bash
npm run test:mapy
# or
node tests/integration/test-mapy-export-api.js [mapy-url]
```

**Test scenarios:**
1. Direct API call with known parameters - validates baseline functionality
2. Auth requirement test - confirms public API (no cookies needed)
3. Minimal parameters - determines minimum viable parameter set
4. URL parameter extraction - parses route data from Mapy.cz URL
5. GPX content validation - verifies returned GPX quality

**Key discovery:**
- URL parameter `rc` is split into 10-character chunks to create `rg` values
- Example: `rc=9hChxxXvtO95rPhx1qo5` → `rg=9hChxxXvtO` + `rg=95rPhx1qo5`
- `rwp` parameter from URL maps to `rp_aw` parameter in API

---

## Running All Tests

```bash
npm run test:all  # Runs all tests including these integration tests
```

## Notes

These scripts are standalone reference implementations, not Jest tests. They require manual execution and external resources (cookies, URLs).
