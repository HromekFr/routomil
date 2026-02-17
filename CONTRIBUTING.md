# Contributing to Routomil

Thank you for your interest in contributing! This document explains how to get involved.

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Google Chrome (for manual testing)

### Getting started

```bash
git clone https://github.com/HromekFr/routomil.git
cd routomil
npm install
npm run dev        # start webpack in watch mode
```

Load the extension in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

### Project structure

See `CLAUDE.md` for a full architecture overview and file responsibilities.

## Making Changes

### Workflow

1. Fork the repository and create a branch from `main`
2. Name branches descriptively: `fix/issue-description` or `feature/short-name`
3. Make your changes with focused, atomic commits
4. Ensure all tests pass before opening a PR
5. Open a pull request against `main`

### Code style

- **TypeScript strict mode** — no `any`, explicit types for function signatures
- Follow existing patterns in the file you are modifying
- All cross-context messages must be typed in `src/shared/messages.ts`
- All errors should use `MapyGarminError` from `src/shared/errors.ts`
- Sensitive operations belong in the service worker, not content scripts

### Testing

```bash
npm run test            # unit tests (Jest)
npm run test:integration # integration tests
npm run test:all        # full build + all tests
```

- Add unit tests for new logic in `tests/unit/`
- Integration tests live in `tests/integration/`
- Aim to keep test coverage meaningful, not just high

### Security

```bash
npm run security        # CodeQL analysis (requires CodeQL CLI)
npm run security:quick  # faster scan, custom queries only
```

Run the security scan before submitting PRs that touch auth, storage, or API code. See `docs/SECURITY_ANALYSIS.md` for setup instructions.

### Building

```bash
npm run build           # production build
npm run build:skip-tests # build without running tests
```

The build must succeed with no TypeScript errors before a PR can be merged.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Describe what changed and why in the PR description
- Reference any related issues with `Fixes #123`
- Update `CHANGELOG.md` with a summary of your changes
- All CI checks must pass

## Reporting Issues

- Search existing issues before opening a new one
- Include Chrome version, extension version, and steps to reproduce
- For security issues, follow the process in [SECURITY.md](SECURITY.md) — do not open public issues

## Questions

Open a GitHub Discussion for questions about usage or architecture before starting large changes.
