# Implementation Plan: AI Code Assistant + Graph-Enhanced RAG Pipeline

**Branch**: `003-ai-code-assistant-graph-rag` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003-ai-code-assistant-graph-rag/spec.md`

---

## Summary

Two parallel upgrades in one branch. First: a stateless code assistant module — users describe a function in plain English, select a language, and receive syntax-highlighted generated code; a toggle switches to explain-code mode for pasting existing code and getting plain-English explanations. Graph-aware: before generating, the service calls the existing `queryCodeEntities()` to inject relevant codebase symbols into the LLM prompt. Second: the F02 RAG pipeline's candidate pool is widened from top-5 to top-20 via vector similarity, every candidate is logged to the knowledge graph via the existing `writeChunkNodes()` (extended with richer metadata), and the existing `rerankWithGraph()` (edge-weight-sum scoring) reorders the 20 candidates before the top-5 are selected for LLM injection. Citations are updated to show a graph connectivity score. A 10-question benchmark confirms measurable quality improvement over pure-vector F02 retrieval.

---

## Technical Context

**Language/Version**: TypeScript 5.7 (strict mode) | Node.js 20+  
**Primary Dependencies** (no new packages required):

| Existing package | Reused for |
|-----------------|------------|
| `ai` + `@ai-sdk/anthropic` | Code generation via Claude (or any configured provider) |
| `rehype-highlight` 7.0.2 | Syntax highlighting already in bundle — reused for code output |
| `better-sqlite3` + `drizzle-orm` | Graph node reads/writes for reranking |
| `zod` | Request validation on new API routes |
| `js-tiktoken` | Token estimation for code generation prompt budgeting |

**New packages**: none — all dependencies already present.

**Storage**: Existing `data/neurodesk.db` — no schema changes needed. `writeChunkNodes()` and `rerankWithGraph()` already use the `graph_nodes` / `graph_edges` tables from F002.5.  
**Testing**: Vitest (unit + integration) | Playwright (E2E) | coverage threshold ≥ 95% (FR-033 from F002.5)  
**Target Platform**: Windows 11, local Next.js dev server, Node.js 20+  
**Project Type**: Next.js 14 App Router full-stack web application  
**Performance Goals**: Code generation ≤ 10 s (SC-001); explain-code ≤ 15 s (SC-002); `rerankWithGraph()` ≤ 100 ms (SC-005); `writeChunkNodes()` ≤ 200 ms additional latency (SC-004)  
**Constraints**: No new npm packages; better-sqlite3 server-only; TypeScript strict throughout; coverage must not drop below 95% on any commit to branch  
**Scale/Scope**: Single-user local tool; code generation stateless (no DB persistence of generated code in v1)

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Modular Architecture | ✅ PASS | New `src/modules/code/` module follows established pattern; RAG changes stay in `src/modules/rag/`; graph changes stay in `src/modules/graph/`; no circular imports |
| II. Test-First | ✅ PASS | Every new function gets a failing test before implementation; coverage threshold ≥ 95% enforced by CI |
| III. Security-First | ✅ PASS | Description capped at 2,000 chars; code input capped at 10,000 chars; both validated by Zod at route boundary; graph context injection uses existing sanitised path; no raw user content interpolated into SQL |
| IV. API-First | ✅ PASS | `POST /api/code/generate` and `POST /api/code/explain` defined in `contracts/` before UI is built |
| V. Simplicity & YAGNI | ✅ PASS | No new npm packages; `retrieveAndRerank()` is a thin wrapper — only 4 lines of orchestration; `writeChunkNodes()` extended with optional fields only; no plugin system or config flags |
| VI. Observability | ✅ PASS | Code service failures logged; `writeChunkNodes()` and `rerankWithGraph()` already log degradation; graph score visible in citations |
| VII. Incremental Delivery | ✅ PASS | Track A (config prereqs) → Track B (RAG) and Track C (code backend) independently deployable → Track D (UI) → Track E (benchmark) → Track F (README) |

**Verdict**: All gates pass.

---

## Project Structure

### Documentation (this feature)

```text
specs/003-ai-code-assistant-graph-rag/
├── plan.md              ← this file
├── research.md          ← Phase 0: technology decisions + prompt engineering notes
├── data-model.md        ← Phase 1: updated Citation type, CodeGenerationRequest, RankedChunk
├── quickstart.md        ← Phase 1: how to run code assistant locally
├── contracts/
│   ├── POST-code-generate.md    ← Phase 1: /api/code/generate contract
│   └── POST-code-explain.md     ← Phase 1: /api/code/explain contract
├── eval-set.md          ← 10-question benchmark input (created before benchmark script)
├── benchmark.md         ← benchmark results (created after benchmark script runs)
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code Changes

```text
# New module — code assistant
src/modules/code/
├── index.ts             NEW — public API: generateCode(), explainCode()
├── code-service.ts      NEW — LLM orchestration for generate + explain modes
└── types.ts             NEW — CodeGenerationRequest, CodeExplanationRequest, CodeResult

# New API routes
src/app/api/code/
├── generate/
│   └── route.ts         NEW — POST /api/code/generate (Zod validation, provider fallback)
└── explain/
    └── route.ts         NEW — POST /api/code/explain  (Zod validation)

# Modified — config
src/lib/config.ts        MODIFY — add ragCandidatePoolSize: 20, ragFinalContextSize: 5

# Modified — graph service
src/modules/graph/
└── graph-service.ts     MODIFY — extend writeChunkNodes() chunk element type with optional
                                  documentId/pageNumber/similarityScore/retrievedAt;
                                  add optional limit param to queryCodeEntities()

# Modified — RAG retrieval
src/modules/rag/
└── retrieval-service.ts MODIFY — add retrieveAndRerank(query, sessionId); extend
                                  Citation type with optional graphScore: number;
                                  update formatCitations() to include graphScore when present;
                                  update formatRagContext() citation format string

# Modified — UI
src/components/
└── CodeAssistant.tsx    NEW — tab component with Generate mode + Explain mode toggle,
                               language selector, syntax-highlighted output (rehype-highlight)
src/app/page.tsx         MODIFY — add "Code Assistant" tab alongside GraphPanel

# New tests
__tests__/modules/code/
└── code-service.test.ts NEW — unit: generate path, explain path, graph-context injection,
                                provider fallback, empty graph degradation, validation errors

__tests__/integration/
└── code-api.test.ts     NEW — integration: POST /api/code/generate (200, 400, 503),
                                POST /api/code/explain (200, 400)

__tests__/modules/rag/
└── retrieval-service.test.ts  EXTEND — retrieveAndRerank() happy path, graph-empty fallback,
                                         writeChunkNodes-failure degradation, citation graphScore

__tests__/modules/graph/
└── graph-service.test.ts      EXTEND — extended writeChunkNodes() metadata fields,
                                         queryCodeEntities() limit parameter

__tests__/components/
└── CodeAssistant.test.tsx      NEW — snapshot: generate mode, explain mode toggle, empty state

# Benchmark
scripts/
└── benchmark-rag.ts     NEW — runs 10 Q&A pairs from eval-set.md against F02 and F03 strategies
```

**Structure Decision**: Single Next.js project (Option 1 variant). New `src/modules/code/` follows the established module boundary pattern identical to `chat/`, `rag/`, `graph/`. No new routing beyond `src/app/api/code/`. The Code Assistant UI tab lives in `src/components/CodeAssistant.tsx` and is toggled in `src/app/page.tsx` via the same conditional-render pattern already used by GraphPanel.

---

## Implementation Phases

### Track A — Config & Graph Service Prereqs (blocks all other tracks)

**Goal**: Add the two new config constants and extend the two existing graph-service functions. These changes are backwards-compatible and unblock Tracks B and C in parallel.

1. Add `ragCandidatePoolSize: 20` and `ragFinalContextSize: 5` to the config object in `src/lib/config.ts`.
2. In `src/modules/graph/graph-service.ts`, extend the chunk element type in `writeChunkNodes()` from `{ id: string; text: string }` to `{ id: string; text: string; documentId?: string; pageNumber?: number; similarityScore?: number; retrievedAt?: number }`. Store new optional fields in the node's `properties` JSON blob. Existing callers pass only `{ id, text }` and are unaffected.
3. Add an optional `limit = 10` third parameter to `queryCodeEntities()`. Update its internal `.limit()` call to use this parameter. Existing callers at `chat-service.ts` pass no third arg and continue to receive up to 10 results.
4. Extend tests: update `__tests__/modules/graph/graph-service.test.ts` to assert the richer metadata appears in node properties, and to assert `queryCodeEntities(_, _, 20)` returns up to 20 results.

**Key files**: `src/lib/config.ts`, `src/modules/graph/graph-service.ts`

---

### Track B — Graph-Enhanced RAG Pipeline (P1 — depends on Track A)

**Goal**: Widen candidate pool to 20, write chunk nodes, rerank, slice to 5, update citations with graph score.

1. In `src/modules/rag/retrieval-service.ts`, add `retrieveAndRerank(query: string, sessionId: string): Promise<RetrievedChunk[]>`:
   - Call `retrieveChunks(query, config.ragCandidatePoolSize)` to get 20 candidates.
   - Call `writeChunkNodes(sessionId, candidates.map(...))` with richer metadata (chunkId as string, documentId, pageNumber, similarityScore = distance, retrievedAt = Date.now()). Fire-and-forget in try/catch — failure must not block retrieval.
   - Call `rerankWithGraph(sessionId, candidates)` — use existing function from `graph-service.ts`. On error or empty graph, keep original vector-similarity order.
   - Return `.slice(0, config.ragFinalContextSize)` from the reranked list.
2. Extend the `Citation` interface with `graphScore?: number`. Update `formatCitations()` to include `graphScore` from the corresponding `RankedChunk` when available.
3. Update `formatRagContext()` citation string: when `graphScore` is defined, use `[DocumentName, Page N, Graph Score: X]`; otherwise keep existing `[DocumentName, Page N]`.
4. Update `src/app/api/chat/route.ts` (or wherever `retrieveChunks()` is called for RAG injection) to call `retrieveAndRerank(query, conversationId)` instead.
5. Tests: extend `__tests__/modules/rag/retrieval-service.test.ts` with `retrieveAndRerank` test cases — happy path (confirms 5 chunks returned), graph-empty fallback (confirms vector order preserved), `writeChunkNodes` error (confirms retrieval still completes), citation format with and without graph score.

**Key files**: `src/modules/rag/retrieval-service.ts`, `src/app/api/chat/route.ts`

---

### Track C — Code Assistant Backend (P1 + P2 — depends on Track A)

**Goal**: New `code` module with generate and explain modes; two new API routes; graph-aware generation.

1. Create `src/modules/code/types.ts`:
   - `CodeGenerationRequest`: `{ description: string; language: Language; providerId?: string }`
   - `CodeExplanationRequest`: `{ code: string; language?: string }`
   - `CodeResult`: `{ code: string; language: string }`
   - `Language` enum: `'typescript' | 'javascript' | 'python' | 'go' | 'rust'`
2. Create `src/modules/code/code-service.ts`:
   - `generateCode(req: CodeGenerationRequest): Promise<CodeResult>`:
     - Call `queryCodeEntities('', req.description, 20)` — inject up to 20 entity nodes as a "## Relevant Codebase Symbols" block in the system prompt.
     - Build system prompt: "You are a code generation assistant. Output ONLY the requested code block in {language}. No prose, no explanation. Use existing codebase symbols where appropriate." + optional graph context.
     - Resolve provider: use `req.providerId` if provided; else query `providerConfigs` for the first available (isAvailable=true) provider; throw a 503-mapped error if none found.
     - Call `streamText()` (existing pattern from `llm-client.ts`) — await full text, return `{ code: text, language }`.
   - `explainCode(req: CodeExplanationRequest): Promise<{ explanation: string }>`:
     - System prompt: "You are a code explanation assistant. Describe what this code does in plain English. Cover: purpose, inputs, outputs, side effects. Do NOT re-state the code line-by-line."
     - Use first available provider (same fallback logic). Return explanation text.
3. Create `src/modules/code/index.ts` — re-export `generateCode`, `explainCode`.
4. Create `src/app/api/code/generate/route.ts` — POST handler: Zod schema validates `description` (non-empty, max 2,000), `language` (enum), `providerId` (optional string). Call `generateCode()`. Map 503 error to 503 response. Standard 400 on Zod failure.
5. Create `src/app/api/code/explain/route.ts` — POST handler: Zod schema validates `code` (non-empty, max 10,000), `language` (optional string). Call `explainCode()`. Standard 400 on Zod failure.
6. Tests: `__tests__/modules/code/code-service.test.ts` — generate happy path (mocked LLM + mocked graph), explain happy path, empty graph degradation (graph call returns []), no-provider 503 error, validation errors. Integration: `__tests__/integration/code-api.test.ts` — 200/400/503 for both routes.

**Key files**: `src/modules/code/`, `src/app/api/code/generate/route.ts`, `src/app/api/code/explain/route.ts`

---

### Track D — Code Assistant UI (P1 + P2 — depends on Track C route being available)

**Goal**: New "Code Assistant" tab on the existing page; Generate and Explain mode toggle; syntax-highlighted output.

1. Create `src/components/CodeAssistant.tsx` — client component:
   - State: `mode: 'generate' | 'explain'`, `description`, `language`, `code` (input for explain), `output`, `loading`, `error`.
   - Generate mode: textarea for `description` (max 2,000 chars with counter), `<select>` for language (TS default), Generate button.
   - Explain mode: textarea for `code` (max 10,000 chars), Explain button.
   - Mode toggle: tab or button group switching between modes; clears output on switch.
   - Output area: render output using the existing markdown/rehype-highlight pipeline already present in `MessageList.tsx` (same component or same approach) — wrap output in a fenced code block before passing to the renderer so syntax highlighting applies automatically.
   - Validation: disable submit when input is empty; show character count warning when > 80% of cap.
   - Error handling: display API error messages in a dismissible error banner.
2. In `src/app/page.tsx`, add a "Code Assistant" tab button alongside the existing GraphPanel toggle. Conditionally render `<CodeAssistant />` when the tab is active. Only one panel (Graph or Code) is visible at a time.
3. Tests: `__tests__/components/CodeAssistant.test.tsx` — snapshot for generate mode, snapshot for explain mode, toggle between modes resets output, empty-input submit is disabled.

**Key files**: `src/components/CodeAssistant.tsx`, `src/app/page.tsx`

---

### Track E — Benchmark (P3 — depends on Track B being merged)

**Goal**: Define the 10-question evaluation set; run both retrieval strategies; commit results.

1. Create `specs/003-ai-code-assistant-graph-rag/eval-set.md` — 10 questions drawn from a test PDF uploaded to the dev instance, each with an expected answer excerpt and the page it comes from. **This file MUST be committed before the benchmark script is written** (per clarification Q6).
2. Create `scripts/benchmark-rag.ts`:
   - Accept a path to the eval-set YAML/Markdown (or hardcode the 10 Q&A pairs).
   - For each question: (a) run `retrieveChunks(q, 5)` → format context → call LLM → score answer relevance; (b) run `retrieveAndRerank(q, 'benchmark')` → format context → call LLM → score answer relevance.
   - Relevance scoring: exact-match of key phrases from expected answer (simple but reproducible).
   - Output: Markdown table with per-question F02 vs F03 scores.
3. Run the script against the dev instance with a test document loaded. Commit results to `specs/003-ai-code-assistant-graph-rag/benchmark.md` including aggregate improvement % and pass/fail verdict for ≥10% improvement (F002.5 SC-008).

**Key files**: `specs/003-ai-code-assistant-graph-rag/eval-set.md`, `scripts/benchmark-rag.ts`, `specs/003-ai-code-assistant-graph-rag/benchmark.md`

---

### Track F — README (P3 — can run in parallel with E)

**Goal**: Add graph-enhanced RAG section + code assistant guide.

1. Add "Graph-Enhanced RAG Pipeline" section with Mermaid flowchart:
   ```
   F02: query → vec search top-5 → inject → LLM
   F03: query → vec search top-20 → writeChunkNodes → rerankWithGraph → top-5 → inject → LLM
   ```
2. Add "Code Assistant" usage guide: generate mode walkthrough (describe function → select language → generate), explain mode walkthrough (paste code → get explanation), note on provider fallback behaviour.
3. Update the feature status table row for F03 from "Planned" to "In Progress" (then "Complete" after merge).

**Key file**: `README.md`

---

## Delivery Order & Dependencies

```
Track A (config + graph service prereqs)
       │
       ├──→ Track B (graph-enhanced RAG)   ─→  Track E (benchmark, after B merged)
       │
       └──→ Track C (code assistant backend)
                  │
                  └──→ Track D (code assistant UI)

Track F (README)  ─→  in parallel with everything; finalised last
```

Tracks B and C can be developed in parallel after Track A is committed. Track D waits only for the Track C API routes to exist (can be stubbed locally). Track E requires a working instance with Track B live. Track F can be written concurrently and updated at the end.

---

## Complexity Tracking

*No Constitution violations requiring justification.*
