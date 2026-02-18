# CodeQL Security Analysis Guide

This document explains how to use CodeQL CLI for local security analysis of the Routomil Chrome extension. CodeQL detects security vulnerabilities including token exposure, XSS, encryption issues, and sensitive data leakage.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Custom Queries](#custom-queries)
- [Interpreting Results](#interpreting-results)
- [Handling False Positives](#handling-false-positives)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

### Why Local CodeQL Analysis?

The repository is private, which prevents using GitHub's free CodeQL scanning. Local CodeQL CLI provides:

- **No external dependencies** - All analysis runs locally
- **Private repository safe** - No code uploaded to external services
- **Custom queries** - Tailored to Chrome extension security patterns
- **Fast iteration** - Quick scans during development (~30 seconds)
- **Comprehensive coverage** - Standard + custom security queries

### Security Concerns Addressed

The custom queries target vulnerabilities specific to Routomil:

1. **Token/credential exposure** - CSRF tokens and session cookies in logs
2. **DOM-based XSS** - innerHTML usage without sanitization
3. **Encryption vulnerabilities** - Key storage and IV generation
4. **CSRF token mishandling** - Tokens in error messages or storage
5. **Sensitive data leakage** - API responses in error messages
6. **postMessage security** - Wildcard target origins, missing origin validation
7. **Fetch API patching** - Monkey-patching window.fetch in content scripts

## Installation

### Step 1: Install CodeQL CLI

Run the automated setup script:

```bash
bash scripts/setup-codeql.sh
```

This will:
- Download CodeQL CLI bundle (~400MB) from GitHub releases
- Extract to `tools/codeql/`
- Verify installation and display version

**Manual installation:** If the script fails, download from [GitHub CodeQL releases](https://github.com/github/codeql-cli-binaries/releases) and extract to `tools/codeql/`.

### Step 2: Verify Setup

```bash
npm run security:verify
```

This checks:
- CodeQL CLI installation
- Directory structure
- Configuration files
- Custom query files
- Script permissions
- .gitignore configuration

Expected output:
```
✓ All required checks passed!
```

## Quick Start

### Basic Workflow

```bash
# 1. Create database from TypeScript source
npm run security:db

# 2. Run quick scan (custom queries only, ~30 seconds)
npm run security:quick

# 3. View formatted results
npm run security:view
```

### Full Security Scan

```bash
# Run complete analysis (custom + standard queries, 2-5 minutes)
npm run security

# Or step by step:
npm run security:db       # Create database
npm run security:analyze  # Run all queries
npm run security:view     # View results
```

### Clean Up

```bash
# Remove database and results (frees ~50-100MB)
npm run security:clean
```

## Usage

### npm Scripts Reference

| Command | Description | Duration |
|---------|-------------|----------|
| `npm run security` | Full scan: database creation + all queries | 2-5 min |
| `npm run security:db` | Create CodeQL database from source | 30-60 sec |
| `npm run security:analyze` | Run all security queries | 2-5 min |
| `npm run security:quick` | Quick scan (custom queries only) | ~30 sec |
| `npm run security:view` | Display formatted results | Instant |
| `npm run security:verify` | Verify installation and setup | Instant |
| `npm run security:clean` | Remove database and results | Instant |

### When to Run Analysis

**Required:**
- Before every release (add to release checklist)
- After implementing authentication or encryption code
- After modifying error handling or logging

**Recommended:**
- Weekly during active development
- After updating Chrome extension APIs
- After changing content script DOM manipulation
- Before committing sensitive code changes

**Optional (quick iteration):**
- During development of security-sensitive features (use `security:quick`)

## Custom Queries

### Query Overview

| Query | Severity | CWE | Description |
|-------|----------|-----|-------------|
| **TokenLogging.ql** | Error (8.0) | CWE-532 | Detects logging of tokens, credentials, cookies |
| **DomXss.ql** | Error (9.0) | CWE-79 | Detects user-controlled data in innerHTML |
| **WeakEncryption.ql** | Warning (7.0) | CWE-326, CWE-330 | Detects weak IV generation, key storage, short keys |
| **CsrfTokenMishandling.ql** | Error (7.5) | CWE-352, CWE-532 | Detects CSRF tokens in logs or unencrypted storage |
| **SensitiveDataInErrors.ql** | Warning (6.5) | CWE-209, CWE-532 | Detects tokens or API responses in error messages |
| **PostMessageSecurity.ql** | Warning (7.0) | CWE-345 | Detects wildcard postMessage origins, missing origin validation |
| **FetchPatching.ql** | Recommendation (5.0) | CWE-693 | Detects window.fetch monkey-patching in content scripts |

### Query Details

#### TokenLogging.ql

**What it detects:**
- `console.log()` calls with variables/properties matching: token, csrf, cookie, credential, password, secret, key, session

**Example violation:**
```typescript
const csrfToken = getCsrfToken();
console.log('CSRF token:', csrfToken);  // ❌ Triggers alert
```

**How to fix:**
- Remove console.log of sensitive data
- Use debug flags and ensure they're disabled in production
- Log only non-sensitive metadata (e.g., "Token retrieved" without value)

#### DomXss.ql

**What it detects:**
- User-controlled data (from DOM, URL params) flowing to `innerHTML` or `outerHTML` assignments without sanitization

**Example violation:**
```typescript
const userInput = document.getElementById('input').value;
element.innerHTML = userInput;  // ❌ XSS vulnerability
```

**How to fix:**
```typescript
// Option 1: Use textContent (no HTML rendering)
element.textContent = userInput;  // ✅ Safe

// Option 2: Sanitize HTML
element.innerHTML = sanitizeHtml(userInput);  // ✅ Safe if sanitizer is correct

// Option 3: Use DOM APIs
const text = document.createTextNode(userInput);
element.appendChild(text);  // ✅ Safe
```

#### WeakEncryption.ql

**What it detects:**
- IV (initialization vector) not generated with `crypto.getRandomValues()`
- Encryption keys stored in `chrome.storage.local` (unencrypted)
- Key lengths < 256 bits for AES-GCM

**Example violations:**
```typescript
// ❌ Weak IV generation
const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

// ❌ Key in unencrypted storage
await chrome.storage.local.set({ encryptionKey: key });

// ❌ Weak key length
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 128 },  // Use 256
  true,
  ['encrypt', 'decrypt']
);
```

**How to fix:**
```typescript
// ✅ Strong IV generation
const iv = crypto.getRandomValues(new Uint8Array(12));

// ✅ Derive key from user password (don't store directly)
const key = await deriveKeyFromPassword(userPassword);

// ✅ Use 256-bit keys
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);
```

#### CsrfTokenMishandling.ql

**What it detects:**
- CSRF tokens logged to console
- CSRF tokens in error messages
- CSRF tokens stored in `chrome.storage` without encryption

**Example violations:**
```typescript
// ❌ Token in log
console.log('Got CSRF token:', csrfToken);

// ❌ Token in error message
throw new Error(`CSRF token invalid: ${csrfToken}`);

// ❌ Token in storage
await chrome.storage.local.set({ csrfToken });
```

**How to fix:**
```typescript
// ✅ No logging
// (CSRF tokens should be session-only, not logged)

// ✅ Generic error without token value
throw new Error('CSRF token validation failed');

// ✅ Session-only (don't store)
// CSRF tokens should be fetched per-session, not persisted
```

#### SensitiveDataInErrors.ql

**What it detects:**
- Variables matching sensitive patterns in Error constructors
- API response data in error messages
- Tokens or credentials in thrown errors

**Example violations:**
```typescript
// ❌ Sensitive data in error
throw new Error(`Token: ${token}`);

// ❌ API response in error
const response = await fetch(...);
throw new Error(`API error: ${JSON.stringify(response)}`);
```

**How to fix:**
```typescript
// ✅ Generic error message
throw new Error('Authentication failed');

// ✅ Log safe metadata only
throw new Error(`API error: ${response.status} ${response.statusText}`);
```

#### PostMessageSecurity.ql

**What it detects:**
- `postMessage()` calls with wildcard `'*'` target origin, allowing any window/frame to receive the message
- `addEventListener('message', ...)` handlers that don't check `event.origin`, allowing any window to send messages

**Relevant files:** `fetch-interceptor.ts`, `bikerouter-interceptor.ts`, `bikerouter-content.ts`, `mapy-content.ts`

**Example violations:**
```typescript
// ❌ Wildcard target origin - any frame can receive this
window.postMessage({ type: 'DATA', payload: routeData }, '*');

// ❌ No origin check - any window can trigger this handler
window.addEventListener('message', (event) => {
  if (event.data.type === 'DATA') {
    processData(event.data.payload);
  }
});
```

**How to fix:**
```typescript
// ✅ Specify exact target origin
window.postMessage({ type: 'DATA', payload: routeData }, 'https://mapy.cz');

// ✅ Validate origin before processing
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://mapy.cz') return;
  if (event.data.type === 'DATA') {
    processData(event.data.payload);
  }
});
```

#### FetchPatching.ql

**What it detects:**
- Direct assignment to `window.fetch` (monkey-patching)
- Saving original `window.fetch` reference before replacing it

**Relevant files:** `bikerouter-interceptor.ts`, `fetch-interceptor.ts`

**Note:** This is an intentional pattern in our extension's MAIN world content scripts — we intercept fetch to capture route data before it reaches the page. The query is a "recommendation" severity to ensure each new instance is consciously reviewed.

**Example detection:**
```typescript
// ⚠️ Flagged as recommendation (intentional in our case)
const originalFetch = window.fetch;
window.fetch = async function patchedFetch(input, init) {
  // intercept logic...
  return originalFetch(input, init);
};
```

**When this matters:**
- Any new fetch patching should be deliberate and documented
- Ensure patched fetch correctly forwards non-intercepted requests
- Ensure error handling doesn't swallow fetch errors silently

## Interpreting Results

### Output Formats

**CSV Format** (`codeql-results/custom-security.csv`):
- Human-readable table
- Columns: name, description, severity, file, line, column
- Easy to parse with command-line tools

**SARIF Format** (`codeql-results/*.sarif`):
- Machine-readable JSON
- Used by CI/CD tools and IDEs
- Can be opened in VS Code with CodeQL extension

### Severity Levels

- **Error (7.5-9.0)**: Critical security issues requiring immediate fix
- **Warning (6.5-7.0)**: Important issues to address before release
- **Recommendation (<6.5)**: Best practices and code quality improvements

### Reading Results

Example output from `npm run security:view`:

```
🔴 ERRORS: 3 issue(s)
----------------------------------------
  📍 garmin-auth.ts:245
     Sensitive data 'csrfToken' is logged to console, which may expose tokens

  📍 button-injector.ts:31
     Potential DOM-based XSS: user-controlled data flows to innerHTML assignment

  📍 button-injector.ts:92
     Potential DOM-based XSS: user-controlled data flows to innerHTML assignment

🟡 WARNINGS: 2 issue(s)
----------------------------------------
  📍 storage.ts:67
     Encryption key stored in chrome.storage.local (unencrypted)

  📍 garmin-api.ts:98
     API response data included in error message
```

### Prioritizing Fixes

1. **Fix all Errors first** - These are critical vulnerabilities
2. **Review Warnings** - Fix or document as accepted risk
3. **Consider Recommendations** - Implement if feasible

## Handling False Positives

### What is a False Positive?

A finding that appears vulnerable but is actually safe due to context not detected by the query.

### Example False Positive

```typescript
// CodeQL may flag this as token logging
console.log('Token validation status:', tokenValid);  // tokenValid is boolean, not the token itself
```

### Suppression Methods

#### Method 1: Inline Comment (Recommended)

```typescript
// lgtm[js/token-logging] - Logging status only, not token value
console.log('Token validation status:', tokenValid);
```

#### Method 2: Document in FALSE_POSITIVES.md

Create `docs/FALSE_POSITIVES.md`:

```markdown
# Accepted False Positives

## TokenLogging.ql

### garmin-auth.ts:245
- **Finding**: `console.log('Token status:', tokenValid)`
- **Why safe**: Logging boolean status, not token value
- **Accepted**: 2026-02-16
```

### When to Suppress

- **DO suppress** when you've verified the code is safe
- **DO document** why it's safe in comments or FALSE_POSITIVES.md
- **DON'T suppress** just to clear warnings without investigation

## Troubleshooting

### CodeQL CLI Not Found

**Error:** `Error: CodeQL CLI not found`

**Solution:**
```bash
bash scripts/setup-codeql.sh
```

### Database Creation Fails

**Error:** `Error creating database`

**Possible causes:**
1. **Insufficient disk space** - Database requires ~50-100MB
2. **Source directory missing** - Ensure `src/` exists
3. **Invalid source files** - Check for syntax errors in TypeScript

**Solution:**
```bash
# Check disk space
df -h

# Verify source files compile
npm run build

# Retry database creation
npm run security:db
```

### No Results / Empty CSV

**Possible causes:**
1. Database not created
2. No vulnerabilities found (good!)
3. Query compilation failed

**Solution:**
```bash
# Verify setup
npm run security:verify

# Check if database exists
ls -lh codeql-db/

# Re-run with verbose output
bash scripts/run-codeql-analysis.sh --quick 2>&1 | tee analysis.log
```

### Query Compilation Errors

**Error:** `Error: Could not resolve module import`

**Solution:**
- Ensure `codeql-custom-queries/qlpack.yml` exists
- Check that CodeQL standard libraries are in `tools/codeql/`
- Reinstall: `bash scripts/setup-codeql.sh`

### Large Database Size

**Issue:** Database takes >500MB

**Solution:**
- Normal for large projects
- Clean up regularly: `npm run security:clean`
- Exclude unnecessary directories in `codeql-config.yml`

## Best Practices

### Development Workflow

1. **Before committing sensitive code:**
   ```bash
   npm run security:quick
   ```

2. **Before creating PR:**
   ```bash
   npm run security
   npm run security:view
   ```

3. **Before release:**
   ```bash
   npm run test:all
   npm run security
   # Fix all errors, review warnings
   ```

### Scanning Schedule

- **Daily**: During active security feature development (use `security:quick`)
- **Weekly**: Regular development cycles
- **Pre-release**: Always, as part of release checklist
- **Post-dependency update**: After updating crypto or Chrome APIs

### Security Hygiene

- **Never suppress without investigation**
- **Document all accepted risks**
- **Review suppressed findings quarterly**
- **Update custom queries as patterns emerge**
- **Share findings with team**

### Performance Tips

- Use `npm run security:quick` during development (30 sec vs 5 min)
- Run full `npm run security` before releases only
- Clean up databases regularly to free disk space
- Exclude `node_modules/` and `dist/` (already configured)

## Additional Resources

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [CodeQL Query Reference](https://codeql.github.com/docs/codeql-language-guides/codeql-library-for-javascript/)
- [Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Support

- **Setup issues**: Check `npm run security:verify` output
- **Query false positives**: Document in `docs/FALSE_POSITIVES.md`
- **New vulnerability patterns**: Add custom queries to `codeql-custom-queries/queries/`
- **Questions**: Create issue at https://github.com/HromekFr/routomil/issues
