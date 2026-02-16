# Claude Code Development Guide

## Project Overview

**Routomil** is a Chrome Extension that syncs routes from Mapy.cz to Garmin Connect. It uses:
- Chrome Extension Manifest V3
- TypeScript + Webpack
- Garmin Connect Course API (JSON-based)
- Browser-tab authentication (supports MFA/2FA)

### Current Status: Course API Migration Complete ✅

**✅ Migration Complete:** The extension has been successfully migrated from FIT file uploads to Garmin's Course API.

**Benefits Achieved:**
- ✅ Simpler: JSON API instead of binary FIT encoding
- ✅ Smaller: Ready to remove 370 KB @garmin/fitsdk dependency
- ✅ Correct: Creates courses (not activities)
- ✅ Better: Supports course names, descriptions, waypoints
- ✅ Working: End-to-end sync flow tested and functional

**Implementation Complete:**
- ✅ Phase 1: GPX to JSON conversion (`convertGpxToGarminCourse`)
- ✅ Phase 2: CSRF token extraction (`getCsrfToken`)
- ✅ Phase 3: Course API upload (`uploadCourse`)
- ✅ Phase 4: Service worker integration
- ✅ Phase 5: Type cleanup (removed unused FIT types)
- ✅ Phase 6: FIT dependencies removed (deleted fit-encoder.ts, removed @garmin/fitsdk)
- ✅ Build fixes: Webpack config and CSRF token regex
- ✅ End-to-end testing: Verified working

**Possible Future Enhancements:**
1. Custom course names (input field in popup)
2. Course points/waypoints (from GPX `<wpt>` elements)
3. Course descriptions (notes, instructions)
4. Activity type selection dropdown
5. Favorite flag for important routes

## Garmin Course API (Discovered 2026-02-16)

### API Structure

**Endpoint:**
```
POST https://connect.garmin.com/gc-api/course-service/course
Content-Type: application/json
```

**Authentication:**
- Session cookies: `session`, `SESSIONID`, `JWT_WEB`
- CSRF token: Extract from `<meta name="csrf-token" content="...">`
- Header: `connect-csrf-token: <token>`

**JSON Payload:**
```javascript
{
  activityTypePk: 10,           // 10=cycling, 17=hiking
  courseName: "Route name",
  geoPoints: [                  // Track points with cumulative distance
    {
      latitude: 49.936598,
      longitude: 16.974098,
      elevation: 305.0,
      distance: 0.0,              // Meters from start
      timestamp: 0                // Sequential
    }
  ],
  courseLines: [                  // Line segments
    {
      distanceInMeters: 4602.87,
      sortOrder: 1,
      numberOfPoints: 223,
      bearing: 0,
      coordinateSystem: "WGS84"
    }
  ],
  coursePoints: [],               // Optional waypoints
  boundingBox: {
    lowerLeft: {latitude: ..., longitude: ...},
    upperRight: {latitude: ..., longitude: ...}
  },
  distanceMeter: 4602.87,
  elevationGainMeter: 26.56,
  elevationLossMeter: 12.59,
  startPoint: {...},
  coordinateSystem: "WGS84",
  rulePK: 2,
  sourceTypeId: 3
}
```

**Response:**
```javascript
{
  courseId: 123456789,
  courseName: "Route name",
  distanceMeter: 4602.87,
  createDate: "2026-02-16T13:22:38.753"
}
```

### Implementation Requirements

**1. GPX to JSON Conversion (src/lib/gpx-parser.ts):**
```typescript
function convertGpxToGarminCourse(route: GpxRoute): GarminCourse {
  // Calculate cumulative distances (Haversine formula)
  // Calculate elevation gain/loss
  // Generate bounding box
  // Create course lines structure
  // Return JSON payload
}
```

**2. CSRF Token Extraction (src/background/garmin-auth.ts):**
```typescript
async function getCsrfToken(): Promise<string> {
  // Fetch https://connect.garmin.com/modern (or /app)
  // Parse HTML for <meta name="csrf-token" content="...">
  // Cache token for session
  // Return token
}
```

**3. Course Upload (src/background/garmin-api.ts):**
```typescript
async function uploadCourse(
  courseData: GarminCourse,
  csrfToken: string
): Promise<{ courseId: number; courseName: string }> {
  // POST to /gc-api/course-service/course
  // Headers: connect-csrf-token, Content-Type: application/json
  // Body: JSON.stringify(courseData)
  // Parse response for courseId
}
```

### Possible Future Enhancements

Based on the network analysis, the Course API supports:

**1. Custom Course Names:**
- Add input field in popup to rename before upload
- Override GPX route name
- API accepts any string in `courseName` field

**2. Course Points (Waypoints/POIs):**
```javascript
coursePoints: [
  {
    name: "Turn left here",
    type: 5,                    // 5=generic, 6=summit, 7=water, etc.
    latitude: 49.936598,
    longitude: 16.974098
  }
]
```
- Extract from GPX `<wpt>` elements
- Auto-generate turn instructions
- Add custom POIs

**3. Course Description:**
- API has optional `description` field
- Add notes, instructions, warnings
- Useful for shared courses

**4. Activity Type Selection:**
- Currently cycling (10) or hiking (17)
- Add more types: running (1), mountain biking (5), etc.
- User selectable via popup dropdown

**5. Favorite Flag:**
- `favorite: true/false` in payload
- Add checkbox to mark important routes
- Quick access in Garmin Connect

**6. Course Lines Optimization:**
- Currently single segment
- Split into multiple segments for:
  - Better visualization
  - Section-based navigation
  - Segment timing

### Network Analysis Findings

**Import Flow (2-step process observed):**

1. **Step 1: Import GPX** (optional)
   ```
   POST /gc-api/course-service/course/import
   Content-Type: multipart/form-data
   ```
   - Accepts GPX file upload
   - Parses and enriches data (elevation from DEM)
   - Returns parsed course data
   - Not required if building JSON manually

2. **Step 2: Save Course** (required)
   ```
   POST /gc-api/course-service/course
   Content-Type: application/json
   ```
   - Creates the actual course
   - Returns course ID
   - This is the endpoint to use

**Key Headers Observed:**
- `connect-csrf-token` - Required, extracted from page
- `accept: */*` or `application/json`
- `content-type: application/json`
- `origin: https://connect.garmin.com`
- `referer: https://connect.garmin.com/modern/import-data`
- `user-agent` - Standard browser UA

**Activity Type IDs:**
- 1 = Running
- 2 = Cycling (used in test)
- 5 = Mountain Biking
- 10 = Cycling (alternate?)
- 17 = Hiking
- 18 = Walking

## Changelog Management

### Important: Keep changelog.log Updated

**When making changes to this project, always update `changelog.log`** with:

1. **Date and description** of the change
2. **Files modified** and why
3. **New features** or bug fixes
4. **Breaking changes** or API modifications
5. **Dependencies** added or updated
6. **Known issues** introduced or resolved

### Changelog Format

```
## YYYY-MM-DD - Change Description

### Category (e.g., Feature, Bug Fix, Refactor)
- [x] What was changed
- [x] Files affected: src/path/to/file.ts
- [x] Reason for change
- [ ] Related tasks if not completed

### Impact
- User-facing changes
- Developer-facing changes
- Breaking changes
```

### When to Update

Update the changelog:
- ✅ After implementing new features
- ✅ After fixing bugs
- ✅ When refactoring code
- ✅ When updating dependencies
- ✅ When changing build configuration
- ✅ When modifying authentication flow
- ✅ When updating UI/UX

Don't update for:
- ❌ Typo fixes in comments
- ❌ Code formatting changes
- ❌ Documentation-only updates (unless significant)

## Development Workflow

1. **Before starting work:**
   - Read the plan in the original prompt or README
   - Check changelog.log for context on previous changes
   - Review related files

2. **During development:**
   - Follow the existing code patterns
   - Add comments for complex logic
   - Keep functions focused and small
   - Test authentication flows carefully (credentials are sensitive)

3. **After completing work:**
   - Test the change in Chrome
   - Update changelog.log with implementation details
   - Update README.md if user-facing features changed
   - Run `npm run build` to verify no errors

## Code Organization Principles

### Background Scripts
- Service worker orchestrates all operations
- Garmin auth and API are separate modules
- All sensitive operations happen in background

### Content Scripts
- Minimal DOM manipulation
- Extract data, send to background for processing
- Visual feedback with button states and toasts

### Popup
- Stateless UI that queries background for data
- No business logic - just presentation
- Settings stored via background worker

### Libraries
- Pure functions with no side effects
- Can be tested independently
- GPX/FIT conversions are isolated

## Security Considerations

⚠️ **Never log or expose:**
- User credentials (even in errors)
- Session tokens
- GPX data with personal info
- Garmin API responses with user data

✅ **Always:**
- Use encrypted storage for tokens
- Validate inputs before processing
- Handle errors gracefully
- Use HTTPS for all requests
- Clear sensitive data on logout

## Implementation Status: Course API Integration ✅

### Phase 1: Add JSON Conversion (src/lib/gpx-parser.ts) ✅

**Completed Function:** `convertGpxToGarminCourse(route: GpxRoute): GarminCourse`

Tasks:
- [x] Add distance calculation between points (Haversine formula)
- [x] Calculate cumulative distances for all points
- [x] Calculate elevation gain/loss
- [x] Generate bounding box from lat/lon arrays
- [x] Create course lines structure (single segment)
- [x] Add proper TypeScript types
- [x] Tested with export.gpx and real routes

**Reference:** See `test-course-api.js` lines 52-180 for working implementation.

### Phase 2: Add CSRF Token Extraction (src/background/garmin-auth.ts) ✅

**Completed Function:** `getCsrfToken(): Promise<string>`

Tasks:
- [x] Fetch https://connect.garmin.com/modern
- [x] Handle redirects with `redirect: 'follow'`
- [x] Parse HTML for `<meta name="csrf-token" content="...">`
- [x] Multiple regex patterns for different HTML formats
- [x] Session expiry detection (SSO redirect check)
- [x] Comprehensive error handling and debugging
- [x] Return token string

**Improvements:**
- 6 regex patterns for robust token extraction
- Detailed logging (URL, status, HTML preview)
- SSO redirect detection

**Reference:** See `test-course-api.js` lines 182-229 for working implementation.

### Phase 3: Replace Upload Logic (src/background/garmin-api.ts) ✅

**Completed Function:** `uploadCourse(courseData: GarminCourse, csrfToken: string)`

Tasks:
- [x] Change endpoint to `/gc-api/course-service/course`
- [x] Change Content-Type to `application/json`
- [x] Add `connect-csrf-token` header
- [x] POST JSON body (not multipart/form-data)
- [x] Parse response for `courseId` and `courseName`
- [x] Generate course URL: `https://connect.garmin.com/modern/course/${courseId}`
- [x] Remove FIT-specific error handling
- [x] Add JSON-specific error handling

**Reference:** See `test-course-api.js` lines 231-269 for working implementation.

### Phase 4: Update Service Worker (src/background/service-worker.ts) ✅

**Completed:** `handleSyncRoute()` function updated

Tasks:
- [x] Remove FIT encoding import and call
- [x] Add Course API conversion import
- [x] Get CSRF token before upload
- [x] Pass JSON course data instead of FIT buffer
- [x] Update error messages
- [x] Test full sync flow - ✅ WORKING

### Phase 5: Update Types (src/shared/messages.ts) ✅

**Completed:** All Garmin Course types added

Added Types:
```typescript
interface GarminCourse {
  activityTypePk: number;
  courseName: string;
  geoPoints: GarminGeoPoint[];
  courseLines: GarminCourseLine[];
  coursePoints: GarminCoursePoint[];
  boundingBox: GarminBoundingBox;
  distanceMeter: number;
  elevationGainMeter: number;
  elevationLossMeter: number;
  startPoint: GarminGeoPoint;
  coordinateSystem: "WGS84";
  rulePK: number;
  sourceTypeId: number;
}
```

All related types (GarminGeoPoint, GarminCourseLine, etc.) are implemented.

### Phase 6: Remove FIT Dependencies ✅

**Status:** ✅ COMPLETE - All FIT-related code and dependencies removed

**Completed Tasks:**
- [x] Deleted `src/lib/fit-encoder.ts` (unused)
- [x] Removed `@garmin/fitsdk` from package.json (~370 KB removed)
- [x] Ran `npm install` to clean up dependencies
- [x] Verified no FIT imports remain in src/ directory
- [x] Removed obsolete test files (test-upload.js, diagnose-upload.js, test-with-cookies-file.js)
- [x] Removed unused FIT error codes (FIT_CONVERSION_FAILED, FIT_INVALID_DATA)
- [x] Updated comments (FIT → Course API)
- [x] Rebuilt extension successfully
- [x] Verified bundle size reduction (72.8 KB → 72.4 KB, service-worker.js: 13.8 KB → 13.7 KB)

**Files Kept:**
- `test-course-api.js` - Working Course API implementation
- `test-conversion.js` - GPX to Course JSON conversion test

**Result:** Codebase is now clean with no FIT dependencies or legacy code.

### Phase 7: Testing ✅

**Test Script:**
- [x] Test with cookies.txt - ✅ Working (course ID: 123456789)
- [x] Verify course appears in Garmin Connect - ✅ Confirmed
- [x] Test with different route types - ✅ Cycling works

**Extension Testing:**
- [x] Load extension in Chrome - ✅ Working
- [x] Test login flow - ✅ Working (supports MFA)
- [x] Plan route on mapy.cz - ✅ Working
- [x] Sync from popup - ✅ Working
- [x] Verify course created - ✅ Working
- [x] Check sync history - ✅ Working
- [x] Test logout - ✅ Working
- [x] Test error states - ✅ Working

**All tests passed! Extension is fully functional.**

### Phase 8: Documentation ✅

- [x] Update changelog.log - ✅ Complete with Phase 4 entry
- [x] Update README.md - ✅ Done
- [x] Update CLAUDE.md - ✅ Complete
- [x] Document CSRF token extraction
- [x] Document Course API implementation
- [ ] Add API documentation (optional)
- [ ] Update troubleshooting guide (optional)

## Testing Checklist ✅

All tests completed successfully:

- [x] Extension loads without errors - ✅ Working
- [x] Route detected in popup on mapy.cz - ✅ Working
- [x] Login flow works (test with real account) - ✅ Working (MFA supported)
- [x] GPX extraction succeeds - ✅ Working
- [x] JSON conversion produces valid structure - ✅ Working
- [x] CSRF token extraction succeeds - ✅ Working (6 regex patterns)
- [x] Upload to Garmin Connect succeeds - ✅ Working
- [x] Course appears in Garmin Connect Courses section - ✅ Verified
- [x] Course can be sent to device - ✅ Available
- [x] Logout clears session - ✅ Working
- [x] Error states show user-friendly messages - ✅ Working
- [x] Sync history updates correctly - ✅ Working
- [x] Bundle size optimized - ✅ 43 KB total (ready for 370 KB FIT removal)

## Common Issues

### Build Errors
- TypeScript errors: Check types in messages.ts
- Missing imports: Verify file paths
- Webpack errors: Check webpack.config.js loaders
- xmldom warning: Safe to ignore (only used in test script, not extension)

### Runtime Errors
- "Not authenticated": User needs to log in via popup
- "GPX extraction failed": mapy.cz page structure changed
- "CSRF token not found": ✅ FIXED - Now uses 6 regex patterns with redirect handling
- "Upload failed": Check Garmin Connect status or session expired
- "Course creation failed": Check JSON payload structure and API response

**CSRF Token Extraction:**
- ✅ Multiple regex patterns handle different HTML formats
- ✅ Explicit redirect following
- ✅ SSO redirect detection (session expiry)
- ✅ Detailed debugging logs (URL, status, HTML preview)
- If still failing: Check console for "Final URL" and "HTML preview" logs

### Authentication Issues
- **✅ MFA/2FA Supported:** Browser-tab login allows MFA
- Session expired: Re-login via popup (cookies cleared)
- Cookies not captured: Check tab permissions
- CSRF token expired: Token is session-based, re-login if needed

### Course API Issues
- **Response 401 (Unauthorized):** Session cookies missing or expired
- **Response 403 (Forbidden):** CSRF token missing or invalid
- **Response 400 (Bad Request):** Invalid JSON payload structure
- **Response 409 (Conflict):** Course with same name already exists
- **HTML Response Instead of JSON:** Authentication redirected to login page

**Debugging Course API:**
1. Test with standalone script: `node test-course-api.js cookies.txt export.gpx`
2. Check cookies are valid: Verify in Chrome DevTools
3. Check CSRF token extraction: Log token value
4. Validate JSON payload: Use JSON.stringify with pretty print
5. Check network tab: Look for actual request/response

## File Reference

### Core Files
- `manifest.json` - Extension configuration and permissions
- `src/background/service-worker.ts` - Main orchestrator, sync flow coordination
- `src/content/mapy-content.ts` - Content script entry point, GPX parsing
- `src/popup/popup.ts` - Popup UI logic, route detection, sync trigger

### Authentication & API
- `src/background/garmin-auth.ts` - Browser-tab authentication, session management, CSRF token extraction
- `src/background/garmin-api.ts` - Garmin Course API client
- `src/lib/storage.ts` - Encrypted token storage, settings, sync history

### Data Processing
- `src/lib/gpx-parser.ts` - Parse GPX XML, extract route data, convert to Garmin Course JSON

### UI Components
- `src/content/button-injector.ts` - [UNUSED] Page button injection (removed)
- `src/content/route-extractor.ts` - Extract GPX from mapy.cz page
- `src/popup/popup.html` - Popup layout, login UI, sync controls
- `src/popup/popup.css` - Popup styling

### Types & Errors
- `src/shared/messages.ts` - IPC message types, Garmin Course API types
- `src/shared/errors.ts` - Custom error classes and error codes

### Test Files
- `test-course-api.js` - ✅ Working proof of concept for Course API
  - Reference implementation for GPX → JSON conversion
  - CSRF token extraction
  - Course upload
  - Complete working example
- `export.gpx` - Sample GPX file for testing (166 points, 4.6 km)
- `cookies.txt` - Cookie file format for testing (not committed)

## Useful Commands

```bash
# Development with watch mode
npm run dev

# Production build
npm run build

# Clean build artifacts
npm run clean

# Regenerate icons
npm run icons

# Test Course API (standalone)
node test-course-api.js cookies.txt export.gpx
```

## Getting Cookies for Testing

To test the Course API with `test-course-api.js`, you need session cookies from Garmin Connect:

1. **Log into Garmin Connect** in Chrome
2. **Open DevTools** (F12)
3. **Go to Application tab** → Cookies → https://connect.garmin.com
4. **Copy these cookies to cookies.txt** (one per line, format: `name=value`):
   - `session` - Main session cookie (long encrypted string)
   - `SESSIONID` - Session identifier
   - `JWT_WEB` - JWT authentication token
   - `GARMIN-SSO` - SSO flag
   - `GARMIN-SSO-CUST-GUID` - Customer GUID

**Example cookies.txt:**
```
session=your-session-token-here...
SESSIONID=abc123...
JWT_WEB=eyJhbGc...
GARMIN-SSO=1
GARMIN-SSO-CUST-GUID=your-guid-here
```

**Test the API:**
```bash
node test-course-api.js cookies.txt export.gpx
```

**Expected Output:**
```
✅ SUCCESS! Course created!

Course ID: 123456789
Course Name: Sample route along Vltava River, Prague
Distance: 4.60 km
View at: https://connect.garmin.com/modern/course/123456789
```

## Contact & Resources

- [Garmin FIT SDK](https://github.com/garmin/fit-javascript-sdk)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Mapy.cz](https://mapy.cz)
- [Garmin Connect](https://connect.garmin.com)
