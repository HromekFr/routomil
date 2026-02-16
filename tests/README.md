# Test Directory

This directory contains all automated tests for the extension.

## Test Types

### Integration Tests (Recommended) ✅

**File:** `extension-integration.test.js`

**Purpose:** Fast, reliable tests that validate build output without requiring a browser.

**Run:**
```bash
npm run test:integration
```

**What it tests:**
- ✅ No CommonJS exports in browser bundles (prevents "module is not defined")
- ✅ No Node.js globals in browser code
- ✅ Valid JavaScript syntax
- ✅ Manifest structure
- ✅ All required files present
- ✅ Reasonable bundle sizes

**Speed:** ~0.5 seconds

**CI/CD:** ✅ Works in GitHub Actions, no browser needed

### E2E Tests (Optional)

**Directory:** `e2e/`

**Purpose:** Test extension in real Chrome browser using Puppeteer.

**Setup:**
```bash
npm install --save-dev puppeteer
```

**Run:**
```bash
npm run test:e2e
```

**What it tests:**
- Extension loads in Chrome
- Service worker registers successfully
- Popup opens and displays UI
- Content script injects on mapy.cz

**Speed:** ~10-30 seconds

**CI/CD:** ⚠️ Requires graphical environment (Xvfb on Linux)

## Quick Start

### Daily Development

```bash
npm run build              # Build + integration tests
npm run test:integration   # Just integration tests
```

### Before Committing

```bash
npm run test:all           # All tests (unit + integration)
```

### Full E2E Testing (Optional)

```bash
npm install --save-dev puppeteer
npm run test:e2e
```

## Test Philosophy

**Fast Feedback Loop:**
1. Integration tests catch 90% of issues in < 1 second
2. Unit tests verify logic in < 5 seconds
3. E2E tests provide confidence in < 30 seconds

**Prefer Static Analysis:**
- Integration tests validate bundles without running them
- Catches webpack config errors, CommonJS leaks, syntax errors
- No browser needed = faster CI/CD

**E2E for Critical Flows:**
- Use E2E tests sparingly (they're slow)
- Focus on user-facing flows: login, sync, error handling
- Can't run in all CI environments

## Test Coverage

Run with coverage:

```bash
npm run test:coverage
```

View report:

```bash
open coverage/lcov-report/index.html
```

## Writing New Tests

### Integration Test (Recommended)

Add to `extension-integration.test.js`:

```javascript
test('my new validation', () => {
  const content = fs.readFileSync('dist/my-file.js', 'utf-8');
  expect(content).not.toContain('bad-pattern');
});
```

### E2E Test (Optional)

Create in `e2e/`:

```javascript
test('my user flow', async () => {
  const page = await browser.newPage();
  await page.goto('https://mapy.cz');
  // ... test user interaction
  await page.close();
});
```

## CI/CD Integration

### GitHub Actions

```yaml
- run: npm ci
- run: npm run build        # Includes integration tests
- run: npm run test         # Unit tests
```

### Pre-Commit Hook

```bash
#!/bin/sh
npm run build
```

This ensures integration tests pass before every commit!

## Troubleshooting

### "module is not defined" in browser

✅ Integration tests catch this:
```javascript
test('service-worker.js does not contain CommonJS exports', () => {
  const content = fs.readFileSync('dist/service-worker.js', 'utf-8');
  expect(content).not.toContain('module.exports');
});
```

### E2E tests fail to launch

Check:
- Puppeteer installed: `npm ls puppeteer`
- Display available (not SSH): `echo $DISPLAY`
- Chrome dependencies: `ldd $(which chrome)`

### Tests pass but extension fails

E2E tests would catch this - consider adding them for critical flows.

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Puppeteer Documentation](https://pptr.dev/)
- [Testing Extensions](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)
