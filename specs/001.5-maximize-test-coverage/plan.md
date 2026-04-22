# Implementation Plan: Maximize Test Coverage

**Branch**: `001.5-maximize-test-coverage` | **Date**: 2026-04-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001.5-maximize-test-coverage/spec.md`

## Summary

Raise NeuroDesk AI's Vitest coverage from the current baseline
(statements 12.25%, branches 82%, functions 68.42%, lines 12.25%) to the
sprint targets (statements ≥ 80%, branches ≥ 90%, functions ≥ 85%, lines ≥ 80%)
by writing integration tests for all API routes, component tests for the four
key UI components, expanded unit tests for `chat-service.ts` and `logger.ts`,
and adding CI enforcement via GitHub Actions. One new source file (`GET /api/health`)
and one one-line logger change (NODE_ENV=test silent mode) are required to satisfy
the spec's acceptance scenarios.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Framework**: Next.js 14+ (App Router) — tested via direct function import, not
a running server
**Primary Dependencies**: Vitest 2.x, `@vitest/coverage-v8` ^4.1.5,
`@testing-library/react` ^16.3.2, `@testing-library/user-event` ^14.6.1
**Storage**: SQLite via Drizzle ORM — mocked in all new tests; in-memory pattern
reserved for DB-layer tests in `__tests__/modules/shared/db.test.ts`
**Testing**: Vitest (`npm test -- --coverage`); `v8` coverage provider
**Target Platform**: Same as F01 — modern desktop browsers; tests run in Node 20
(integration/unit) and jsdom (component tests via per-file docblock)
**Performance Goals**: Full test suite must complete in < 60 seconds in CI
**Constraints**: No E2E tests (Playwright) in this sprint; jsdom set per-file
only (`// @vitest-environment jsdom`); global `vitest.config.ts` stays `node`
**Scale/Scope**: 21 tasks across 6 phases; ~8 new/expanded test files;
2 new source files (`health/route.ts`, `.github/workflows/ci.yml`);
1 source file modified (`logger.ts`)

---

## Constitution Check

| Principle | Gate | Status |
|-----------|------|--------|
| I. Modular Architecture | No new modules; new test files mirror existing `__tests__/` structure; `health/route.ts` follows established route pattern | PASS |
| II. Test-First | This sprint IS the test-first pass; all tests written before any logger modification; health endpoint written after its test contract | PASS |
| III. Security-First | No new auth-required routes; `GET /api/health` intentionally auth-free (liveness probe); no user input in health route | PASS |
| IV. API-First Design | `GET /api/health` contract documented in `contracts/health-api.md` before implementation | PASS |
| V. Simplicity & YAGNI | Logger change is one line; health endpoint is four lines; no new abstractions; no new dependencies beyond the three dev packages | PASS |
| VI. Observability & Documentation | `logger.ts` silent mode documented inline; new test files follow existing comment style; `quickstart.md` documents coverage workflow | PASS |
| VII. Incremental Delivery | 5 user stories each independently runnable; Phase 1 (API tests) alone raises statement coverage substantially | PASS |

No gate violations. No complexity tracking entries needed.

---

## Project Structure

### Documentation (this feature)

```text
specs/001.5-maximize-test-coverage/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── health-api.md    ← New endpoint contract
└── tasks.md             ← Existing task list (already created)
```

### Source Changes (repository root)

```text
# NEW files
src/app/api/health/
│   └── route.ts                       # GET /api/health → { status: "ok" }
.github/workflows/
│   └── ci.yml                         # lint + test + coverage on push/PR

# MODIFIED files
src/modules/shared/logger.ts           # +1 line: NODE_ENV=test silent guard
                                       # +change console.log → console.info for info level
vitest.config.ts                       # +coverage block (provider, thresholds, reporters)
.gitignore                             # +coverage/ entry
README.md                              # +coverage badge + npm test --coverage doc

# NEW test files
__tests__/integration/
│   ├── chat-api.test.ts               # Replace 7 it.todo() with working tests
│   ├── conversations-api.test.ts      # Replace 14 it.todo() with working tests
│   └── health-api.test.ts             # New file (3 tests)
__tests__/components/
│   ├── ChatPanel.test.tsx             # New file (render + useChat mock)
│   ├── MessageInput.test.tsx          # New file (render + Enter submission)
│   ├── PersonaSelector.test.tsx       # New file (render + select interaction)
│   └── ModelSwitcher.test.tsx         # New file (render + select interaction)
__tests__/modules/
│   ├── chat/
│   │   └── chat-service.test.ts       # Expand existing (add trim + sendMessage tests)
│   └── shared/
│       └── logger.test.ts             # New file (silent mode + spy tests)
```

---

## Implementation Order & Key Patterns

### Phase 1: Tooling (T001–T003) — unblocks everything

Update `vitest.config.ts`:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 80,
        branches: 90,
        functions: 85,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

### Phase 2: GET /api/health + Logger fix (prerequisite for US1 + US4 tests)

```typescript
// src/app/api/health/route.ts
export function GET() {
  return Response.json({ status: 'ok' });
}
```

```typescript
// src/modules/shared/logger.ts — add at top of log()
function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test') return;  // ← new line
  // ... rest unchanged, except:
  // case 'default': → console.info (not console.log) for info level
}
```

### Phase 3: API integration tests — canonical mock pattern

```typescript
// Pattern used across ALL integration test files:
vi.mock('@/modules/shared/db', () => {
  const m: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select','from','where','orderBy','all','get','insert','values',
   'run','update','set','limit'].forEach(k => { m[k] = vi.fn(() => m); });
  m.all = vi.fn(() => []);
  m.get = vi.fn(() => undefined);
  m.run = vi.fn();
  return { db: m, conversations: {}, messages: {}, personas: {}, providerConfigs: {} };
});

// In each test, customise per-call behaviour:
const { db } = await import('@/modules/shared/db');
(db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce([fakeConversation]);
```

### Phase 4: Component tests — per-file jsdom + fetch mock

```typescript
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Stub global fetch before each test
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
```

### Phase 5: chat-service + logger unit tests — spy pattern

```typescript
// Logger test spy pattern:
import { vi, describe, it, expect, afterEach } from 'vitest';
import { logger } from '@/modules/shared/logger';

afterEach(() => { vi.restoreAllMocks(); });

it('is silent in test env (NODE_ENV=test)', () => {
  const spy = vi.spyOn(console, 'info');
  logger.info('test message');
  expect(spy).not.toHaveBeenCalled(); // silent because NODE_ENV=test
});
```

### Phase 6: CI + Docs (T019–T021)

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [master, "001.5-*"]
  pull_request:
    branches: [master]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
```

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `NextRequest` cast fails in test scope | Low | Use `as any` cast; route handlers only read `.json()` and `.nextUrl` which are present on `Request` |
| `useChat` mock misses a field ChatPanel accesses | Medium | Read ChatPanel source fully before writing mock; mock all fields returned by useChat |
| Global threshold fails due to untested RAG/memory files on branch | Low | Coverage scoped to committed files only; RAG files on separate branch |
| `better-sqlite3` leaks into jsdom test via transitive import | Low | `vi.mock('@/modules/shared/db')` at file top prevents the native module from loading |
| Logger change breaks existing tests that `spyOn(console.log)` | Low | Only `chat-service.test.ts` and `llm-client.test.ts` mock logger indirectly; verify after change |

---

## Complexity Tracking

No constitutional violations. All complexity introduced (mock patterns, jsdom docblocks)
is standard Vitest practice, not a deviation from Principle V.
