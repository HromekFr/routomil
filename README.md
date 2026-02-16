# Routomil

**Routomil** is a Chrome extension that syncs planned routes from [Mapy.cz](https://mapy.cz) directly to [Garmin Connect](https://connect.garmin.com) as courses.

## Features

- One-click sync from Mapy.cz to Garmin Connect
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
   - Go to [mapy.cz](https://mapy.cz) and plan a route
   - Open the extension popup
   - Select activity type (Cycling or Hiking)
   - Click "Sync to Garmin"

3. **View Synced Courses:**
   - Open the extension popup to see sync history
   - Click "View" to open the course in Garmin Connect

## How It Works

1. User plans a route on Mapy.cz
2. Extension extracts route parameters from the URL and fetches GPX via Mapy.cz API
3. GPX is converted to Garmin Course JSON format (distances, elevation, bounding box)
4. CSRF token is extracted from Garmin Connect
5. Course is uploaded via Garmin's Course API
6. Course appears in Garmin Connect, ready to send to your device

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
│   ├── content/              # Content scripts for mapy.cz
│   │   ├── mapy-content.ts   # Content script entry point
│   │   └── route-extractor.ts
│   ├── popup/                # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── lib/                  # Shared libraries
│   │   ├── gpx-parser.ts     # GPX parsing + Course JSON conversion
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
- Host permissions for `mapy.cz`, `en.mapy.cz`, `mapy.com`, `sso.garmin.com`, and `connect.garmin.com`

## Security

- Credentials are used only for authentication on Garmin's official site, never stored
- Session tokens are encrypted with AES-GCM
- All communication uses HTTPS
- CSRF protection for Garmin API calls

## Troubleshooting

**"Please log in" error:**
- Session may have expired, log in again via the popup

**Route not detected:**
- Make sure you have a route planned on Mapy.cz
- Refresh the page and try again

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
