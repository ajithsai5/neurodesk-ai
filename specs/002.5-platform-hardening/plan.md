# Implementation Plan: Platform Hardening — Coverage, CI, Security, Graphify & README

**Branch**: `002.5-platform-hardening` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/002.5-platform-hardening/spec.md`

---

## Summary

Harden the NeuroDesk AI platform across six parallel tracks before Feature 03 begins: raise Vitest coverage thresholds to 90% (aspirational 95%), restructure CI into separate jobs with a Node 18/20 matrix and coverage PR comments, resolve all Dependabot and CodeQL security findings, integrate Graphify (a multimodal knowledge-graph tool with tree-sitter TypeScript AST parsing) to index the codebase and enrich chat context, expose a graph query API and UI panel, and rewrite the README with live badges, full feature table, and setup guides.

---

## Technical Context

**Language/Version**: TypeScript 5.7 (strict mode)  
**Primary Dependencies**: Next.js 14 (App Router), Vitest 3.1, @vitest/coverage-v8, Drizzle ORM, better-sqlite3, Vercel AI SDK (ai@^4.3), Graphify (github:safishamsi/graphify — multimodal knowledge-graph tool with tree-sitter AST, 25 languages including TypeScript — see research.md)  
**Storage**: SQLite via Drizzle ORM + better-sqlite3; graph nodes/edges stored in two new SQLite tables backed by Graphify's adapter (see data-model.md)  
**Testing**: Vitest (unit + integration), Playwright (E2E), @testing-library/react (component tests)  
**Target Platform**: Node.js 18 and 20 on ubuntu-latest (GitHub Actions)  
**Project Type**: Full-stack Next.js web application (single process, single package.json)  
**Performance Goals**: Graph query API responds within 2 s for ≤50 conversation nodes; graph UI panel renders within 3 s  
**Constraints**: No monorepo; no separate graph database; better-sqlite3 must remain server-only (never imported from client components); TypeScript strict throughout  
**Scale/Scope**: Single-user or small-team instance backed by a local SQLite file; graph store size bounded by cascade-delete on conversation deletion

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Modular Architecture | ✅ PASS | Graphify integration lives in new `src/modules/graph/`; all other tracks are config/docs/tests — no cross-module boundary violations |
| II. Test-First | ✅ PASS | Coverage threshold raise and error-boundary/snapshot tests are the primary deliverable; tests written before implementation code |
| III. Security-First | ✅ PASS | Graph endpoint requires session auth (FR-020, clarified); CodeQL remediates existing vulnerabilities; Dependabot closes known CVEs |
| IV. API-First Design | ✅ PASS | `GET /api/graph/query` defined in contracts/ before the UI panel is built (see contracts/graph-query.md) |
| V. Simplicity & YAGNI | ✅ PASS | Graphify backed by SQLite (no new infrastructure); no explicit node-cap mechanism; graceful degradation rather than complex fallback logic |
| VI. Observability | ✅ PASS | Graph write failures logged server-side (FR-018); CI job failure messages visible in Actions summary |
| VII. Incremental Delivery | ✅ PASS | Six tracks are independently mergeable; each user story has a standalone acceptance test |

**Verdict**: All gates pass. Proceeding to Phase 0.

---

## Project Structure

### Documentation (this feature)

```text
specs/002.5-platform-hardening/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── graph-query.md       ← Phase 1 output
│   └── health-endpoint.md   ← Phase 1 output (FR-020b graph stats)
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code Changes (repository root)

```text
# Config & CI changes
.github/
├── workflows/
│   ├── ci.yml                          ← restructured: split jobs, Node matrix, coverage comment
│   └── codeql.yml                      ← new: CodeQL analysis workflow
└── dependabot.yml                      ← new: daily npm schedule, auto-merge config

vitest.config.ts                        ← threshold raise: 80% → 90%; add jsdom env for components

# New graph module
src/modules/graph/
├── index.ts                            ← public API re-exports
├── graph-client.ts                     ← Graphify init, SQLite store, getGraphStats()
├── graph-service.ts                    ← runASTAnalysis (best-effort), writeConversationNode,
│                                          writeChunkNodes, queryGraph, queryCodeEntities,
│                                          rerankWithGraph, cascadeDeleteConversation
└── types.ts                            ← GraphNode (MESSAGE/CHUNK/CODE_ENTITY), GraphEdge,
                                           GraphQueryResult, GraphStats, CodeEntity

# New API route
src/app/api/graph/
└── query/
    └── route.ts                        ← GET /api/graph/query (session-authenticated)

# New UI component
src/components/
└── GraphPanel.tsx                      ← client component: interactive node-edge visualisation + empty state

# Updated files
src/modules/chat/chat-service.ts        ← queryCodeEntities() injects code context into LLM prompt (FR-018b);
                                           writeConversationNode() after stream (silent degradation)
src/app/api/health/route.ts             ← add graph: { nodeCount, edgeCount, lastUpdated } (FR-020b)
src/modules/shared/db/schema.ts         ← add graph_nodes + graph_edges tables (if Graphify uses Drizzle)
README.md                               ← full rewrite with badges, feature table, architecture diagram

# New tests
__tests__/modules/chat/
├── chat-service.test.ts                ← extend: graph write, silent-degradation branch, all error paths
└── (snapshot tests via @testing-library/react)

__tests__/modules/graph/
├── graph-service.test.ts               ← unit: writeConversationNode, cascade-delete, empty-store degradation
└── graph-client.test.ts                ← unit: init, connection errors

__tests__/integration/
└── graph-api.test.ts                   ← integration: GET /api/graph/query auth, 200, 401, empty result

__tests__/components/
├── GraphPanel.test.tsx                 ← snapshot + empty-state assertion
├── ChatPanel.test.tsx                  ← snapshot
├── MessageInput.test.tsx               ← snapshot
├── MessageList.test.tsx                ← snapshot
└── StreamingMessage.test.tsx           ← snapshot
```

**Structure Decision**: Single Next.js project (Option 1 variant). New `src/modules/graph/` module follows the established module boundary pattern. Graph-related components live in `src/components/` alongside existing component files. All tests follow the established `__tests__/` layout.

---

## Complexity Tracking

*No Constitution violations requiring justification.*

---

## Implementation Phases

### Track A — Test Coverage (US-2, FR-001 to FR-004c)

**Goal**: Reach ≥90% (aspirational 95%) line/branch/function coverage; add error-boundary, snapshot, logger, and llm-client path tests.

1. Raise thresholds in `vitest.config.ts` to 90% for all metrics (comment notes 95% aspirational).
2. Add `environmentMatchGlobs` to apply `jsdom` to `__tests__/components/**` only.
3. Write snapshot tests for all React components (ChatPanel, MessageInput, MessageList, StreamingMessage, ModelSwitcher, PersonaSelector).
4. Add error-boundary tests using `@testing-library/react`.
5. Extend `chat-service.test.ts`: provider error path, context-trim path, validation-failure path.
6. Extend `logger.test.ts`: for each log level (debug, info, warn, error), set `process.env.NODE_ENV = 'development'` in `beforeEach` (restoring in `afterEach`), use `vi.spyOn(console, 'log'/'warn'/'error')`, call the logger, assert the spy received a JSON-parseable string with correct `level`, `message`, and `timestamp` fields. The logger's `NODE_ENV === 'test'` suppression guard MUST NOT be modified.
7. Extend `llm-client.test.ts`: add separate test groups for the Ollama local path, the OpenAI cloud path, and the Anthropic cloud path — each mocked independently with `vi.mock()` so no live API key is required.
8. Run coverage locally; iterate until all metrics ≥90%.

**Key file**: `vitest.config.ts`, `__tests__/components/*.test.tsx`, `__tests__/modules/chat/chat-service.test.ts`, `__tests__/modules/shared/logger.test.ts`, `__tests__/modules/chat/llm-client.test.ts`

---

### Track B — CI Restructure (US-1, FR-005 to FR-009)

**Goal**: Split single CI job into lint / test / build / CodeQL; add Node matrix; add coverage PR comment.

1. Rewrite `.github/workflows/ci.yml`:
   - Job `lint`: `npm ci` → `npm run lint`
   - Job `test`: matrix [18, 20] → `npm ci` → `npm test -- --coverage` → upload coverage artifact
   - Job `build`: depends on `test` → `npm ci` → `npm run build`
   - Job `coverage-comment`: depends on `test` → uses `davelosert/vitest-coverage-report@v2` to post PR comment
   - Replace all deprecated actions with latest pinned versions
2. Create `.github/workflows/codeql.yml` (see Track C).
3. Add CodeQL as required status check in branch protection (manual GitHub UI step — documented in quickstart.md).

**Key file**: `.github/workflows/ci.yml`

---

### Track C — CodeQL (US-3, FR-014 to FR-016)

**Goal**: Enable CodeQL workflow; resolve all findings.

1. Create `.github/workflows/codeql.yml`:
   - Trigger: `push` to master, `pull_request` to master, weekly schedule
   - Language: `javascript-typescript`
   - Uses: `github/codeql-action/init@v3`, `github/codeql-action/autobuild@v3`, `github/codeql-action/analyze@v3`
2. Run CodeQL locally (via `gh codeql`) or push to trigger first scan.
3. Triage findings: fix injection, unsafe regex, hardcoded secrets, prototype pollution in source.
4. Add required status check in branch protection (manual step — documented in quickstart.md).

**Key file**: `.github/workflows/codeql.yml`, source files with findings

---

### Track D — Dependabot (US-3, FR-010 to FR-013)

**Goal**: Configure daily Dependabot, resolve critical/high alerts, enable patch auto-merge.

1. Create `.github/dependabot.yml` with two entries:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: npm
       directory: /
       schedule:
         interval: daily
       open-pull-requests-limit: 10
       groups:
         patch-updates:
           update-types: ["patch"]
     - package-ecosystem: github-actions
       directory: /
       schedule:
         interval: weekly
   ```
2. Add auto-merge workflow triggered by `pull_request` from `dependabot[bot]` for patch updates: `gh pr merge --auto --squash`.
3. Triage existing Dependabot alerts: upgrade all critical/high packages; pin direct deps in `package.json`.

**Key file**: `.github/dependabot.yml`, `.github/workflows/dependabot-auto-merge.yml`

---

### Track E — Graphify Integration (US-4, FR-017 to FR-024a)

**What Graphify is**: A multimodal knowledge-graph AI coding assistant tool. It parses source files via tree-sitter AST (25 languages, TypeScript included), ingests PDFs/markdown/images/video/audio, and produces a queryable knowledge graph of concepts and relationships. Invoked with `/graphify` in Claude Code and other AI tools.

**Goal**: Install Graphify, run its tree-sitter AST parser on `src/` (best-effort), wire graph context into chat responses, expose graph query API + health stats, build UI panel, implement `queryCodeEntities()` for Feature 03.

**Sub-steps** (in dependency order):

1. **Install**: `npm install github:safishamsi/graphify` (or npm name if published). Verify TypeScript types with `npx tsc --noEmit`. Inspect exported API: AST analysis entry point, node/edge write interface, query API.
2. **Graph module**: Create `src/modules/graph/` with:
   - `types.ts` — `GraphNode` (types: `MESSAGE`, `CHUNK`, `CODE_ENTITY`), `GraphEdge`, `GraphQueryResult`, `GraphStats`, `CodeEntity` (name, kind, filePath, lineStart, lineEnd)
   - `graph-client.ts` — initialise Graphify + SQLite-backed `graph_nodes`/`graph_edges` store; export `initGraphClient()`, `getGraphStats()`
   - `graph-service.ts` — export: `runASTAnalysis()` (tree-sitter on `src/`, best-effort with try/catch + warn log); `writeConversationNode()`; `writeChunkNodes()`; `queryGraph()`; `queryCodeEntities(sessionId, query)` (retrieves CODE_ENTITY nodes — used by FR-018b and Feature 03); `rerankWithGraph()`; `cascadeDeleteConversation()`
   - `index.ts` — re-export public API
3. **Schema extension**: Add `graph_nodes` + `graph_edges` Drizzle tables to `src/modules/shared/db/schema.ts`. Run `npx drizzle-kit push`.
4. **Initial graph**: On app initialisation (e.g., `src/lib/startup.ts` or server startup hook), call `runASTAnalysis()` wrapped in try/catch — success populates CODE_ENTITY nodes; failure logs a warning and continues.
5. **Chat enrichment (FR-018b)**: In `chat-service.ts`, before `streamText()`, call `queryCodeEntities(sessionId, userMessage)` and inject matched code entity context into the LLM system prompt (name, kind, filePath, relationship summary). Wrap in try/catch; skip if graph empty. After stream completes, call `writeConversationNode()` (silent degradation).
6. **RAG integration**: After vector search, call `rerankWithGraph()` — skip gracefully if graph empty.
7. **Graph API route**: `src/app/api/graph/query/route.ts` — 401 if no session; 400 if `q` absent; call `queryGraph()`; return `{ nodes, edges }`.
8. **Health stats (FR-020b)**: Update `src/app/api/health/route.ts` — add `graph: { nodeCount, edgeCount, lastUpdated }` to response; return `graph: null` if store unreachable.
9. **Cascade delete**: Update conversation DELETE handler to call `cascadeDeleteConversation()` (silent degradation).
10. **UI panel**: `src/components/GraphPanel.tsx` — fetch graph query on mount; render `<ForceGraph2D>`; empty-state message when no nodes.
11. **Tests**: Unit tests for graph-service (including `queryCodeEntities`, best-effort AST, empty-store degradation); integration test for GET /api/graph/query and GET /api/health graph key; snapshot test for GraphPanel.

**Key files**: `src/modules/graph/*`, `src/app/api/graph/query/route.ts`, `src/app/api/health/route.ts`, `src/components/GraphPanel.tsx`, `src/modules/chat/chat-service.ts`

---

### Track F — README (US-5, FR-024 to FR-032)

**Goal**: Full README rewrite with live badges, feature table, architecture diagram, Graphify section, setup guides, contributing guide.

1. Add badge row: CI, coverage (shields.io), CodeQL, Node version, license, last-commit date, LinkedIn (`https://www.linkedin.com/in/sri-sai-ajith-mandava-ba73a7183/`), GitHub (`https://github.com/ajithsai5`).
2. Write project overview paragraph (2–3 sentences).
3. Add feature status table (F01–F09) with columns: ID, Name, Description, Status.
4. Embed architecture diagram (Mermaid flowchart of module boundaries and data flow).
5. Add Graphify section with 3 example graph queries and JSON response samples.
6. Add full tech stack table (library, version, role).
7. Local setup guide with Ollama (step-by-step, including model pull commands).
8. Cloud setup guide (OpenAI/Anthropic API keys, deployment notes).
9. Test and CI section (how to run locally, how CI is structured).
10. Screenshots or animated GIF per feature (captured from local dev instance).
11. Contributing guide (branch naming, spec-before-code, PR checklist).
12. License section.

**Key file**: `README.md`

---

## Delivery Order & Dependencies

```
Track A (coverage)     ─┐
Track B (CI)           ─┤─→ merge when independently green
Track C (CodeQL)       ─┤
Track D (Dependabot)   ─┘

Track E (Graphify)     → depends on Track A thresholds being set (so new graph tests count toward 90%)
Track F (README)       → depends on Track B/C badge URLs being stable
```

All tracks can be worked in parallel except Track E (should start after Track A thresholds are committed, so coverage doesn't regress) and Track F (badge URLs need real CI to be live).
