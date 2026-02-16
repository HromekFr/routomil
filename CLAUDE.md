# Routomil - Claude Code Guide

Chrome Extension that syncs routes from Mapy.cz to Garmin Connect.
Tech: Manifest V3, TypeScript, Webpack, Garmin Course API (JSON), browser-tab auth (MFA supported).

## Architecture

```
popup.ts ──msg──> service-worker.ts ──> garmin-auth.ts (login, CSRF token)
                        │                garmin-api.ts  (Course API upload)
                        │
content scripts ──msg──> service-worker.ts
  mapy-content.ts        (orchestrates full sync flow)
  route-extractor.ts
                        │
                  gpx-parser.ts (GPX XML -> GarminCourse JSON)
                  storage.ts    (encrypted tokens, settings, history)
```

**Key principle:** All sensitive operations (auth, API calls, token storage) happen in the background service worker. Content scripts only extract data. Popup is stateless UI.

## Commands

```bash
npm run dev              # Webpack watch mode
npm run build            # Production build (includes icons + integration tests)
npm run build:skip-tests # Build without tests
npm run test             # Unit tests (Jest)
npm run test:integration # Integration tests
npm run test:all         # Full build + all tests
npm run test:api         # Course API test (needs cookies.txt + export.gpx)
npm run test:mapy        # Mapy.cz export API test
npm run package          # Package for Chrome Web Store
npm run clean            # Remove dist/

# Security Analysis (CodeQL CLI)
npm run security         # Full security scan (database + all queries)
npm run security:db      # Create CodeQL database from source
npm run security:analyze # Run all security queries
npm run security:quick   # Quick scan (custom queries only, ~30 sec)
npm run security:view    # View formatted analysis results
npm run security:verify  # Verify CodeQL setup
npm run security:clean   # Remove database and results
```

## Code Organization

| Layer | Files | Responsibility |
|-------|-------|---------------|
| Background | `service-worker.ts` | Orchestrates sync flow, message handling |
| Background | `garmin-auth.ts` | Browser-tab login, session cookies, `getCsrfToken()` |
| Background | `garmin-api.ts` | `uploadCourse()` to Course API endpoint |
| Content | `mapy-content.ts`, `route-extractor.ts` | Extract GPX from mapy.cz pages |
| Popup | `popup.ts`, `popup.html`, `popup.css` | Login UI, route display, sync trigger |
| Lib | `gpx-parser.ts` | `parseGpx()`, `convertGpxToGarminCourse()` |
| Lib | `storage.ts` | Encrypted storage, settings, sync history |
| Shared | `messages.ts` | IPC message types, `GarminCourse` and related types |
| Shared | `errors.ts` | `MapyGarminError` class, error codes |

## Conventions

### Changelog
Update `CHANGELOG.md` after every meaningful change (features, fixes, refactors, deps, config). Format: date, description, files affected, impact. Skip for typos and formatting-only changes.

### Security
Never log or expose: credentials, session tokens, CSRF tokens, user GPX data, Garmin API responses with user data. Always use encrypted storage, HTTPS, and clear sensitive data on logout.

**Security Analysis:** Run `npm run security` before releases to detect vulnerabilities using CodeQL CLI. Custom queries check for token exposure, XSS, encryption issues, CSRF token mishandling, and sensitive data leakage. See `docs/SECURITY_ANALYSIS.md` for complete guide.

### Error Handling
Use `MapyGarminError` from `src/shared/errors.ts` with appropriate error codes. Errors propagate from background to popup via message responses.

### Message Flow
All cross-context communication uses `chrome.runtime.sendMessage` with typed messages defined in `src/shared/messages.ts`. Content script -> service worker -> popup.

### Testing
Use minimal TDD approach for major implementation changes:
1. Write failing test that defines expected behavior
2. Implement minimal code to make test pass
3. Refactor if needed while keeping tests green
4. For minor changes and bug fixes, tests after implementation is acceptable

## Before Starting Work

1. Check `CHANGELOG.md` for recent context
2. Read relevant source files before modifying
3. Understand the message flow for the feature area
4. After changes: `npm run build` to verify, update `CHANGELOG.md`

## Release Checklist

1. All tests pass: `npm run test:all`
2. Security scan clean: `npm run security` (fix all errors, review warnings)
3. Build succeeds: `npm run build`
4. `CHANGELOG.md` updated
5. Version synced: `npm version patch` (auto-syncs manifest.json)
6. Package: `npm run package`

## Resources

- `tests/integration/test-course-api.js` - Reference implementation and standalone API test (includes cookie setup instructions)
- `tests/integration/test-mapy-export-api.js` - Mapy.cz export API reference implementation and validation
- `docs/SECURITY_ANALYSIS.md` - Complete guide for CodeQL security analysis
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Garmin Connect](https://connect.garmin.com)
- [Mapy.cz](https://mapy.cz)
