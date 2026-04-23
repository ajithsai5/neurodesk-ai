# Tasks: Maximize Test Coverage

**Input**: Design documents from `specs/001.5-maximize-test-coverage/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓
**Run coverage**: `npm test -- --coverage`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared state)
- **[Story]**: Maps to user story (US1–US5)
- **[x]**: Task already completed

---

## Phase 1: Setup (Coverage Tooling)

**Purpose**: Configure `@vitest/coverage-v8` with thresholds so every subsequent
test task contributes to a measurable, enforced target. Dependencies are already
installed — start from T002.

- [x] T001 Install `@vitest/coverage-v8 ^4.1.5`, `@testing-library/react ^16.3.2`, `@testing-library/user-event ^14.6.1` as dev dependencies (`npm install -D ...`) — **DONE**
- [x] T002 Update `vitest.config.ts` — add `coverage` block (provider: `v8`, reporters: `["text","html","json-summary"]`, `reportsDirectory: "coverage"`, thresholds: `{statements:80,branches:90,functions:85,lines:80}`); change `include` to `['__tests__/**/*.test.{ts,tsx}']`
- [x] T003 [P] Add `coverage/` to `.gitignore`

**Checkpoint**: `npm test -- --coverage` produces a `coverage/` directory and exits non-zero when any threshold is breached.

---

## Phase 2: Foundational (New Source Files — prerequisite for test phases)

**Purpose**: Create `GET /api/health` (required by FR-005 tests) and fix `logger.ts`
(required by FR-009 tests). These must exist before the corresponding tests pass.

**⚠️ CRITICAL**: Phase 3 (health test) and Phase 6 (logger tests) cannot pass until this phase is complete.

- [x] T004 Create `src/app/api/health/route.ts` — `export function GET() { return Response.json({ status: 'ok' }); }` (no DB call, no auth)
- [x] T005 [P] Fix `src/modules/shared/logger.ts` — add `if (process.env.NODE_ENV === 'test') return;` as first line of `log()`; change `default:` case from `console.log` to `console.info` so `vi.spyOn(console, 'info')` resolves correctly in tests

**Checkpoint**: `npx vitest run __tests__/integration/health-api.test.ts` passes (after T007 is written); logger spy tests pass without console noise.

---

## Phase 3: User Story 1 — API Route Tests (Priority: P1) 🎯 MVP

**Goal**: Replace all `it.todo()` placeholders in integration test files with
working tests. Raises API route coverage from 0% to ≥ 80%.

**Independent Test**: `npx vitest run __tests__/integration/`

### Mock pattern (use in every integration test file)

```typescript
vi.mock('@/modules/shared/db', () => {
  const m: any = {};
  ['select','from','where','orderBy','all','get','insert',
   'values','run','update','set','limit'].forEach(k => { m[k] = vi.fn(() => m); });
  m.all = vi.fn(() => []); m.get = vi.fn(); m.run = vi.fn();
  return { db: m, conversations: {}, messages: {}, personas: {}, providerConfigs: {} };
});
```

### POST /api/chat tests (`__tests__/integration/chat-api.test.ts`)

- [x] T006 [US1] Replace `it.todo('should return a streaming response for valid input')` — mock `@/modules/chat` (`handleChatMessage` returns `{ toDataStreamResponse: vi.fn(() => new Response('ok')) }`), POST `{ conversationId: 'c-1', message: 'Hi' }`, assert status 200 in `__tests__/integration/chat-api.test.ts`
- [x] T007 [P] [US1] Replace `it.todo('should return 400 for missing conversationId')` — POST `{ message: 'Hi' }` (no conversationId), assert 400 + `{ error: 'Invalid input' }` in `__tests__/integration/chat-api.test.ts`
- [x] T008 [P] [US1] Replace `it.todo('should return 400 for empty message')` — POST `{ conversationId: 'c-1', message: '' }`, assert 400 in `__tests__/integration/chat-api.test.ts`
- [x] T009 [P] [US1] Replace `it.todo('should return 400 for message exceeding 10,000 characters')` — POST with `message: 'x'.repeat(10001)`, assert 400 in `__tests__/integration/chat-api.test.ts`
- [x] T010 [P] [US1] Replace `it.todo('should return 404 for nonexistent conversation')` — mock `handleChatMessage` to throw `new Error('Conversation not found')`, assert 404 in `__tests__/integration/chat-api.test.ts`
- [x] T011 [P] [US1] Add new test: LLM provider error — mock `handleChatMessage` to throw `new Error('AI service unavailable: openai')`, assert 500 + `{ error: 'AI service unavailable' }` in `__tests__/integration/chat-api.test.ts`
- [x] T012 [P] [US1] Replace `it.todo('should save user message to database')` and `it.todo('should save assistant message after stream completes')` — verify `handleChatMessage` was called with correct args in `__tests__/integration/chat-api.test.ts`

### GET /api/health test (new file)

- [x] T013 [P] [US1] Create `__tests__/integration/health-api.test.ts` — import `GET` from `@/app/api/health/route`, assert status 200 and body `{ status: 'ok' }`; no mocks required

### GET|POST /api/conversations tests (`__tests__/integration/conversations-api.test.ts`)

- [x] T014 [US1] Replace `it.todo('should return empty list when no conversations exist')` — mock `db.all` returns `[]`, GET `/api/conversations`, assert `{ conversations: [] }` in `__tests__/integration/conversations-api.test.ts`
- [x] T015 [P] [US1] Replace `it.todo('should return active conversations sorted by updatedAt DESC')` — mock `db.all` returns `[fakeConv]`, assert array in response in `__tests__/integration/conversations-api.test.ts`
- [x] T016 [P] [US1] Replace `it.todo('should filter by archived status')` — GET `?status=archived`, assert `db.where` was called (status filter applied) in `__tests__/integration/conversations-api.test.ts`
- [x] T017 [P] [US1] Replace `it.todo('should create a new conversation with defaults')` — mock `db.get` returns persona/provider, mock `db.run`, POST `{}`, assert 201 + conversation object in `__tests__/integration/conversations-api.test.ts`
- [x] T018 [P] [US1] Replace `it.todo('should create a conversation with specified persona and provider')` — POST `{ personaId: 'p-1', providerId: 'pr-1' }`, assert 201 in `__tests__/integration/conversations-api.test.ts`

### GET|PATCH|DELETE /api/conversations/:id tests (`__tests__/integration/conversations-api.test.ts`)

- [x] T019 [P] [US1] Replace `it.todo('should return conversation with messages')` — import `GET` from `conversations/[id]/route`, mock `db.get` returns conversation + `db.all` returns messages, assert 200 + `{ conversation, messages }` in `__tests__/integration/conversations-api.test.ts`
- [x] T020 [P] [US1] Replace `it.todo('should return 404 for nonexistent conversation')` (GET) — mock `db.get` returns undefined, assert 404 in `__tests__/integration/conversations-api.test.ts`
- [x] T021 [P] [US1] Replace `it.todo('should rename a conversation')` — PATCH `{ title: 'New Title' }`, mock `db.run`, assert 200 in `__tests__/integration/conversations-api.test.ts`
- [x] T022 [P] [US1] Replace `it.todo('should reject empty title')` — PATCH `{ title: '' }`, assert 400 in `__tests__/integration/conversations-api.test.ts`
- [x] T023 [P] [US1] Replace `it.todo('should reject title exceeding 200 characters')` — PATCH `{ title: 'x'.repeat(201) }`, assert 400 in `__tests__/integration/conversations-api.test.ts`
- [x] T024 [P] [US1] Replace `it.todo('should delete conversation and cascade to messages')` — DELETE, mock `db.run`, assert 200 in `__tests__/integration/conversations-api.test.ts`
- [x] T025 [P] [US1] Replace `it.todo('should return 404 for nonexistent conversation')` (DELETE) — mock `db.get` returns undefined, assert 404 in `__tests__/integration/conversations-api.test.ts`

**Checkpoint**: `npx vitest run __tests__/integration/` — all tests pass; API statement coverage ≥ 80%.

---

## Phase 4: User Story 2 — React Component Tests (Priority: P2)

**Goal**: Raise component coverage from 0% to ≥ 75% functions. Each file begins
with `// @vitest-environment jsdom`. Mock `'ai/react'` and `global.fetch`.

**Independent Test**: `npx vitest run __tests__/components/`

### useChat + fetch mock pattern (reuse across component tests)

```typescript
// @vitest-environment jsdom
vi.mock('ai/react', () => ({
  useChat: vi.fn(() => ({
    messages: [], isLoading: false, error: null,
    append: vi.fn(), setMessages: vi.fn(), reload: vi.fn(),
  })),
}));
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ messages: [], personas: [], providers: [] }),
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
```

- [x] T026 [P] [US2] Create `__tests__/components/ChatPanel.test.tsx` — render `<ChatPanel conversationId={null} />`; assert welcome screen renders without crash; render with `conversationId="c-1"`, assert no throw; mock `useChat` returns `messages: [{ role:'user', content:'Hi', id:'1' }]`, assert message appears
- [x] T027 [P] [US2] Create `__tests__/components/MessageInput.test.tsx` — render `<MessageInput onSubmit={spy} isLoading={false} />`; use `userEvent.type` + `userEvent.keyboard('{Enter}')`, assert `onSubmit` called with trimmed text and input cleared; assert empty input does NOT call `onSubmit`; assert `isLoading=true` disables textarea
- [x] T028 [P] [US2] Create `__tests__/components/PersonaSelector.test.tsx` — mock fetch returns `{ personas: [{ id:'p1', name:'Tutor', description:'...' }] }`; render `<PersonaSelector selectedPersonaId={null} onSelect={spy} />`; click trigger button; assert persona appears; click persona button; assert `onSelect` called with `'p1'`
- [x] T029 [P] [US2] Create `__tests__/components/ModelSwitcher.test.tsx` — mock fetch returns `{ providers: [{ id:'pr1', providerName:'openai', displayName:'GPT-4o', isAvailable:true }] }`; render `<ModelSwitcher selectedProviderId={null} onSelect={spy} />`; click trigger; assert provider appears; click provider; assert `onSelect` called with `'pr1'`

**Checkpoint**: `npx vitest run __tests__/components/` — all 4 test files pass; component function coverage ≥ 75%.

---

## Phase 5: User Story 3 — Chat Service Coverage (Priority: P3)

**Goal**: Raise `src/modules/chat/chat-service.ts` from 24.5% to ≥ 75% statements.

**Independent Test**: `npx vitest run __tests__/modules/chat/chat-service.test.ts`

- [x] T030 [US3] Add `describe('buildContextWindow')` block to `__tests__/modules/chat/chat-service.test.ts` — test trim-by-count: build 25 fake messages, call `handleChatMessage` with mocked db returning all 25, assert `streamChatResponse` was called with only the last 20 messages in its `messages` arg
- [x] T031 [P] [US3] Add test: trim-by-token-cap — mock `js-tiktoken` (or spy on token count) to simulate 25 messages summing > 100K tokens; assert oldest messages are dropped until under cap before LLM call in `__tests__/modules/chat/chat-service.test.ts`
- [x] T032 [P] [US3] Add test: full `handleChatMessage` success path — mock `db.get` returning conversation with `personaId`/`providerId`, mock persona lookup returning `systemPrompt: 'You are...'`, mock `streamChatResponse`, mock `db.run`; assert `streamChatResponse` called with correct `systemPrompt` and that `db.run` (save assistant message) was called after stream resolves in `__tests__/modules/chat/chat-service.test.ts`

**Checkpoint**: `npx vitest run __tests__/modules/chat/chat-service.test.ts` — new tests pass; statement coverage ≥ 75%.

---

## Phase 6: User Story 4 — Logger Coverage (Priority: P4)

**Goal**: Raise `src/modules/shared/logger.ts` from 20% to ≥ 80% statements.
Requires T005 (logger fix) to be complete first.

**Independent Test**: `npx vitest run __tests__/modules/shared/logger.test.ts`

- [x] T033 [US4] Create `__tests__/modules/shared/logger.test.ts` — `vi.spyOn(console, 'info')`; call `logger.info('msg')`; assert spy NOT called (silent in `NODE_ENV=test`); restore spy in `afterEach`
- [x] T034 [P] [US4] Add test in `logger.test.ts`: temporarily set `process.env.NODE_ENV = 'development'`, spy on `console.warn`, call `logger.warn('msg')`, assert spy called with stringified JSON containing `level:'warn'` and `message:'msg'`; restore `NODE_ENV` in afterEach
- [x] T035 [P] [US4] Add test in `logger.test.ts`: `logger.error` with `Error` object — `vi.spyOn(console, 'error')`; set `NODE_ENV='development'`; call `logger.error('oops', { error: new Error('boom').message })`; assert spy called and output contains `'oops'`
- [x] T036 [P] [US4] Add test in `logger.test.ts`: `logger.debug` is suppressed in non-development — set `NODE_ENV='production'`, spy `console.debug`, call `logger.debug('x')`, assert NOT called

**Checkpoint**: `npx vitest run __tests__/modules/shared/logger.test.ts` — all 4 tests pass; `logger.ts` statement coverage ≥ 80%.

---

## Phase 7: User Story 5 — Reporting, CI & Documentation (Priority: P5)

**Goal**: Make coverage visible and enforced in CI; document the workflow in README.

- [x] T037 [US5] Update `README.md` — add `## Testing` section: `npm test` (all tests), `npm test -- --coverage` (coverage report), coverage thresholds table, link to `coverage/index.html`
- [x] T038 [P] [US5] Add shields.io static badge to `README.md` header: `![Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)` (update percentage when actual run confirms threshold met)
- [x] T039 [US5] Create `.github/workflows/ci.yml` — `on: push/PR to master`; single job `ubuntu-latest`; steps: `actions/checkout@v4`, `actions/setup-node@v4` (node 20, cache npm), `npm ci`, `npm run lint`, `npm test -- --coverage`

**Checkpoint**: Push a commit; confirm GitHub Actions runs the workflow and passes. README shows badge.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Blocks |
|-------|-----------|--------|
| Phase 1 (Tooling) | Nothing | All phases |
| Phase 2 (Foundational) | Phase 1 | Phase 3 (health test), Phase 6 (logger tests) |
| Phase 3 (US1 API tests) | Phase 1 + Phase 2 | Nothing |
| Phase 4 (US2 Components) | Phase 1 | Nothing |
| Phase 5 (US3 Chat service) | Phase 1 | Nothing |
| Phase 6 (US4 Logger) | Phase 1 + Phase 2 (T005) | Nothing |
| Phase 7 (US5 Docs/CI) | Phases 1–6 confirmed green | Nothing |

### Within Phase 3 (US1 — largest phase)

- T006 writes the describe/mock scaffold first; T007–T025 can be added in parallel (all edit the same 2 files, so split across chat-api.test.ts and conversations-api.test.ts)
- Write `chat-api.test.ts` group first (T006–T012), then `health-api.test.ts` (T013), then `conversations-api.test.ts` (T014–T025)

### Parallel Opportunities

- **Phase 1**: T002 and T003 in parallel (different files)
- **Phase 2**: T004 and T005 in parallel (different files)
- **Phase 3**: T013 and T014–T025 in parallel after T006 scaffold is in place
- **Phase 4**: T026–T029 fully parallel (separate files)
- **Phase 5**: T030 first (describe block); T031–T032 in parallel
- **Phase 6**: T033 first (file setup); T034–T036 in parallel
- **Phase 7**: T037–T038 in parallel; T039 after

---

## Parallel Execution Examples

### Phase 3 split (largest volume — 20 tasks)

```bash
# Group A — chat-api.test.ts (T006–T012):
Task: "Replace it.todo happy path — POST /api/chat 200 streaming"
Task: "Replace it.todo invalid body — POST /api/chat 400"
Task: "Replace it.todo LLM error — POST /api/chat 500"

# Group B — conversations-api.test.ts (T014–T025):
Task: "Replace it.todo GET /api/conversations list empty"
Task: "Replace it.todo GET /api/conversations list with data"
Task: "Replace it.todo DELETE /api/conversations/:id cascade"
```

### Phase 4 (fully parallel — 4 separate files)

```bash
Task: "Create __tests__/components/ChatPanel.test.tsx"
Task: "Create __tests__/components/MessageInput.test.tsx"
Task: "Create __tests__/components/PersonaSelector.test.tsx"
Task: "Create __tests__/components/ModelSwitcher.test.tsx"
```

---

## Implementation Strategy

### MVP Scope (Phase 1 + Phase 2 + Phase 3 only)

Complete Phases 1–3. This alone lifts statement coverage from 12.25% to an estimated
55–65% (API routes are the largest uncovered surface). Verify metrics, then add
Phases 4–7 to hit the 80% statement target.

### Full Sprint Order (risk-reduction first)

1. **Phase 1** — configure tooling (30 min)
2. **Phase 2** — health route + logger fix (15 min)
3. **Phase 3** — API integration tests (2–3 hrs; biggest coverage gain)
4. **Phase 5** — chat-service expansion (1 hr)
5. **Phase 6** — logger tests (30 min)
6. **Phase 4** — component tests (1.5 hrs)
7. **Phase 7** — CI + docs (30 min)

### Notes

- `vi.clearAllMocks()` in `afterEach` is mandatory in every file using `vi.mock` or `vi.spyOn`
- Each component test file MUST start with `// @vitest-environment jsdom` (first line, before imports)
- `better-sqlite3` MUST NOT be imported in jsdom environment test files; the `vi.mock('@/modules/shared/db')` guard prevents this
- Commit after each phase checkpoint; don't batch multiple phases into one commit
- Run `npm test -- --coverage` after Phase 3 and Phase 7 to verify thresholds
