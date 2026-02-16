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
npm run package          # Package for Chrome Web Store
npm run clean            # Remove dist/
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
Update `changelog.log` after every meaningful change (features, fixes, refactors, deps, config). Format: date, description, files affected, impact. Skip for typos and formatting-only changes.

### Security
Never log or expose: credentials, session tokens, CSRF tokens, user GPX data, Garmin API responses with user data. Always use encrypted storage, HTTPS, and clear sensitive data on logout.

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

1. Check `changelog.log` for recent context
2. Read relevant source files before modifying
3. Understand the message flow for the feature area
4. After changes: `npm run build` to verify, update `changelog.log`

## Release Checklist

1. All tests pass: `npm run test:all`
2. Build succeeds: `npm run build`
3. `changelog.log` updated
4. Version synced: `npm version patch` (auto-syncs manifest.json)
5. Package: `npm run package`

## Resources

- `test-course-api.js` - Reference implementation and standalone API test (includes cookie setup instructions)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Garmin Connect](https://connect.garmin.com)
- [Mapy.cz](https://mapy.cz)
