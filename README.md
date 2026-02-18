# Routomil

**Routomil** is a Chrome extension that syncs planned routes from [Mapy.cz](https://mapy.cz) and [bikerouter.de](https://bikerouter.de) directly to [Garmin Connect](https://connect.garmin.com) as courses.

## Features

- One-click sync from Mapy.cz and bikerouter.de to Garmin Connect
- Supports cycling and hiking activity types
- Creates proper **courses** (not activities) in Garmin Connect
- Preserves elevation data and calculates gain/loss
- Browser-based authentication (supports MFA/2FA)
- Sync history tracking
- Secure session management

## Installation

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```

2. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder

## Usage

1. **Login to Garmin Connect:**
   - Click the extension icon in Chrome toolbar
   - Click "Sign in with Garmin"
   - Log in on the Garmin page that opens (MFA/2FA supported)

2. **Sync a Route:**

   **From Mapy.cz:**
   - Go to [mapy.cz](https://mapy.cz) and plan a route
   - Open the extension popup
   - Select activity type (Cycling or Hiking)
   - Click "Sync to Garmin"

   **From bikerouter.de:**
   - Go to [bikerouter.de](https://bikerouter.de) and add at least 2 waypoints
   - Wait for the route to finish loading (all segments must be computed)
   - Open the extension popup
   - Select activity type and click "Sync to Garmin"

3. **View Synced Courses:**
   - Open the extension popup to see sync history
   - Click "View" to open the course in Garmin Connect

## How It Works

### Mapy.cz

1. User plans a route on Mapy.cz
2. A MAIN world content script uses `SMap.Coords` (Mapy.cz's own coordinate codec) to decode the route's waypoints — including delta-encoded coordinates — and fetches GPX directly from the Mapy.cz export API
3. GPX is converted to Garmin Course JSON format (distances, elevation, bounding box)
4. CSRF token is extracted from Garmin Connect
5. Course is uploaded via Garmin's Course API
6. Course appears in Garmin Connect, ready to send to your device

### bikerouter.de

1. User builds a route on bikerouter.de by placing waypoints
2. A MAIN world content script passively intercepts the BRouter API GeoJSON responses as each segment is computed, keying them by waypoint pair from the URL hash
3. On sync, segments are stitched together in order (removing duplicate join points) and converted to Garmin Course JSON
4. Course is uploaded to Garmin Connect via the same pipeline as Mapy.cz

## Development

```bash
# Watch mode for development
npm run dev

# Production build (includes integration tests)
npm run build

# Run unit tests
npm test

# Run all tests
npm run test:all

# Manual integration tests
npm run test:api   # Test Garmin Course API (requires cookies.txt)
npm run test:mapy  # Test Mapy.cz Export API

# Clean dist folder
npm run clean
```

## Project Structure

```
routomil/
├── manifest.json             # Chrome extension manifest (MV3)
├── src/
│   ├── background/           # Service worker
│   │   ├── service-worker.ts # Main orchestrator
│   │   ├── garmin-auth.ts    # Browser-tab auth + CSRF extraction
│   │   └── garmin-api.ts     # Garmin Course API client
│   ├── content/              # Content scripts
│   │   ├── fetch-interceptor.ts     # MAIN world (mapy.cz): SMap.Coords decode + GPX fetch
│   │   ├── mapy-content.ts          # ISOLATED world (mapy.cz): orchestrates sync flow
│   │   ├── route-extractor.ts
│   │   ├── bikerouter-interceptor.ts # MAIN world (bikerouter.de): BRouter GeoJSON capture
│   │   └── bikerouter-content.ts    # ISOLATED world (bikerouter.de): orchestrates sync flow
│   ├── popup/                # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── lib/                  # Shared libraries
│   │   ├── gpx-parser.ts     # GPX parsing + Course JSON conversion
│   │   ├── brouter-parser.ts # BRouter GeoJSON parsing + segment stitching
│   │   ├── mapy-api.ts       # Mapy.cz Export API client
│   │   ├── mapy-url-parser.ts # Parse Mapy.cz route URLs
│   │   └── storage.ts        # Encrypted token storage
│   └── shared/               # Shared types
│       ├── messages.ts       # IPC types + Garmin Course types
│       └── errors.ts         # Error classes and codes
├── tests/                    # Test suites
│   ├── integration/          # Manual integration tests
│   │   ├── test-course-api.js   # Garmin API reference impl
│   │   └── test-mapy-export-api.js # Mapy API reference impl
│   └── *.test.ts             # Jest unit tests
├── assets/
│   └── icons/                # Extension icons
└── scripts/
    └── generate-icons.js     # SVG to PNG icon generation
```

## Permissions

- `storage` - Encrypted session token storage
- `cookies` - Session cookie capture from Garmin Connect
- Host permissions for `mapy.cz`, `en.mapy.cz`, `mapy.com`, `bikerouter.de`, `sso.garmin.com`, and `connect.garmin.com`

## Security

- Credentials are used only for authentication on Garmin's official site, never stored
- Session tokens are encrypted with AES-GCM
- All communication uses HTTPS
- CSRF protection for Garmin API calls

## Troubleshooting

**"Please log in" error:**
- Session may have expired, log in again via the popup

**Route not detected:**
- Make sure you have a route planned on Mapy.cz or at least 2 waypoints on bikerouter.de
- Refresh the page and try again

**bikerouter.de sync fails with "missing segments":**
- Wait for the route to fully load before syncing — each segment must be computed by BRouter first
- If you modified the route, the new segments need to load before syncing

**Sync fails:**
- Check your internet connection
- Verify Garmin Connect is accessible
- Try logging out and back in

**Debug mode:**
1. Right-click the extension icon → "Inspect"
2. Go to the "Console" tab
3. Look for `[Garmin Auth]` and `[Garmin API]` messages

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/HromekFr/routomil/issues).

## License

[MIT](LICENSE)
