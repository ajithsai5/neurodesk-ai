# Quickstart: Test Coverage

**Feature**: `001.5-maximize-test-coverage`
**Branch**: `001.5-maximize-test-coverage`

## Prerequisites

- Node.js 20+
- Dependencies installed: `npm ci`
- Branch checked out: `git checkout 001.5-maximize-test-coverage`

---

## Run all tests with coverage

```bash
npm test -- --coverage
```

- Generates `coverage/index.html` — open in a browser for per-file drilldown.
- Exits non-zero if any threshold is breached (statements < 80%, branches < 90%,
  functions < 85%, lines < 80%).

---

## Run a single test file

```bash
# API route tests
npx vitest run __tests__/integration/chat-api.test.ts
npx vitest run __tests__/integration/conversations-api.test.ts
npx vitest run __tests__/integration/health-api.test.ts

# Component tests
npx vitest run __tests__/components/MessageInput.test.tsx

# Module tests
npx vitest run __tests__/modules/chat/chat-service.test.ts
npx vitest run __tests__/modules/shared/logger.test.ts
```

---

## View the HTML report

```bash
# macOS / Linux
open coverage/index.html

# Windows
start coverage/index.html
```

---

## Validate thresholds pass

```bash
npm test -- --coverage
# Exit code 0 = all thresholds met
# Exit code 1 = one or more thresholds breached (check the summary table printed to stdout)
```

---

## Watch mode (development)

```bash
npm run test:watch
# Note: --coverage is not applied in watch mode to keep re-runs fast
```

---

## CI behaviour

Every push and pull request to `master` triggers `.github/workflows/ci.yml`:
1. `npm ci` — clean install
2. `npm run lint` — ESLint
3. `npm test -- --coverage` — tests + threshold enforcement

A failing coverage threshold blocks the PR merge.
