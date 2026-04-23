# Feature Specification: Maximize Test Coverage

**Feature Branch**: `001.5-maximize-test-coverage`
**Created**: 2026-04-22
**Status**: In-Progress
**Depends On**: F01 (`001-smart-chatbot`)
**Priority**: High

## Coverage Baseline

| Metric     | Current | Target |
|------------|---------|--------|
| Statements | 12.25%  | 80%    |
| Branches   | 82%     | 90%    |
| Functions  | 68.42%  | 85%    |
| Lines      | 12.25%  | 80%    |

### Well-Tested (at or near 100%)

- `src/lib/config.ts` — 100%
- `src/modules/chat/context-window.ts` — 100%
- `src/modules/chat/llm-client.ts` — 100%
- `src/modules/shared/validation.ts` — 100%

### Needs Work

- `src/app/api/**` (API routes) — 0%
- `src/components/**` (React components) — 0%
- `src/modules/chat/chat-service.ts` — 24.5%
- `src/modules/shared/logger.ts` — 20%

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - API Route Test Coverage (Priority: P1)

A developer runs `npm test -- --coverage` and sees that all four API route
handlers (`POST /api/chat`, `GET /api/health`, `GET /api/conversations`,
`GET /api/personas`) are verified by integration tests. The test suite
catches regressions in request validation, LLM error propagation, and
HTTP status codes without requiring a running server.

**Why this priority**: API routes are the integration boundary between
the frontend and the backend logic. With 0% coverage today, any breakage
in input validation or error handling goes entirely undetected by CI.
Fixing this first maximises risk reduction per test written.

**Independent Test**: Run `npx vitest run __tests__/integration/api/` and
confirm all route tests pass; observe branch coverage for api routes rise
above 80% in the coverage report.

**Acceptance Scenarios**:

1. **Given** a valid JSON body `{ conversationId, message }` is posted to
   `/api/chat`,
   **When** the handler is invoked with a mocked `handleChatMessage`,
   **Then** it returns a `200` streaming response.

2. **Given** an invalid or missing body is posted to `/api/chat`,
   **When** Zod validation runs,
   **Then** the handler returns `400` with `{ error: "Invalid input" }`.

3. **Given** the LLM provider throws an error during streaming,
   **When** the error propagates through `handleChatMessage`,
   **Then** the handler returns `500` with a structured error body.

4. **Given** a `GET /api/health` request,
   **When** the handler runs,
   **Then** it returns `200` with `{ status: "ok" }` and no DB call is
   required.

---

### User Story 2 - React Component Test Coverage (Priority: P2)

A developer runs the test suite and sees that the four key UI components
(`ChatPanel`, `MessageInput`, `PersonaSelector`, `ModelSwitcher`)
have snapshot and interaction tests. The tests confirm that pressing Enter
submits a message, selecting a persona fires the correct callback, and the
component tree renders without crashing.

**Why this priority**: Components currently have 0% coverage. Even shallow
render tests catch import errors and prop-type mismatches early. Interaction
tests protect the `Enter`-to-submit and persona-switch flows — the primary
user interactions identified in F01.

**Independent Test**: Run `npx vitest run __tests__/components/` and verify
it passes; observe function coverage for `src/components/**` above 75% in
the report.

**Acceptance Scenarios**:

1. **Given** `ChatPanel` is rendered with an empty `messages` prop,
   **When** the component mounts,
   **Then** it renders without throwing and shows an empty message list.

2. **Given** `MessageInput` is rendered,
   **When** the user types text and presses `Enter`,
   **Then** the `onSend` callback is invoked with the typed text and the
   input field is cleared.

3. **Given** `PersonaSelector` is rendered with a list of personas,
   **When** the user selects a different persona,
   **Then** the `onChange` callback receives the selected persona's id.

4. **Given** `ModelSwitcher` is rendered with available provider configs,
   **When** the user selects a different model,
   **Then** the `onModelChange` callback receives the new provider key.

---

### User Story 3 - Chat Service Coverage (Priority: P3)

A developer runs the test suite and sees `chat-service.ts` coverage rise
from 24.5% to ≥ 75%. New tests verify that `buildContextWindow` applies
message-count trimming, token-cap trimming, and that `sendMessage` correctly
assembles the full prompt, calls the LLM client, and saves the response to
the database.

**Why this priority**: `chat-service.ts` orchestrates the core chat
loop. At 24.5% coverage the trimming logic and multi-turn assembly paths
are untested, meaning bugs in those paths have no automated safety net.

**Independent Test**: Run
`npx vitest run __tests__/modules/chat/chat-service.test.ts` and confirm
line coverage for `chat-service.ts` is ≥ 75%.

**Acceptance Scenarios**:

1. **Given** a conversation with 25 messages (exceeding the 20-message
   default window),
   **When** `buildContextWindow` is called,
   **Then** only the most recent 20 messages are returned.

2. **Given** a set of messages whose total token count exceeds 100 000,
   **When** `buildContextWindow` trims by token cap after message-count
   trimming,
   **Then** the oldest messages within the window are removed until the
   total is within the cap.

3. **Given** a valid conversation id and user message,
   **When** `sendMessage` is called with a mocked LLM client,
   **Then** the assembled prompt includes the persona system instruction
   and the trimmed context, and the assistant response is persisted to
   the database.

---

### User Story 4 - Logger Coverage (Priority: P4)

A developer runs the test suite and sees `logger.ts` coverage rise from
20% to ≥ 80%. Tests confirm that `logger.info`, `logger.warn`, and
`logger.error` delegate to `console` in development, are silent in the
test environment, and that `logger.error` always includes the full
stack trace.

**Why this priority**: The logger wraps all `console` calls throughout the
codebase (required by Principle VI of the constitution). Untested logger
behaviour means silent failures or noisy test output can be introduced
without detection.

**Independent Test**: Run
`npx vitest run __tests__/modules/shared/logger.test.ts` and confirm
statement coverage for `logger.ts` is ≥ 80%.

**Acceptance Scenarios**:

1. **Given** the test environment (`NODE_ENV=test`),
   **When** `logger.info("msg")` is called,
   **Then** `console.info` is NOT invoked (silent mode).

2. **Given** the development environment (`NODE_ENV=development`),
   **When** `logger.warn("msg")` is called,
   **Then** `console.warn` is invoked with the message.

3. **Given** an `Error` object is passed to `logger.error`,
   **When** the call is made in any environment,
   **Then** the stack trace is included in the log output.

---

### User Story 5 - Coverage Reporting & Documentation (Priority: P5)

A developer reads the project README and sees a coverage badge showing the
current statement percentage. They run `npm test -- --coverage` and a
human-readable HTML report is generated under `coverage/`. The CI pipeline
fails if any target threshold is breached.

**Why this priority**: Visibility sustains coverage discipline. Without a
badge and enforced thresholds, coverage degrades silently between sprints.
This is the lowest priority because it adds no test logic, only tooling.

**Independent Test**: Run `npm test -- --coverage` and verify the command
succeeds, the `coverage/` directory is populated, and the README badge URL
resolves to the correct percentage.

**Acceptance Scenarios**:

1. **Given** `@vitest/coverage-v8` is installed as a dev dependency,
   **When** `npm test -- --coverage` is run,
   **Then** a `coverage/` directory is created containing `index.html`
   and a JSON summary.

2. **Given** thresholds configured in `vitest.config.ts`,
   **When** any metric falls below its target,
   **Then** the test run exits with a non-zero code.

3. **Given** the README is updated,
   **When** a developer reads it,
   **Then** they see a coverage badge and the command to run coverage
   locally.

---

### Edge Cases

- What happens when a test file imports `better-sqlite3` directly?
  Tests must use the in-memory SQLite pattern already established in the
  test suite (`:memory:` with manually created tables) — never the app
  singleton.
- What happens when `vi.mock` for the LLM client leaks state between
  tests? Each test file must call `vi.clearAllMocks()` in `afterEach` or
  use `vi.resetModules()` to prevent cross-test contamination.
- What happens if coverage thresholds cause false failures on untested
  new code added mid-sprint? The global thresholds in `vitest.config.ts`
  apply to the entire coverage report. New files are included immediately;
  there is no per-file grace period. Developers must add tests for any new
  file before merging if it would break a threshold.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `@vitest/coverage-v8` MUST be installed as a dev dependency
  and the `coverage` provider MUST be set to `v8` in `vitest.config.ts`.
- **FR-002**: `npm test -- --coverage` MUST produce a `coverage/`
  directory with an HTML report and a `coverage-summary.json`.
- **FR-003**: `vitest.config.ts` MUST define **global** per-metric thresholds
  (applied across the entire coverage report) matching the targets:
  statements ≥ 80%, branches ≥ 90%, functions ≥ 85%, lines ≥ 80%.
  Per-file threshold overrides are explicitly out of scope for this sprint.
- **FR-004**: Integration tests for `POST /api/chat` MUST cover: happy path,
  invalid body (400), and LLM provider error (500).
- **FR-004a**: Integration tests for `GET|POST /api/conversations` and
  `GET|PATCH|DELETE /api/conversations/:id` MUST be implemented in this
  sprint, covering: list active conversations, create with defaults, get
  with messages (200 + 404), rename (200 + validation errors), delete
  (cascade). All existing `it.todo()` placeholders in
  `__tests__/integration/conversations-api.test.ts` MUST be replaced with
  working tests.
- **FR-005**: Integration tests for `GET /api/health` MUST confirm the
  endpoint returns `200` with `{ status: "ok" }`.
- **FR-006**: Component tests MUST use `@testing-library/react` and cover
  at minimum: `ChatPanel`, `MessageInput`, `PersonaSelector`,
  `ModelSwitcher`. Each component test file MUST include a
  `// @vitest-environment jsdom` docblock as the first line; the global
  `vitest.config.ts` environment remains `node` and MUST NOT be changed.
- **FR-007**: `MessageInput` tests MUST verify that pressing `Enter` fires
  the `onSend` callback and clears the input.
- **FR-008**: `chat-service.ts` tests MUST mock the LLM client using
  `vi.mock` and cover `buildContextWindow` trim-by-count and trim-by-token
  branches.
- **FR-009**: `logger.ts` tests MUST use `vi.spyOn(console, ...)` and verify
  silent behaviour in `NODE_ENV=test`.
- **FR-010**: The README MUST document the `npm test -- --coverage` command
  and include a coverage badge.
- **FR-011**: A `.github/workflows/ci.yml` file MUST be created that runs
  `npm ci && npm test -- --coverage` on every push and pull request
  targeting `master`. The workflow MUST fail if any coverage threshold is
  breached.

### Key Entities

- **Coverage Report**: Output of `@vitest/coverage-v8`; stored in
  `coverage/`; includes HTML, JSON summary, and per-file line data.
- **Vitest Config Thresholds**: Key/value map of metric → minimum
  percentage enforced at CI time; defined in `vitest.config.ts`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm test -- --coverage` exits with code `0` and all four
  metric thresholds are met: statements ≥ 80%, branches ≥ 90%,
  functions ≥ 85%, lines ≥ 80%.
- **SC-002**: `POST /api/chat` route handler has ≥ 3 distinct test cases
  (happy path, validation error, LLM error) and branch coverage ≥ 85%.
  All `it.todo()` entries in `conversations-api.test.ts` are replaced with
  passing tests covering list, create, get, rename, and delete endpoints.
- **SC-003**: All four React components have at least one render test and
  one interaction test; component function coverage ≥ 75%.
- **SC-004**: `chat-service.ts` statement coverage rises from 24.5% to
  ≥ 75% as measured by `coverage-summary.json`.
- **SC-005**: `logger.ts` statement coverage rises from 20% to ≥ 80%.
- **SC-006**: The `coverage/` directory is gitignored and not committed;
  only the badge URL in README reflects the latest run.
- **SC-007**: A GitHub Actions CI pipeline (`.github/workflows/ci.yml`)
  runs `npm ci && npm test -- --coverage` on every push and PR to
  `master`; the workflow fails when any threshold-breaking regression is
  introduced, preventing merge.

## Clarifications

### Session 2026-04-22

- Q: Should coverage thresholds be global (one set of numbers for the whole report) or per-file (targeting only `src/modules/` and `src/app/api/`)? → A: Global thresholds applied to all covered files via `vitest.config.ts` `thresholds` block.
- Q: Should a CI pipeline be created as part of this sprint, given none currently exists? → A: Yes — create `.github/workflows/ci.yml` running `npm ci && npm test -- --coverage` on push/PR to `master`.
- Q: Are conversations-api `it.todo()` tests (list, create, get, rename, delete — 14 entries) in scope for this sprint? → A: Yes — implement all conversations-api integration tests as part of US1 alongside the chat-api tests.
- Q: How should the jsdom test environment be configured for React component tests given the global `vitest.config.ts` sets `environment: "node"`? → A: Per-file `// @vitest-environment jsdom` docblock at the top of each component test file; global config remains unchanged.
- Q: Spec used "ChatWindow" and "SystemPromptSelector" but codebase components are `ChatPanel` and `PersonaSelector` — which names should the spec use? → A: Codebase names (`ChatPanel`, `PersonaSelector`) — spec updated throughout for traceability.

## Assumptions

- `@testing-library/react` is already installed or can be added as a dev
  dependency without conflicting with the existing React 18 / Next.js 14
  setup.
- The existing `vi.mock` patterns in
  `__tests__/modules/chat/context-window.test.ts` serve as the canonical
  mocking reference for new tests.
- The integration test placeholders in `__tests__/integration/` use
  `it.todo()` markers (not `it.skip`). All todos must be replaced with
  full working implementations — they cannot simply be un-skipped.
- Coverage badge hosting is via a static shield (e.g., shields.io with a
  JSON endpoint or a pre-built badge URL) — no external service integration
  is required in this sprint.
- E2E tests (Playwright) are out of scope; this sprint covers Vitest
  unit and integration tests only.
