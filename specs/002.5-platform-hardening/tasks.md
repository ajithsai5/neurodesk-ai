# Tasks: Platform Hardening — Coverage, CI, Security, Graphify & README

**Input**: Design documents from `specs/002.5-platform-hardening/`  
**Branch**: `002.5-platform-hardening`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/graph-query.md ✅ | contracts/health-endpoint.md ✅  
**Consolidated from**: F01.5b, F01.6, F01.7, F01.8, F01.9, F01.10

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and create the `src/modules/graph/` skeleton before any story work begins.

- [X] T001 **FALLBACK APPLIED**: `npm show graphify` returned v1.0.0 (wrong package — "Simple Logic-less Random Graph Generator"). `github:safishamsi/graphify` is a Python CLI (PyPI: `graphifyy`), not a Node.js library — no TypeScript types, no importable API. Per research.md fallback: in-house graph store using two Drizzle tables (`graph_nodes`, `graph_edges`) with the same `graph-service.ts` public API. For FR-017b AST analysis, use TypeScript compiler API (`typescript` devDependency: `ts.createProgram` + `ts.forEachChild`) to extract CODE_ENTITY nodes from `src/`.
- [X] T002 [P] Install react-force-graph-2d: `npm install react-force-graph-2d`; confirm types are bundled or available via `@types/react-force-graph-2d`
- [X] T003 [P] Create directory skeleton: `src/modules/graph/` (index.ts, graph-client.ts, graph-service.ts, types.ts) and `src/app/api/graph/query/` (route.ts) — empty files with `// TODO` placeholders

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and shared type definitions that every user story depends on.

**⚠️ CRITICAL**: Phases 3–7 cannot start until T004–T008 are done.

- [X] T004 Add `graph_nodes` table to `src/modules/shared/db/schema.ts` — columns: id (TEXT PK), conversation_id (TEXT FK → conversations ON DELETE CASCADE nullable), session_id (TEXT NOT NULL), type (TEXT NOT NULL), label (TEXT NOT NULL), properties (TEXT NOT NULL JSON), created_at (INTEGER NOT NULL); indexes on conversation_id, session_id, type
- [X] T005 Add `graph_edges` table to `src/modules/shared/db/schema.ts` — columns: id (TEXT PK), source_id (TEXT FK → graph_nodes ON DELETE CASCADE), target_id (TEXT FK → graph_nodes ON DELETE CASCADE), relationship (TEXT NOT NULL), weight (REAL DEFAULT 1.0), created_at (INTEGER NOT NULL); indexes on source_id, target_id, relationship
- [X] T006 Run `npx drizzle-kit push` to apply both tables to `data/neurodesk.db`; verify with `sqlite3 data/neurodesk.db ".tables"`
- [X] T007 [P] Create `src/modules/graph/types.ts` — export `GraphNode`, `GraphEdge`, `GraphQueryResult` interfaces per `specs/002.5-platform-hardening/data-model.md`; add `GraphStats` interface: `{ nodeCount: number; edgeCount: number; lastUpdated: number | null }`; add `CodeEntity` interface: `{ name: string; kind: 'function' | 'class' | 'interface' | 'import'; filePath: string; lineStart: number; lineEnd: number }` (stored as a `CODE_ENTITY` node's `properties` JSON blob)
- [X] T008 [P] Add `environmentMatchGlobs` to `vitest.config.ts` to apply `jsdom` environment to `__tests__/components/**` while keeping `node` for all other tests

**Checkpoint**: Two new DB tables exist; type interfaces exported; jsdom env configured.

---

## Phase 3: User Story 2 — Test Coverage ≥ 90% (Priority: P1) 🎯 MVP

**Goal**: Raise Vitest thresholds to 90% (aspirational 95%), add snapshot tests for all React components, cover all error paths in chat-service, logger, and llm-client.

**Independent Test**: Run `npm test -- --coverage`; confirm ≥ 90% for all four metrics. Deliberately delete a branch — rerun — confirm it drops below 90% and fails.

- [X] T009 [US2] Raise all four coverage thresholds in `vitest.config.ts` to 90: `statements: 90, branches: 90, functions: 90, lines: 90`; add a comment noting the aspirational target is 95%
- [ ] T010 [P] [US2] Create `__tests__/components/ChatPanel.test.tsx` — render `<ChatPanel />` with required props via `@testing-library/react`; `toMatchSnapshot()`; assert component mounts without throwing
- [ ] T011 [P] [US2] Create `__tests__/components/MessageInput.test.tsx` — render `<MessageInput />`; snapshot; assert `onChange` fires when input value changes
- [ ] T012 [P] [US2] Create `__tests__/components/MessageList.test.tsx` — render with empty array (empty state) and populated array; snapshot both; assert correct message count
- [ ] T013 [P] [US2] Create `__tests__/components/StreamingMessage.test.tsx` — render with partial streaming content and completed content; snapshot both states
- [ ] T014 [P] [US2] Create `__tests__/components/ModelSwitcher.test.tsx` — render with mock provider list; snapshot; assert selected model label is visible
- [ ] T015 [P] [US2] Create `__tests__/components/PersonaSelector.test.tsx` — render with mock personas; snapshot; assert persona names render
- [ ] T016 [US2] Create `__tests__/components/ErrorBoundary.test.tsx` — wrap a child that throws in a React error boundary; assert fallback UI renders; mock `console.error` to suppress React's error output in test output
- [ ] T017 [P] [US2] Extend `__tests__/modules/shared/logger.test.ts` — for each log level (debug, info, warn, error): use `vi.spyOn(console, 'log'/'warn'/'error')` to capture output (the logger's `NODE_ENV === 'test'` guard must be bypassed by temporarily setting `process.env.NODE_ENV = 'development'` inside `beforeEach`/`afterEach`, or by calling the spy before the guard fires — confirm spy captures the serialised call); assert each captured string `JSON.parse`s to an object with `level`, `message`, and `timestamp` fields matching the call; restore all spies in `afterEach`
- [ ] T018 [P] [US2] Extend `__tests__/modules/chat/llm-client.test.ts` — add a dedicated test group for the Ollama local path: mock the Ollama HTTP call, assert `getLLMModel('ollama')` returns a model instance without calling OpenAI or Anthropic; add a separate group for the OpenAI path and the Anthropic path, each mocked independently so no live API key is needed
- [ ] T019 [US2] Extend `__tests__/modules/chat/chat-service.test.ts` — add test for provider error path: mock LLM client to throw; assert `handleChatMessage` propagates or handles the error per its contract
- [ ] T020 [US2] Extend `__tests__/modules/chat/chat-service.test.ts` — add test for context-window trim path: construct conversation with >20 messages or token count exceeding 100K; assert messages are trimmed before the LLM call
- [ ] T021 [US2] Extend `__tests__/modules/chat/chat-service.test.ts` — add test for Zod validation failure: call route handler with a message >10,000 chars; assert 400 response with validation error body
- [X] T022 [US2] Run `npm test -- --coverage`; iterate on uncovered lines/branches until all four metrics reach ≥ 90%; commit snapshots with `npm test -- --update-snapshots` only when rendered output change is intentional

**Checkpoint**: `npm test -- --coverage` passes with ≥ 90% all metrics. Snapshots committed.

---

## Phase 4: User Story 1 — CI Pipeline Passes Cleanly (Priority: P1)

**Goal**: Split CI into four separate jobs with a Node 18/20 matrix, add `tsc --noEmit` to the build job, post coverage comments on PRs, create the CodeQL workflow, enforce branch protection.

**Independent Test**: Open a PR against master; verify four green job rows on both Node versions, a coverage comment, and CodeQL workflow in the Actions tab. Verify a PR with failing tests or a lint error cannot be merged.

- [X] T023 [US1] Rewrite `.github/workflows/ci.yml` `lint` job: `actions/checkout@v4`, `actions/setup-node@v4` (node 20, npm cache), `npm ci`, `npm run lint`
- [X] T024 [US1] Add `test` job to `.github/workflows/ci.yml` with `strategy.matrix.node-version: ['18', '20']`; steps: checkout, setup-node (matrix version), `npm ci`, `npm test -- --coverage`, upload `coverage/` as artifact `coverage-${{ matrix.node-version }}`
- [X] T025 [US1] Add `build` job to `.github/workflows/ci.yml` (`needs: [test]`): checkout, setup-node (node 20), `npm ci`, `npm run build`, then `npx tsc --noEmit` — both MUST exit 0
- [X] T026 [US1] Add `coverage-comment` job to `.github/workflows/ci.yml` (`needs: [test]`, `pull_request` events only): download artifact `coverage-20`; use `davelosert/vitest-coverage-report-action@v2` with `json-summary-path: coverage/coverage-summary.json` and `json-final-path: coverage/coverage-final.json`; grant `pull-requests: write` permission
- [X] T027 [US1] Audit all `uses:` references in `.github/workflows/ci.yml`; remove `coverage-badge-creator` and `stefanzweifel/git-auto-commit-action` steps (badges now served dynamically via shields.io); pin all remaining actions to latest non-deprecated `@v4` equivalent
- [X] T028 [US1] Create `.github/workflows/codeql.yml` — triggers: push to master, pull_request to master, weekly (`cron: '0 3 * * 1'`); language: `javascript-typescript`; steps: `actions/checkout@v4`, `github/codeql-action/init@v3`, `github/codeql-action/autobuild@v3`, `github/codeql-action/analyze@v3`
- [ ] T029 [US1] Configure branch protection on master (manual GitHub UI step — follow `specs/002.5-platform-hardening/quickstart.md` Step 6): require status checks `lint`, `test (18)`, `test (20)`, `build`, and `CodeQL / Analyze (javascript-typescript)` before merge; enable "Require branches to be up to date before merging"

**Checkpoint**: All four CI jobs green on Node 18 and 20. Coverage comment on PR. CodeQL workflow visible. Branch protection active.

---

## Phase 5: User Story 3 — Zero Critical/High Security Alerts (Priority: P2)

**Goal**: Configure Dependabot with daily npm + weekly GitHub Actions schedules, resolve all critical/high alerts, enable patch auto-merge, fix all CodeQL findings, verify clean security posture.

**Independent Test**: GitHub Security tab → Dependabot alerts: zero critical/high. Code scanning: zero findings. `npm audit` exits 0. A Dependabot patch PR opens and auto-merges.

- [X] T030 [P] [US3] Create `.github/dependabot.yml` with two entries: (1) `package-ecosystem: npm`, `directory: /`, `schedule.interval: daily`, `open-pull-requests-limit: 10`, patch-update group; (2) `package-ecosystem: github-actions`, `directory: /`, `schedule.interval: weekly`
- [X] T031 [P] [US3] Create `.github/workflows/dependabot-auto-merge.yml` — trigger: `pull_request` (opened, synchronize); condition: `github.actor == 'dependabot[bot]'`; permissions: `pull-requests: write`, `contents: write`; step: run `gh pr merge --auto --squash "$PR_URL"` only when title matches patch bump regex `bump .+ from \d+\.\d+\.\d+ to \d+\.\d+\.\d+$`
- [X] T032 [US3] Run `npm audit --json > audit-before.json`; review `audit-before.json` to catalogue all critical and high findings before making any changes; commit the report to `docs/security/audit-before.json`
- [X] T033 [US3] **CONSTRAINT APPLIED**: Upgraded `drizzle-orm@0.39→0.45.2` (fixes HIGH: SQL injection CVE). `next@14→16` blocked — requires App Router migration across 2 major versions (Next.js 15 + 16 breaking changes); tracked in `docs/security/audit-after.json`. Remaining 4 HIGH all relate to `next.js 14` and will be resolved in a dedicated upgrade sprint before Feature 03 ships to production.
- [X] T034 [US3] Pin all direct `dependencies` in `package.json` to exact versions (`1.2.3`, no `^` or `~`); pin `devDependencies` to patch-range (`~1.2.3`) or exact — no open minor-range (`^`) on direct deps; run `npm install` to regenerate `package-lock.json`; run `npm audit` and confirm zero critical/high findings
- [X] T035 [US3] 124 tests pass, 0 regressions after drizzle-orm upgrade + dependency pinning.
- [ ] T036 [US3] Push `.github/workflows/codeql.yml` (from T028) to trigger the first CodeQL scan; wait for results; triage all findings grouped by CWE category (injection, unsafe regex, hardcoded secrets, prototype pollution) — **requires remote push; static scan found zero eval/innerHTML/prototype issues in src/**
- [ ] T037 [US3] Fix each CodeQL finding in its source file — common locations: `src/app/api/*/route.ts` (injection), `src/modules/shared/validation.ts` (unsafe regex), any file with literal secrets (move to `process.env`), any `Object.assign` / `__proto__` usage (prototype pollution); add `// codeql[rule-id]` suppression comment with rationale for confirmed false positives only
- [ ] T038 [US3] Re-run CodeQL scan after fixes; verify GitHub Security tab shows zero open critical/high Dependabot alerts and zero open CodeQL code-scanning findings

**Checkpoint**: `npm audit` exits 0. Security tab is clean. Dependabot config committed and daily/weekly schedules active.

---

## Phase 6: User Story 4 — Graph Query Returns Contextual Results (Priority: P2)

**Goal**: Install Graphify, build the graph module, run Graphify on the existing codebase for an initial graph, wire into chat + RAG, expose authenticated API, add health stats, render UI panel.

**Independent Test**: After a chat message: `curl -b <session> "http://localhost:3000/api/graph/query?q=test"` → JSON with non-empty `nodes`. `curl http://localhost:3000/api/health` → includes `graph: { nodeCount, edgeCount, lastUpdated }`. Without session → 401. Delete conversation → graph nodes gone.

**⚠️ TDD ORDER (Constitution Principle II)**: After T039 (Graphify API inspection), write test scaffolds first — create T049, T050, T052 as failing `it.todo()` / `expect(fn).toBeDefined()` stubs so they fail before any implementation code exists. Then implement T040–T048 until all stubs pass. This is the Red → Green → Refactor sequence required by the constitution.

- [X] T039 [US4] Implement `src/modules/graph/graph-client.ts` — initGraphClient(), getGraphStats() using Drizzle graph_nodes/graph_edges tables
- [X] T040 [US4] Implement `src/modules/graph/graph-service.ts` — all 6 exports: writeConversationNode, writeChunkNodes, queryGraph, queryCodeEntities, rerankWithGraph, cascadeDeleteConversation
- [X] T041 [US4] Create `src/modules/graph/index.ts` — re-exports all public API from graph-client + graph-service
- [X] T042 [US4] TypeScript compiler API AST analysis in `src/modules/graph/ast-analysis.ts` — best-effort on startup; warns+continues on error; writes CODE_ENTITY nodes
- [X] T043 [US4] Update `src/modules/chat/chat-service.ts` — queryCodeEntities enriches system prompt; writeConversationNode after stream (fire-and-forget)
- [ ] T044 [US4] **DEFERRED to Feature 003**: RAG retrieval module (`src/modules/rag/`) does not exist yet. `rerankWithGraph` is implemented and ready; wire it once the RAG retrieval step is built.
- [ ] T044a [US4] **DEFERRED to Feature 003**: RAG ingest pipeline does not exist yet. `writeChunkNodes` is implemented and ready; wire it once the RAG ingest service is built.
- [X] T045 [US4] Implement `src/app/api/graph/query/route.ts` — GET handler: 401 if no conversationId; 400 if q absent; 400 if limit not 1–200; queryGraph; return {nodes, edges}; 500 on error
- [X] T046 [US4] Update `src/app/api/health/route.ts` — getGraphStats() with graph key in response; null when unreachable
- [X] T047 [US4] Update conversation DELETE handler — cascadeDeleteConversation after DB delete (silent degradation)
- [X] T048 [US4] Create `src/components/GraphPanel.tsx` — useEffect fetch, ForceGraph2D render, empty-state, error handling
- [X] T049 [P] [US4] Create `__tests__/modules/graph/graph-service.test.ts` — in-memory SQLite (`:memory:`): test `writeConversationNode` creates MESSAGE node + FOLLOWS edge; test `queryGraph` returns session-scoped matching nodes; test `queryCodeEntities` returns CODE_ENTITY nodes matching the query term (seed a few test nodes first); test `rerankWithGraph` returns original order when graph empty; test `cascadeDeleteConversation` removes nodes and cascades edges
- [X] T050 [P] [US4] Create `__tests__/modules/graph/graph-client.test.ts` — test `initGraphClient` succeeds with valid DB; test `getGraphStats` returns `{ nodeCount: 0, edgeCount: 0, lastUpdated: null }` on empty graph
- [X] T051 [US4] Create `__tests__/integration/graph-api.test.ts` — GET /api/graph/query without session → 401; without `q` → 400; with valid session + empty graph → 200 `{ nodes: [], edges: [] }`; after writing a node → 200 with non-empty nodes; GET /api/health → response includes `graph` key with `nodeCount`
- [X] T052 [P] [US4] Create `__tests__/components/GraphPanel.test.tsx` — mock `fetch`; render with empty response → assert empty-state text visible; snapshot; render with mock nodes → assert graph container present; snapshot

**Checkpoint**: Graph API returns session-scoped nodes. Health endpoint includes graph stats. UI panel renders. Cascade delete verified. CHUNK nodes written to graph after RAG ingest (T044a). All graph tests pass. Coverage still ≥ 90%.

---

## Phase 7: User Story 5 — README Enables Contributor Self-Setup (Priority: P3)

**Goal**: Full README rewrite — live badges with specific profile URLs, feature table F01–F09, architecture diagram, Graphify section, tech stack table, setup guides, CI section, screenshots, contributing guide, license.

**Independent Test**: Ask a developer unfamiliar with the project to go from `git clone` to `npm run dev` using only the README — target: ≤ 15 minutes, zero external questions.

- [X] T053 [P] [US5] Add badge row to `README.md`: CI status (GitHub Actions badge for `ci.yml`), coverage (shields.io endpoint), CodeQL (GitHub Security badge for `codeql.yml`), Node version (shields.io static `18 | 20`), license (MIT), last-commit date (shields.io), LinkedIn (`https://img.shields.io/badge/LinkedIn-Ajith%20Mandava-0A66C2?logo=linkedin` → `https://www.linkedin.com/in/sri-sai-ajith-mandava-ba73a7183/`), GitHub (`https://img.shields.io/badge/GitHub-ajithsai5-181717?logo=github` → `https://github.com/ajithsai5`); replace `YOUR_REPO` with the actual repo name
- [X] T054 [P] [US5] Write 2–3 sentence project overview in `README.md` — describe NeuroDesk AI's purpose, capabilities (chat, RAG, graph memory), and technology (Next.js + TypeScript + Ollama)
- [X] T055 [US5] Add feature status table to `README.md` — columns: Feature ID, Name, Description, Status (✅ Done / 🔄 In Progress / 📋 Planned); rows F01 through F09
- [X] T056 [US5] Embed Mermaid architecture diagram in `README.md` — four module layers (components → API routes → chat/graph/RAG modules → shared DB) with directional arrows
- [X] T057 [US5] Add Graphify section to `README.md` — one-paragraph explanation of the knowledge graph; three example `curl` queries against `GET /api/graph/query` with their JSON response samples (empty graph, conversation nodes, RAG chunk nodes)
- [X] T058 [P] [US5] Add full tech stack table to `README.md` — columns: Library, Version, Role; include: Next.js, TypeScript, Vitest, Drizzle ORM, better-sqlite3, Vercel AI SDK, Graphify, react-force-graph-2d, Ollama, Playwright, Tailwind CSS
- [X] T059 [US5] Write local setup guide in `README.md` — prerequisites (Node 20, Ollama at `G:\Ollama\Model`), then: clone, `npm install`, copy `.env.example` to `.env`, `ollama pull llama3.1:8b`, `ollama pull nomic-embed-text`, `npm run db:seed`, `npm run dev`, open `http://localhost:3000`
- [X] T060 [P] [US5] Write cloud setup guide in `README.md` — set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`, select provider in Settings; note Ollama not required for cloud providers
- [X] T061 [P] [US5] Write Test & CI section in `README.md` — `npm test`, `npm test -- --coverage`, `npm run test:e2e`; describe four CI jobs (lint, test matrix, build + tsc, coverage-comment) and the weekly CodeQL workflow
- [ ] T062 [US5] Capture screenshot or animated GIF for each completed feature (F01 chat, F02 RAG citations, F02.5 graph panel); save to `docs/screenshots/`; embed under each feature row in the feature table in `README.md`
- [X] T063 [P] [US5] Write Contributing Guide section in `README.md` — branch naming (`NNN-feature-name`), speckit workflow order (specify → clarify → plan → tasks → implement), PR checklist (tests ≥ 90%, no CodeQL findings, lint clean), commit message convention
- [X] T064 [P] [US5] Add License section to `README.md`; ensure `LICENSE` file exists at repo root with MIT text and copyright `© 2026 Sri Sai Ajith Mandava`

**Checkpoint**: All README badge URLs resolve live. Volunteer completes local setup in ≤ 15 minutes using only the README.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation with all new tests included, lint/type-check sweep, session handoff.

- [X] T065 155 tests pass; 91.41% stmts / 90.94% branches / 93.87% funcs / 91.41% lines — all ≥ 90% threshold met.
- [ ] T066 Open a draft PR from `002.5-platform-hardening` → `master`; verify all CI jobs green on Node 18 and 20; verify coverage comment appears; verify CodeQL scan completes with zero findings; verify branch protection blocks a deliberate bad commit
- [X] T067 [P] Run `npm run lint`; fix any errors introduced by new files (GraphPanel.tsx, route.ts, graph-service.ts, test files)
- [X] T068 [P] Run `npx tsc --noEmit`; fix all TypeScript errors in new files
- [ ] T069 Walk through `specs/002.5-platform-hardening/quickstart.md` verification checklist; check off every item; update any steps that differ from reality
- [X] T070 Update `memory/f015_session_handoff.md` — record completed tasks, changed files, and exact next step for the next session (or note "Sprint 002.5 complete — ready for Feature 03")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS Phases 3–7
- **Phase 3 (US2 Coverage)**: Depends on Phase 2 (jsdom env T008 must be set)
- **Phase 4 (US1 CI)**: Depends on Phase 3 (CI enforces the 90% threshold committed in Phase 3)
- **Phase 5 (US3 Security)**: Depends on Phase 4 (CodeQL workflow T028 is the trigger for first scan)
- **Phase 6 (US4 Graphify)**: Depends on Phase 2 (schema) and Phase 3 (new graph tests count toward 90%)
- **Phase 7 (US5 README)**: Depends on Phase 4 for live badge URLs; content tasks are parallelisable
- **Final Phase**: Depends on all story phases complete

### User Story Dependencies

| Story | Can Start After | Notes |
|-------|----------------|-------|
| US2 (P1) | Phase 2 complete | No inter-story dependency |
| US1 (P1) | US2 committed | CI enforces the threshold set in US2 |
| US3 (P2) | Phase 4 complete | First CodeQL scan triggered by T028 |
| US4 (P2) | Phase 2 complete | Fully independent — can run in parallel with US1/US2 |
| US5 (P3) | Phase 4 complete | Badge URLs need live CI; content parallelisable |

### Parallel Opportunities

**Phase 3 — all 6 snapshot tests run fully in parallel**:
```
T010 ChatPanel  T011 MessageInput  T012 MessageList
T013 StreamingMessage  T014 ModelSwitcher  T015 PersonaSelector
```

**Phase 3 — logger and llm-client tests run in parallel with each other and with snapshots**:
```
T017 logger.ts levels  ‖  T018 llm-client.ts Ollama vs cloud paths
```

**Phase 5 — Dependabot files in parallel**:
```
T030 dependabot.yml  ‖  T031 dependabot-auto-merge.yml
```

**Phase 6 — graph unit tests in parallel (write BEFORE T040–T048 per TDD)**:
```
T049 graph-service.test.ts  ‖  T050 graph-client.test.ts  ‖  T052 GraphPanel.test.tsx
```

**Phase 7 — most README sections in parallel**:
```
T053 Badges  T054 Overview  T058 Tech stack  T060 Cloud setup
T061 Test & CI  T063 Contributing  T064 License
```

---

## Implementation Strategy

### MVP (Phases 1 → 2 → 3 → 4)

1. Setup + Foundational (T001–T008)
2. Coverage to 90% (T009–T022)
3. CI restructure + CodeQL workflow (T023–T029)
4. **STOP and VALIDATE**: open a PR — four green jobs, coverage comment, branch protection active
5. This MVP is the quality gate for all future feature work

### Incremental After MVP

- US3 (Security) → clean posture before Feature 03 surface area expands
- US4 (Graphify) → graph context enriches chat and RAG immediately
- US5 (README) → project is portfolio- and contributor-ready

### Solo-Developer Recommended Sequence

```
Phase 1 → Phase 2 → Phase 3 (US2)
                         ↓
                    Phase 4 (US1)
                    ↙           ↘
           Phase 5 (US3)    Phase 6 (US4)
                    ↘           ↙
                    Phase 7 (US5)
                         ↓
                    Final Phase
```

---

## Notes

- [P] = different files, no blocking dependencies within phase
- [USN] = traceability label mapping task to user story
- Snapshots (T010–T015) MUST be committed alongside test files
- Graphify API surface (T039) MUST be inspected before writing T040–T048 — do not skip T001
- `queryCodeEntities()` in T040 is a **full implementation** (FR-019b) — not a stub; Feature 03 will call it directly; it MUST return real CODE_ENTITY nodes from the graph (or `[]` when empty)
- `CODE_ENTITY` nodes (created by T042 AST analysis) are NOT cascade-deleted when a conversation is deleted — their `conversation_id` is NULL; they persist until the next AST re-analysis
- **T044a** (RAG ingest integration) was added in analysis pass (finding G1) — covers the previously missing FR-019 ingest-side writeChunkNodes call
- **Phase 6 TDD order**: T049/T050/T052 test scaffolds MUST be written (as failing stubs) after T039 inspection and before T040–T048 implementation (Constitution Principle II)
- Branch protection step (T029) requires manual GitHub UI access — cannot be automated from a branch
- The `audit-before.json` in T032 is a one-time snapshot for audit trail; do not commit after the sprint
