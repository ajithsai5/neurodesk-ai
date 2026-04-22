# Research: Maximize Test Coverage

**Feature**: `001.5-maximize-test-coverage`
**Date**: 2026-04-22

---

## Decision 1: Route Handler Testing Strategy (Next.js App Router)

**Decision**: Direct import + `new Request()` cast — no extra package needed.

**Rationale**: Next.js App Router `route.ts` files export plain async functions
(`POST(req: NextRequest)`). `NextRequest` extends the standard `Request` Web API,
so tests can construct one with:

```typescript
// __tests__/integration/chat-api.test.ts
import { POST } from '@/app/api/chat/route';

const req = new Request('http://localhost/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversationId: 'c-1', message: 'Hello' }),
}) as any; // NextRequest is a superset; cast is safe in test scope

const res = await POST(req);
expect(res.status).toBe(200);
```

Mocking `@/modules/shared/db` and `@/modules/chat` at module level (same pattern
already used in `chat-service.test.ts`) prevents SQLite from being loaded.

**Alternatives considered**:
- `next-test-api-route-handler` (NTARH) — adds a dependency, wraps Vercel's
  test adapter; overkill when route handlers are pure functions with no
  middleware that needs emulating.
- Full integration test against a live server — requires dev server, too slow
  and fragile for unit-style coverage.

---

## Decision 2: Logger Silent Mode in Test Environment

**Decision**: Add a `NODE_ENV === 'test'` early-return guard inside `log()` in
`src/modules/shared/logger.ts`.

**Rationale**: The spec requires `logger.info` to be silent in `NODE_ENV=test`
(FR-009, US4 AS1). The current logger always delegates to `console.*`.
Adding a single guard:

```typescript
// src/modules/shared/logger.ts — inside log()
if (process.env.NODE_ENV === 'test') return; // suppress all output in test env
```

keeps the change minimal (one line), does not break production or development
behaviour, and makes all test runs noise-free without needing `vi.spyOn` silencing
wrappers in every test file.

Additionally, the `info` level currently uses `console.log` (not `console.info`).
The spec acceptance scenario checks `console.info`. The logger must be updated to
use `console.info` for the `info` case so spy assertions target the right method.

**Alternatives considered**:
- Mocking logger in every test — adds boilerplate to all test files; doesn't
  actually test the logger's own behaviour.
- No change to logger — would fail US4 acceptance scenarios as written.

---

## Decision 3: React Component Testing Strategy

**Decision**: Mock `'ai/react'` (`useChat`) and `global.fetch` via
`vi.mock` / `vi.stubGlobal`; render with `@testing-library/react`.

**Rationale**:

- **`ChatPanel`**: Uses `useChat` from `'ai/react'` which attempts SSE network
  calls. Mock the entire module:
  ```typescript
  vi.mock('ai/react', () => ({
    useChat: vi.fn(() => ({
      messages: [],
      isLoading: false,
      error: null,
      append: vi.fn(),
      setMessages: vi.fn(),
      reload: vi.fn(),
    })),
  }));
  ```
  `ChatPanel` also makes `fetch` calls (`/api/conversations/:id`) inside
  `useEffect`. Mock global fetch:
  ```typescript
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ messages: [], personaId: null, providerId: null }),
  }));
  ```

- **`PersonaSelector`**: Fetches `/api/personas` on mount. Same `vi.stubGlobal`
  fetch mock returns `{ personas: [...] }`.

- **`ModelSwitcher`**: Fetches `/api/providers` on mount. Same pattern, returns
  `{ providers: [...] }`.

- **`MessageInput`**: No network calls; pure controlled component — no mocking
  needed. Use `@testing-library/user-event` for realistic key-event simulation
  (fires `keydown`, `keyup`, `input` in the right order):
  ```typescript
  import userEvent from '@testing-library/user-event';
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox'), 'Hello');
  await user.keyboard('{Enter}');
  expect(onSubmit).toHaveBeenCalledWith('Hello');
  ```

**Each component test file must begin with:**
```typescript
// @vitest-environment jsdom
```

**Alternatives considered**:
- Mock Service Worker (MSW) — ideal for integration fetch mocking but adds setup
  overhead and a dependency not justified by 4 component test files.
- Shallow rendering (Enzyme) — incompatible with React 18 hooks; `@testing-library`
  is the standard.

---

## Decision 4: Health Endpoint

**Decision**: Create `src/app/api/health/route.ts` as a new GET endpoint.

**Rationale**: The spec requires `GET /api/health` (FR-005, US1 AS4) but the route
does not exist yet. Implementation is trivial (no DB call, no auth):

```typescript
// src/app/api/health/route.ts
export function GET() {
  return Response.json({ status: 'ok' });
}
```

The test imports this function directly and asserts status + body.

**Alternatives considered**: None — endpoint must be created.

---

## Decision 5: Conversations Route Test Isolation

**Decision**: Mock `@/modules/shared/db` at module level with a chainable mock
object (same shape as `chat-service.test.ts`), plus mock `uuid` for predictable IDs.

**Rationale**: The `conversations/route.ts` and `conversations/[id]/route.ts` files
import `db` from `@/modules/shared/db` and use Drizzle's fluent query builder
(`.select().from().where().all()`). The existing chainable mock pattern covers this:

```typescript
vi.mock('@/modules/shared/db', () => {
  const m = {
    select: vi.fn(() => m), from: vi.fn(() => m), where: vi.fn(() => m),
    orderBy: vi.fn(() => m), all: vi.fn(() => []), get: vi.fn(),
    insert: vi.fn(() => m), values: vi.fn(() => m), run: vi.fn(),
    update: vi.fn(() => m), set: vi.fn(() => m), eq: vi.fn(), desc: vi.fn(),
  };
  return { db: m, schema: {}, conversations: {}, messages: {}, personas: {}, providerConfigs: {} };
});
```

Per-test `.mockReturnValueOnce()` calls on `m.all` / `m.get` / `m.run` set up
the specific response for each test case.

**Alternatives considered**:
- In-memory SQLite (`:memory:`) — more realistic but requires schema setup and
  seeding per test; slower and fragile in CI; reserved for DB-layer tests in
  `__tests__/modules/shared/db.test.ts`.

---

## Decision 6: GitHub Actions CI Workflow

**Decision**: Create `.github/workflows/ci.yml` with Node 20, `npm ci`, lint, and
`npm test -- --coverage`. No matrix; single job on `ubuntu-latest`.

**Rationale**: Minimal CI that enforces the three quality gates (type-check via
`tsc --noEmit` is optional in phase 1 — just lint + test + coverage is sufficient).
Using `ubuntu-latest` matches the Next.js recommended environment.

```yaml
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

**Alternatives considered**:
- Node matrix (18, 20, 22) — premature; app targets single runtime in production.
- `npm run build` in CI — adds ~30s; deferred to a separate CD workflow.
