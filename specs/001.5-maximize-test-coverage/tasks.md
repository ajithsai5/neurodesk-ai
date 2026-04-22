# Tasks: Maximize Test Coverage

**Input**: Design documents from `/specs/001.5-maximize-test-coverage/`
**Prerequisites**: spec.md (this file), F01 implementation complete
**Run coverage**: `npm test -- --coverage`

**Organization**: Tasks are grouped by user story and ordered by risk-reduction priority.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared state)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Coverage Tooling)

**Purpose**: Install `@vitest/coverage-v8` and configure thresholds so every
subsequent test task contributes to a measurable, enforced target.

- [ ] T001 Install `@vitest/coverage-v8` as a dev dependency (`npm install -D @vitest/coverage-v8`)
- [ ] T002 Add `coverage` config block to `vitest.config.ts`: provider `v8`, `reporter: ["text","html","json-summary"]`, `reportsDirectory: "coverage"`, thresholds `statements:80, branches:90, functions:85, lines:80`
- [ ] T003 Add `coverage/` to `.gitignore` (if not already present)

**Checkpoint**: `npm test -- --coverage` produces a `coverage/` directory and exits non-zero when thresholds are not met.

---

## Phase 2: User Story 1 — API Route Tests (Priority: P1)

**Goal**: Raise API route coverage from 0% to ≥ 80% statements.
`POST /api/chat` happy path, invalid body (400), LLM error (500),
and `GET /api/health` are all covered.

**Independent Test**: `npx vitest run __tests__/integration/`

### Tests for User Story 1

> **Write these tests FIRST — verify they fail before touching production code**

- [ ] T004 [US1] Un-skip or write integration test: `POST /api/chat` happy path — mock `handleChatMessage`, assert `200` streaming response in `__tests__/integration/chat-api.test.ts`
- [ ] T005 [P] [US1] Un-skip or write integration test: `POST /api/chat` invalid body (missing `message`) — assert `400` with structured error in `__tests__/integration/chat-api.test.ts`
- [ ] T006 [P] [US1] Un-skip or write integration test: `POST /api/chat` LLM provider throws — mock `handleChatMessage` to throw, assert `500` in `__tests__/integration/chat-api.test.ts`
- [ ] T007 [P] [US1] Write integration test: `GET /api/health` — assert `200` with `{ status: "ok" }` in `__tests__/integration/health-api.test.ts`

**Checkpoint**: All route integration tests pass; API branch coverage ≥ 85%.

---

## Phase 3: User Story 2 — React Component Tests (Priority: P2)

**Goal**: Raise component coverage from 0% to ≥ 75% functions using
`@testing-library/react`. Tests cover render, Enter-key submission,
persona selection, and model switching.

**Independent Test**: `npx vitest run __tests__/components/`

### Setup

- [ ] T008 Install `@testing-library/react` and `@testing-library/user-event` as dev dependencies if not already present

### Tests for User Story 2

> **Write these tests FIRST — verify they fail before touching production code**

- [ ] T009 [P] [US2] Write render + interaction test for `ChatPanel` (renders empty message list, no crash) in `__tests__/components/ChatPanel.test.tsx`
- [ ] T010 [P] [US2] Write render + interaction test for `MessageInput`: type text → press `Enter` → verify `onSend` called with text and input cleared; also verify empty/whitespace input does NOT fire `onSend` in `__tests__/components/MessageInput.test.tsx`
- [ ] T011 [P] [US2] Write render + interaction test for `PersonaSelector` (maps to `PersonaSelector`): renders persona list, selecting a different persona fires `onChange` with correct id in `__tests__/components/PersonaSelector.test.tsx`
- [ ] T012 [P] [US2] Write render + interaction test for `ModelSwitcher`: renders provider list, selecting a different provider fires `onModelChange` with correct key in `__tests__/components/ModelSwitcher.test.tsx`

**Checkpoint**: All component tests pass; component function coverage ≥ 75%.

---

## Phase 4: User Story 3 — Chat Service Coverage (Priority: P3)

**Goal**: Raise `chat-service.ts` coverage from 24.5% to ≥ 75% statements
by adding tests for `buildContextWindow` trim paths and full `sendMessage`
orchestration with a mocked LLM client.

**Independent Test**: `npx vitest run __tests__/modules/chat/chat-service.test.ts`

### Tests for User Story 3

> **Write these tests FIRST — verify they fail before touching production code**

- [ ] T013 [US3] Add test: `buildContextWindow` trims to last 20 messages when conversation has 25 in `__tests__/modules/chat/chat-service.test.ts`
- [ ] T014 [P] [US3] Add test: `buildContextWindow` trims by token cap after message-count trim — mock `countTokens` to return values exceeding 100K cap in `__tests__/modules/chat/chat-service.test.ts`
- [ ] T015 [P] [US3] Add test: `sendMessage` assembles prompt with persona system instruction + trimmed context + user message, calls mocked LLM client, persists assistant response to DB in `__tests__/modules/chat/chat-service.test.ts` (use `vi.mock` for llm-client and db)

**Checkpoint**: `chat-service.ts` statement coverage ≥ 75%.

---

## Phase 5: User Story 4 — Logger Coverage (Priority: P4)

**Goal**: Raise `logger.ts` coverage from 20% to ≥ 80% statements by
spying on `console` methods and verifying silent/active behaviour per
environment.

**Independent Test**: `npx vitest run __tests__/modules/shared/logger.test.ts`

### Tests for User Story 4

> **Write these tests FIRST — verify they fail before touching production code**

- [ ] T016 [US4] Write test: `logger.info` is silent in `NODE_ENV=test` — `vi.spyOn(console, "info")` and assert not called in `__tests__/modules/shared/logger.test.ts`
- [ ] T017 [P] [US4] Write test: `logger.warn` delegates to `console.warn` in `NODE_ENV=development` in `__tests__/modules/shared/logger.test.ts`
- [ ] T018 [P] [US4] Write test: `logger.error` includes stack trace when passed an `Error` object in `__tests__/modules/shared/logger.test.ts`

**Checkpoint**: `logger.ts` statement coverage ≥ 80%.

---

## Phase 6: User Story 5 — Reporting & Documentation (Priority: P5)

**Purpose**: Make coverage visible in the README and enforce it in CI.

- [ ] T019 [US5] Update `README.md`: add `## Testing` section documenting `npm test -- --coverage`, the `coverage/` output directory, and per-file targets
- [ ] T020 [P] [US5] Add coverage badge to `README.md` (shields.io static badge reflecting statement target: `![Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)`)
- [ ] T021 [P] [US5] Verify CI config (if present) runs `npm test -- --coverage` and fails on threshold breach; add the command if missing

**Checkpoint**: README documents the coverage workflow; CI enforces thresholds.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 API tests (Phase 2)**: Depends on Phase 1 (provider configured)
- **US2 Component tests (Phase 3)**: Depends on Phase 1; T008 must complete before T009–T012
- **US3 Chat-service tests (Phase 4)**: Depends on Phase 1; independent of Phases 2–3
- **US4 Logger tests (Phase 5)**: Depends on Phase 1; independent of Phases 2–4
- **US5 Docs (Phase 6)**: Can start in parallel with Phases 2–5; T021 should run last

### Parallel Opportunities

- **Phase 2**: T004 seeds the file; T005–T007 can be written in parallel once the file exists
- **Phase 3**: T009–T012 are all independent files — fully parallel after T008
- **Phase 4**: T013 first (builds the describe block); T014–T015 in parallel after
- **Phase 5**: T016 first; T017–T018 in parallel after
- **Phase 6**: T019–T020 in parallel; T021 after

---

## Implementation Strategy

### Fastest Path to Threshold

1. Phase 1 (tooling) — unblocks everything
2. Phase 4 (chat-service) in parallel with Phase 5 (logger) — highest statement delta per task
3. Phase 2 (API routes) — large uncovered surface, quick wins with mocks
4. Phase 3 (components) — requires `@testing-library/react` setup
5. Phase 6 (docs) — last, after metrics confirmed green

### Notes

- `vi.clearAllMocks()` in `afterEach` is mandatory for all test files that use `vi.mock` or `vi.spyOn`
- Component tests must use `jsdom` environment — add `// @vitest-environment jsdom` at the top of each component test file
- DB tests must use in-memory SQLite (`:memory:`) — never import the app's DB singleton
- `better-sqlite3` MUST NOT be imported from test files that run in `jsdom` environment
- Commit after each phase checkpoint; do not batch multiple phases into one commit
