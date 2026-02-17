# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.2.x   | Yes       |
| < 1.2   | No        |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities by one of these methods:

1. **GitHub Private Advisory** — open a [private security advisory](../../security/advisories/new) in this repository
2. **Email** — contact the maintainer directly via the email on the GitHub profile

### What to include

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested mitigations if known

### Response timeline

- **Acknowledgement:** within 3 business days
- **Initial assessment:** within 7 days
- **Fix or mitigation:** within 30 days for confirmed vulnerabilities

## Scope

This policy covers the Routomil Chrome extension source code in this repository.

**In scope:**
- Extension source code (TypeScript, content scripts, service worker)
- Authentication and token handling logic
- Data storage and encryption
- Build scripts and CI/CD configuration

**Out of scope:**
- Garmin Connect infrastructure and APIs (report to Garmin)
- Mapy.cz infrastructure and APIs (report to Mapy.cz / Seznam.cz)
- Vulnerabilities in third-party npm dependencies (report upstream)

## Security Design Notes

- All sensitive operations (auth, API calls, token storage) run in the background service worker
- Session tokens are stored encrypted using the Web Crypto API
- The extension never logs credentials, tokens, or personal user data
- All external communication uses HTTPS
- Content Security Policy is enforced on extension pages
