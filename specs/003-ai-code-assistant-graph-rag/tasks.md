# Tasks: AI Code Assistant + Graph-Enhanced RAG Pipeline

**Input**: Design documents from `specs/003-ai-code-assistant-graph-rag/`  
**Prerequisites**: plan.md ✅ | spec.md ✅  
**TDD**: Tests written FIRST and must FAIL before implementation (Constitution Principle II — NON-NEGOTIABLE)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to (US1–US6)
- Exact file paths in every task

---

## Phase 1: Setup

**Purpose**: Confirm environment readiness — no new npm packages are required

- [ ] T001 Verify readiness: run `npm test` (all 274+ tests pass), `npm run build` (clean), confirm `rehype-highlight` usage exists in `src/components/chat/MessageList.tsx` (reused for code output)

**Checkpoint**: Environment clean; no new deps to install

---

## Phase 2: Foundational — Track A (Blocks ALL user stories)

**Purpose**: Config constants and backwards-compatible graph service extensions that Tracks B and C both depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests first ⚠️ Write and confirm FAILING before T004–T005

- [ ] T002 [P] Write failing unit tests for Track A changes in `__tests__/modules/graph/graph-service.test.ts` — (a) `writeChunkNodes()` stores `documentId`, `pageNumber`, `similarityScore`, `retrievedAt` in node `properties` JSON when provided; (b) existing caller with only `{ id, text }` still succeeds; (c) `queryCodeEntities(_, _, 20)` returns up to 20 results; (d) `queryCodeEntities(_, _)` (two-arg) still caps at 10

### Implementation

- [ ] T003 [P] Add `ragCandidatePoolSize: 20` and `ragFinalContextSize: 5` to the config object in `src/lib/config.ts` alongside the existing context window constants
- [ ] T004 [P] Extend the chunk element type in `writeChunkNodes()` in `src/modules/graph/graph-service.ts` — from `{ id: string; text: string }` to `{ id: string; text: string; documentId?: string; pageNumber?: number; similarityScore?: number; retrievedAt?: number }`; store new optional fields in the node's `properties` JSON blob; existing callers passing only `{ id, text }` remain unaffected
- [ ] T005 [P] Add optional third parameter `limit = 10` to `queryCodeEntities(sessionId, query, limit?)` in `src/modules/graph/graph-service.ts`; update the internal `.limit()` call to use it; existing two-argument call sites in `chat-service.ts` continue to receive ≤ 10 results

**Checkpoint**: Config constants available; `writeChunkNodes()` accepts richer metadata; `queryCodeEntities()` accepts a limit; T002 tests pass

---

## Phase 3: US2 — Graph-Enhanced RAG (Priority: P1) — Track B

**Goal**: Widen candidate pool to 20, log chunks to graph, rerank by edge weight, inject top-5, show graph score in citations

**Independent Test**: Upload a multi-section PDF, ask any question twice (second call has graph data); confirm second response citation shows `[Doc, Page N, Graph Score: X]` with a non-zero score

### Tests first ⚠️ Write and confirm FAILING before T009–T011

- [ ] T006 [P] [US2] Write failing unit tests for `retrieveAndRerank()` in `__tests__/modules/rag/retrieval-service.test.ts` — (a) returns exactly `config.ragFinalContextSize` (5) chunks on happy path; (b) when `rerankWithGraph` throws, returns first 5 from original vector order (graceful fallback); (c) when `writeChunkNodes` throws, retrieval still completes and returns 5 chunks; (d) when graph is empty, returns first 5 from vector order unchanged
- [ ] T007 [P] [US2] Write failing unit tests for updated `Citation` / `formatCitations()` / `formatRagContext()` in `__tests__/modules/rag/retrieval-service.test.ts` — (a) `formatCitations()` includes `graphScore` field when chunk provides it; (b) `formatRagContext()` citation string uses `[Doc, Page N, Graph Score: X]` when `graphScore` defined; (c) uses `[Doc, Page N]` format when `graphScore` absent

### Implementation

- [ ] T008 [US2] Extend `Citation` interface in `src/modules/rag/retrieval-service.ts` with `graphScore?: number`; update `formatCitations()` to populate `graphScore` from chunk data when available
- [ ] T009 [US2] Update `formatRagContext()` in `src/modules/rag/retrieval-service.ts` — use `[${c.documentName}, Page ${c.pageNumber}, Graph Score: ${graphScore}]` when `graphScore` defined; keep `[${c.documentName}, Page ${c.pageNumber}]` otherwise; cite instructions at bottom of context block unchanged
- [ ] T010 [US2] Add `retrieveAndRerank(query: string, sessionId: string): Promise<RetrievedChunk[]>` to `src/modules/rag/retrieval-service.ts` — (1) `retrieveChunks(query, config.ragCandidatePoolSize)` gets 20 candidates; (2) fire-and-forget `writeChunkNodes(sessionId, candidates.map(c => ({ id: String(c.chunkId), text: c.content, documentId: c.documentName, pageNumber: c.pageNumber, similarityScore: c.distance, retrievedAt: Date.now() })))` in try/catch (silent degradation); (3) `rerankWithGraph(sessionId, candidates)` in try/catch (fallback to original order); (4) return `.slice(0, config.ragFinalContextSize)`
- [ ] T011 [US2] Update the RAG injection call site in `src/app/api/chat/route.ts` — replace `retrieveChunks(query, 5)` (or equivalent) with `retrieveAndRerank(query, conversationId)` so all document Q&A uses the widened + reranked pipeline

**Checkpoint**: Graph-enhanced RAG live. Upload PDF, ask twice, confirm second citation has Graph Score.

---

## Phase 4: US1 — Code Generation (Priority: P1) — Track C

**Goal**: Users describe a function, select a language, receive a generated code block via the configured LLM

**Independent Test**: POST `{ description: "reverse a string", language: "typescript" }` to `/api/code/generate`; verify 200 with valid TypeScript function in `code` field

### Tests first ⚠️ Write and confirm FAILING before T015–T017

- [ ] T012 [P] [US1] Write failing unit tests for `generateCode()` in `__tests__/modules/code/code-service.test.ts` — mock `queryCodeEntities` and `getLLMModel` with `vi.mock()`; test: (a) calls LLM with code-only system prompt for requested language; (b) prompt contains "## Relevant Codebase Symbols" when `queryCodeEntities` returns entities; (c) proceeds without graph block when `queryCodeEntities` returns `[]`; (d) throws with `{ status: 503 }` when no available provider exists
- [ ] T013 [P] [US1] Write failing integration tests for `POST /api/code/generate` in `__tests__/integration/code-api.test.ts` — test: (a) 200 `{ code, language }` on valid input; (b) 400 on empty `description`; (c) 400 when `language` not in enum; (d) 503 when `providerConfigs` table has no `isAvailable=true` row

### Implementation

- [ ] T014 [P] [US1] Create `src/modules/code/types.ts` — `Language` type (`'typescript' | 'javascript' | 'python' | 'go' | 'rust'`), `CodeGenerationRequest` (`{ description: string; language: Language; providerId?: string }`), `CodeExplanationRequest` (`{ code: string; language?: string }`), `CodeResult` (`{ code: string; language: string }`)
- [ ] T015 [US1] Create `src/modules/code/code-service.ts` — implement `generateCode(req: CodeGenerationRequest): Promise<CodeResult>`: (a) call `queryCodeEntities('', req.description, 20)` wrapped in try/catch (empty array on error); (b) build system prompt: `"You are a code generation assistant. Output ONLY the requested ${req.language} code block. No prose."` + optional `\n\n## Relevant Codebase Symbols\n${entityLines}` when entities non-empty; (c) resolve provider: `req.providerId` row first, else first `isAvailable=true` row from `providerConfigs`, else throw `Object.assign(new Error('No provider'), { status: 503 })`; (d) call `generateText({ model: getLLMModel(...), system: systemPrompt, prompt: req.description })`; (e) return `{ code: text, language: req.language }`
- [ ] T016 [US1] Create `src/app/api/code/generate/route.ts` — POST handler: Zod schema `{ description: z.string().min(1).max(2000), language: z.enum(['typescript','javascript','python','go','rust']), providerId: z.string().optional() }`; call `generateCode()`; catch `status: 503` and return `NextResponse.json({ error: 'No LLM provider available' }, { status: 503 })`; 400 on Zod failure; per contract `POST-code-generate.md`
- [ ] T017 [P] [US1] Create `specs/003-ai-code-assistant-graph-rag/contracts/POST-code-generate.md` — document request shape, response `{ code, language }`, errors (400 validation / 503 no-provider), and note on graph context injection

**Checkpoint**: `POST /api/code/generate` returns valid code. T012–T013 tests pass.

---

## Phase 5: US3 — Explain Code (Priority: P2) — Track C continued

**Goal**: Users paste existing code and receive a plain-English explanation of purpose, inputs, outputs, side effects

**Independent Test**: POST `{ code: "function debounce(fn, delay){...}" }` to `/api/code/explain`; verify 200 with an explanation describing the function's purpose

### Tests first ⚠️ Write and confirm FAILING before T020–T021

- [ ] T018 [P] [US3] Add failing unit tests for `explainCode()` to `__tests__/modules/code/code-service.test.ts` — (a) calls LLM with explain system prompt (does NOT contain code-only instruction); (b) returns `{ explanation: string }`; (c) throws `{ status: 503 }` when no provider
- [ ] T019 [P] [US3] Add failing integration tests for `POST /api/code/explain` to `__tests__/integration/code-api.test.ts` — (a) 200 `{ explanation }` on valid code; (b) 400 on empty `code`; (c) 400 when `code` exceeds 10,000 characters

### Implementation

- [ ] T020 [US3] Add `explainCode(req: CodeExplanationRequest): Promise<{ explanation: string }>` to `src/modules/code/code-service.ts` — system prompt: `"You are a code explanation assistant. Describe what this code does in plain English: purpose, inputs, outputs, side effects. Do NOT re-state the code line-by-line."`; same provider resolution as `generateCode()`; return `{ explanation: text }`
- [ ] T021 [US3] Create `src/app/api/code/explain/route.ts` — POST handler: Zod schema `{ code: z.string().min(1).max(10000), language: z.string().optional() }`; call `explainCode()`; 400 on Zod failure; per contract `POST-code-explain.md`
- [ ] T022 [P] [US3] Create `specs/003-ai-code-assistant-graph-rag/contracts/POST-code-explain.md` — document request shape, response `{ explanation }`, and error codes
- [ ] T023 [US1/US3] Create `src/modules/code/index.ts` — re-export `generateCode`, `explainCode`; add module comment block per Constitution VI

**Checkpoint**: Both `/api/code/generate` and `/api/code/explain` live and tested. Phase 6 can start.

---

## Phase 6: US4 — Graph-Aware Generation Verification (Priority: P2)

**Goal**: Confirm graph context is injected into code generation prompts when codebase entities exist

**Independent Test**: With graph store populated (from F002.5 AST analysis), describe "embed text for vector search"; confirm generated code references `generateEmbedding` or similar existing codebase symbol

### Tests first ⚠️ Write and confirm FAILING before T025

- [ ] T024 [P] [US4] Write failing unit test in `__tests__/modules/code/code-service.test.ts` — when `queryCodeEntities` mock returns `[{ id:'1', label:'generateEmbedding', properties:'{"kind":"function","filePath":"src/modules/rag/embedding-client.ts"}' }]`, assert the LLM system prompt passed to `generateText` contains the string `"generateEmbedding"` and `"## Relevant Codebase Symbols"`

### Implementation

- [ ] T025 [US4] Smoke-test graph-aware generation — start dev server (`npm run dev`), open Code Assistant tab, describe "a function that embeds a query for cosine similarity search", select TypeScript, click Generate; confirm the output references or is consistent with existing `generateEmbedding` usage in the codebase

**Checkpoint**: T024 passes. Smoke test confirms graph context influences generated output.

---

## Phase 7: US1 + US3 — Code Assistant UI (P1 + P2) — Track D

**Goal**: New "Code Assistant" tab on the existing page; Generate and Explain modes; syntax-highlighted code output

**Independent Test**: Open dev server, click "Code Assistant" tab, type "parse a JSON string safely", click Generate, verify syntax-highlighted TypeScript code appears; toggle to Explain, paste a function, click Explain, verify plain-English explanation appears

### Tests first ⚠️ Write and confirm FAILING before T027–T029

- [ ] T026 [P] [US1/US3] Write failing snapshot tests for `CodeAssistant.tsx` in `__tests__/components/CodeAssistant.test.tsx` — three snapshots: (a) Generate mode initial state; (b) Explain mode after toggle; (c) Generate mode with output text; assert Generate button is `disabled` when description is empty; assert switching modes clears output state

### Implementation

- [ ] T027 [US1] Create `src/components/CodeAssistant.tsx` — Generate mode: description `<textarea>` (placeholder "Describe the function...", maxLength 2000), character counter (warning style at 1600+), language `<select>` (options: TypeScript/JavaScript/Python/Go/Rust; default TypeScript), Generate button (disabled when empty or loading), output area wraps response in a fenced code block and passes to the existing markdown renderer (same pipeline as chat messages) so `rehype-highlight` applies syntax colouring; loading spinner; dismissible error banner for 400/503 responses
- [ ] T028 [US3] Add Explain mode to `src/components/CodeAssistant.tsx` — mode toggle: two-button group "Generate | Explain" at top of panel; Explain mode shows code `<textarea>` (placeholder "Paste code here...", maxLength 10000, character counter with warning at 8000+) and Explain button; switching mode clears both input and output; output renders as plain text (no code fence wrapper)
- [ ] T029 [US1] Add Code Assistant tab to `src/app/page.tsx` — add "Code Assistant" button in the panel toggle row alongside the existing GraphPanel toggle button; conditionally render `<CodeAssistant />` when Code Assistant is the active tab; only one panel (Graph or Code Assistant) visible at a time; default active panel unchanged (whichever it currently is)

**Checkpoint**: Code assistant tab visible and functional in the browser. Both modes work.

---

## Phase 8: US5 — Citations with Graph Score (Priority: P3)

**Goal**: Document Q&A citations show graph connectivity score when reranking was active

**Independent Test**: Upload a PDF, ask the same question twice (first populates graph; second triggers reranking); confirm second response citation reads `[Doc, Page N, Graph Score: X]` with X > 0

### Tests first ⚠️ Write and confirm FAILING before T031

- [ ] T030 [P] [US5] Add failing tests for `CitationPanel.tsx` in `__tests__/components/CitationPanel.test.tsx` (create file or extend existing) — (a) snapshot: citation with `graphScore: 4` renders "Graph Score: 4"; (b) snapshot: citation without `graphScore` renders only `[Doc, Page N]` with no score text; (c) snapshot unchanged from existing tests for old format

### Implementation

- [ ] T031 [US5] Update `src/components/CitationPanel.tsx` — extend citation item render to optionally show graph score: when `citation.graphScore !== undefined`, append `", Graph Score: ${citation.graphScore}"` to the citation label (e.g., `[Doc Name, Page 3, Graph Score: 4]`); no visual change for citations without a score

**Checkpoint**: Graph score visible in citation panel. T030 tests pass.

---

## Phase 9: US6 — Benchmark (Priority: P3) — Track E

**Goal**: 10-question evaluation set committed; benchmark script runs both strategies; results confirm ≥ 10% improvement

**⚠️ T032 MUST complete before T033 — eval set must exist before the benchmark script is written**

### Implementation

- [ ] T032 [US6] Create `specs/003-ai-code-assistant-graph-rag/eval-set.md` — define 10 questions with: the question text, 3–5 expected key phrases (for automated scoring), and source page number; drawn from a test PDF uploaded to the local dev instance. This formalises the evaluation set deferred from F002.5 SC-008.
- [ ] T033 [US6] Create `scripts/benchmark-rag.ts` — for each of the 10 eval-set questions: (a) F02 strategy: `retrieveChunks(q, 5)` → `formatRagContext()` → LLM call → score by key-phrase match count; (b) F03 strategy: `retrieveAndRerank(q, 'benchmark')` → `formatRagContext()` → LLM call → score by key-phrase match count; output per-question scores as a Markdown table plus aggregate improvement %
- [ ] T034 [US6] Run `npx ts-node scripts/benchmark-rag.ts` with test document loaded in dev instance; commit results to `specs/003-ai-code-assistant-graph-rag/benchmark.md` including: 10-question score table, aggregate F02 vs F03 improvement %, and verdict (PASS if ≥ 10% improvement, FAIL otherwise)

**Checkpoint**: Benchmark report committed. F002.5 SC-008 satisfied (or documented as needing more graph data).

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T035 [P] Create `specs/003-ai-code-assistant-graph-rag/research.md` — document: provider resolution strategy (providerId → first available → 503), LLM prompt decisions for generate vs explain modes, `rehype-highlight` reuse rationale, edge-weight-sum vs raw edge count decision
- [ ] T036 [P] Create `specs/003-ai-code-assistant-graph-rag/data-model.md` — document updated `Citation` type (with optional `graphScore`), `CodeGenerationRequest`, `CodeExplanationRequest`, `CodeResult`, `Language` enum, `RankedChunk` concept (20 candidates → reranked → 5 injected)
- [ ] T037 [P] Create `specs/003-ai-code-assistant-graph-rag/quickstart.md` — how to use code assistant (start dev server, open tab, test generate + explain, test with graph populated vs empty); how to run the RAG benchmark script
- [ ] T038 [P] Update `README.md` — add "Graph-Enhanced RAG Pipeline" section with Mermaid before/after flow diagram (F02: vec search → top-5 vs F03: vec search → top-20 → writeChunkNodes → rerankWithGraph → top-5); add "Code Assistant" usage guide covering generate mode, explain mode, and provider fallback; update F03 status in feature table to "Complete"
- [ ] T039 Run `npm run lint && npm test -- --coverage` — verify all 39 tasks' new code passes linting and TypeScript strict mode, all tests green, coverage ≥ 95% across statements/branches/functions/lines; fix any regression before final commit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — start immediately
- **Phase 2 (Track A)**: Depends on Phase 1 — BLOCKS all user stories
  - T002, T003, T004, T005 can run in parallel
- **Phase 3 (US2 Track B)** and **Phase 4 (US1 Track C)**: Both depend on Phase 2 — run in PARALLEL (entirely different files)
- **Phase 5 (US3)**: Depends on Phase 4 (same `code-service.ts` file — must follow T015)
- **Phase 6 (US4)**: Depends on Phase 4 (uses `generateCode()`)
- **Phase 7 (UI)**: Depends on Phases 4 + 5 (API routes must exist before UI component calls them)
- **Phase 8 (US5)**: Depends on Phase 3 (extends `Citation` type added in Track B)
- **Phase 9 (Benchmark)**: Depends on Phase 3 (requires `retrieveAndRerank()` live); T032 → T033 → T034 sequential
- **Phase 10 (Polish)**: T035–T038 parallel; T039 must be last

### Execution Graph

```
Phase 2 (Track A: T002–T005)
  ├──→ Phase 3 (US2 Track B: T006–T011) ──→ Phase 8 (US5: T030–T031)
  │                                      └──→ Phase 9 (Benchmark: T032–T034)
  └──→ Phase 4 (US1 Track C: T012–T017) ──→ Phase 5 (US3: T018–T023)
                                                   └──→ Phase 6 (US4: T024–T025)
                                                             └──→ Phase 7 (UI: T026–T029)
Phase 10 (Polish: T035–T039) — after all phases
```

### Parallel Agent Split (3 agents after Phase 2)

| Agent | Phases | Files touched |
|-------|--------|---------------|
| Agent 1 | Phase 3 + 8 (RAG + Citations) | `retrieval-service.ts`, `CitationPanel.tsx`, `route.ts` (chat) |
| Agent 2 | Phase 4 + 5 + 6 (Code backend) | `src/modules/code/*`, `src/app/api/code/*` |
| Agent 3 | Phase 7 (UI) | `CodeAssistant.tsx`, `src/app/page.tsx` |

Agents 1 and 2 can run simultaneously after Phase 2. Agent 3 starts after Agent 2's routes exist.

---

## Summary

| Phase | User Story | Tasks | Parallel |
|-------|-----------|-------|---------|
| 1 — Setup | — | T001 | — |
| 2 — Track A Foundational | — | T002–T005 | T002–T005 all parallel |
| 3 — US2 Graph RAG (P1) | US2 | T006–T011 | T006, T007 parallel |
| 4 — US1 Code Gen (P1) | US1 | T012–T017 | T012–T014, T017 parallel |
| 5 — US3 Explain Code (P2) | US3 | T018–T023 | T018, T019, T022 parallel |
| 6 — US4 Graph-Aware (P2) | US4 | T024–T025 | T024 parallel |
| 7 — UI (P1 + P2) | US1/US3 | T026–T029 | T026 parallel |
| 8 — US5 Citations (P3) | US5 | T030–T031 | T030 parallel |
| 9 — US6 Benchmark (P3) | US6 | T032–T034 | sequential (T032→T033→T034) |
| 10 — Polish | — | T035–T039 | T035–T038 parallel; T039 last |
| **Total** | **6 stories** | **39 tasks** | **12 parallel groups** |
