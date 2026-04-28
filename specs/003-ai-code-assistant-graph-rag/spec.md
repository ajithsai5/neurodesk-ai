# Feature Specification: AI Code Assistant + Graph-Enhanced RAG Pipeline

**Feature Branch**: `003-ai-code-assistant-graph-rag`
**Created**: 2026-04-27
**Status**: Draft
**Feature ID**: 003
**Depends On**: 002.5 (Platform Hardening — Coverage, CI, Security, Graphify & README)
**Priority**: High

---

## Clarifications

### Session 2026-04-27

- Q: `writeChunkNodes()` already exists with signature `(sessionId, chunks: { id: string; text: string }[])` but the spec requires richer metadata (`documentId`, `pageNumber`, `similarityScore`, `retrievedAt`) and `RetrievedChunk.chunkId` is a `number`, not a `string`. Extend or overload? → A: **Extend the existing signature** — update it to accept a richer chunk shape that includes the new optional fields; no duplicate function. The `chunkId` field is serialised to string in the properties JSON blob (existing pattern), keeping the graph node schema unchanged.
- Q: `rerankWithGraph()` scores by edge-weight sum, not raw edge count. Change it or use as-is? → A: **Use the existing weight-sum approach as-is** — already implemented, already tested, and weight-sum is strictly more expressive (when all weights are 1.0 it equals edge count). Changing the scoring function would break existing tests with no functional gain.
- Q: Where should the code assistant panel live in the UI? → A: **New tab alongside the graph panel on the existing single page** — mirrors the existing GraphPanel toggle pattern, avoids a new route/layout, keeps the app single-page. The tab label is "Code Assistant".
- Q: How should `/api/code/generate` pick its LLM provider with no `conversationId`? → A: **Accept an optional `providerId` in the request body; fall back to the first available (non-archived) provider** — works for Ollama-only deployments and does not hardcode Anthropic. If no provider is available the endpoint returns 503.
- Q: Where should the slice-to-5 happen after widening to top-20 and reranking? → A: **Inside a new `retrieveAndRerank()` wrapper in `retrieval-service.ts`** — the wrapper calls `retrieveChunks(query, RAG_CANDIDATE_POOL_SIZE)` → `writeChunkNodes()` → `rerankWithGraph()` → slices to `RAG_FINAL_CONTEXT_SIZE` (5). All callers replace `retrieveChunks()` with `retrieveAndRerank()`; the wider-pool detail is invisible to callers.
- Q: Was the 10-question benchmark evaluation set committed in F002.5? → A: **No — it must be created as the first benchmark task in F003.** The first task of the benchmark work item is to define and commit a `specs/003-ai-code-assistant-graph-rag/eval-set.md` file with 10 questions and expected answers before the benchmark script is written.
- Q: `queryCodeEntities()` is capped at `.limit(10)`; spec says up to 20 for code generation. Raise globally or pass a separate limit? → A: **Pass a separate limit parameter** — add an optional third argument `limit = 10` to `queryCodeEntities()`; code generation calls it with `limit = 20`. The global default stays 10 so chat enrichment is unaffected.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Generate Code from a Plain-English Description (Priority: P1)

A developer opens the code assistant panel, types a description like "a function that debounces a callback by N milliseconds in TypeScript", selects a target language, and receives a syntax-highlighted, runnable code block within seconds.

**Why this priority**: This is the core value proposition of the code assistant — translating intent into code. Without it, the panel has no utility.

**Independent Test**: Open the code assistant panel, enter "a function that reverses a string", select TypeScript, and verify a valid TypeScript function is returned with syntax highlighting.

**Acceptance Scenarios**:

1. **Given** the code assistant panel is open, **When** the user enters a function description and selects a language, **Then** the system returns a syntactically valid code block in the selected language within 10 seconds.
2. **Given** the user selects Python as the target language, **When** they submit a description, **Then** the generated code uses Python syntax and idioms, not TypeScript.
3. **Given** the generated code is displayed, **When** the user views it, **Then** syntax highlighting is applied appropriate to the selected language.
4. **Given** an empty description is submitted, **When** the user clicks Generate, **Then** the UI shows a validation error rather than sending an API request.

---

### User Story 2 — Graph-Enhanced RAG Returns Better-Grounded Answers (Priority: P1)

A user asks a question about an uploaded document. Instead of taking the top-5 chunks by raw vector similarity, the system widens the candidate pool to 20, scores each chunk by its connectivity in the knowledge graph (hub chunks with more edges are promoted), then injects the top-5 reranked chunks into the LLM prompt. The answer is more grounded and the citation shows a graph connectivity score.

**Why this priority**: This is the primary RAG improvement promised by this feature. It directly improves answer quality for all document Q&A users.

**Independent Test**: Upload a multi-section PDF, ask a question whose best answer sits in a hub chunk (one referenced by many other chunks), and verify the reranked answer cites that chunk while the pure-vector top-5 did not include it.

**Acceptance Scenarios**:

1. **Given** a document has been uploaded and indexed, **When** the user asks a question, **Then** the RAG pipeline retrieves 20 candidate chunks via vector similarity (up from 5).
2. **Given** 20 candidates are retrieved, **When** rerankWithGraph() runs, **Then** chunks with higher graph edge counts are promoted to higher rank positions before the final top-5 are selected.
3. **Given** graph reranking completes, **When** the answer is returned, **Then** citations include a graph connectivity score alongside the page number (e.g., `[Doc Name, Page 3, Graph Score: 7]`).
4. **Given** the graph store is empty (first run or no prior retrievals), **When** a RAG query runs, **Then** the system falls back to standard top-5 vector ranking with no error.

---

### User Story 3 — Explain Existing Code in Plain English (Priority: P2)

A developer pastes a function or code block into the explain-code panel and receives a concise plain-English explanation of what it does, what its inputs and outputs are, and any notable side effects or edge cases.

**Why this priority**: Explain-code completes the code assistant's read–write loop. It helps developers onboard unfamiliar code without leaving the tool.

**Independent Test**: Paste a non-trivial utility function (e.g., a debounce implementation) into the explain panel and verify the explanation correctly identifies its purpose, parameters, and return value.

**Acceptance Scenarios**:

1. **Given** the explain-code mode is active, **When** the user pastes a code block and submits, **Then** the system returns a plain-English explanation within 15 seconds.
2. **Given** the explanation is returned, **When** the user reads it, **Then** it describes the function's purpose, inputs, outputs, and any notable side effects — without re-stating the code line-by-line.
3. **Given** an empty code input is submitted, **When** the user clicks Explain, **Then** the UI shows a validation error.
4. **Given** the user pastes code with syntax errors, **When** the explanation is returned, **Then** the system acknowledges the syntax issue while still attempting to explain the visible intent.

---

### User Story 4 — Graph-Aware Code Generation Uses Existing Codebase Context (Priority: P2)

A developer generates code and the assistant is aware of functions, classes, and imports already in the codebase (extracted by Graphify in F002.5). The generated code reuses existing helpers rather than duplicating logic.

**Why this priority**: Graph-awareness transforms a generic code generator into a codebase-specific assistant. It prevents duplication and ensures the generated code follows existing conventions.

**Independent Test**: Generate a function whose purpose overlaps with an existing helper in `src/`. Verify the assistant references or reuses the existing function rather than reimplementing it.

**Acceptance Scenarios**:

1. **Given** the graph store contains code entity nodes for the current codebase, **When** the user submits a code generation request, **Then** the system queries queryCodeEntities() before generating and injects relevant node labels, file locations, and relationships into the prompt.
2. **Given** graph context is injected, **When** the generated code is returned, **Then** the output references or imports existing codebase helpers where appropriate.
3. **Given** queryCodeEntities() returns no results for the query, **When** code is generated, **Then** the system proceeds with standard generation and no error is surfaced.

---

### User Story 5 — Citations Show Graph Connectivity Score (Priority: P3)

A user reviewing a document Q&A answer can see not just the page number but also a graph connectivity score in each citation, giving them a signal about how central that chunk is in the knowledge graph.

**Why this priority**: The score builds user trust in the reranking mechanism and enables power users to audit retrieval quality.

**Independent Test**: Ask a question after uploading a multi-page PDF with multiple retrievals already logged to the graph. Verify citations include a non-zero graph score that differs between chunks.

**Acceptance Scenarios**:

1. **Given** graph reranking has run for the current query, **When** citations are displayed, **Then** each citation shows the format `[Document Name, Page N, Graph Score: X]`.
2. **Given** a chunk was promoted by reranking (high edge count), **When** its citation appears, **Then** its graph score is visibly higher than citations for chunks that were not promoted.
3. **Given** the graph store is empty (fallback mode), **When** citations are displayed, **Then** the graph score is omitted entirely and citations fall back to the F002 format `[Document Name, Page N]`.

---

### User Story 6 — Benchmark Confirms Reranking Quality Improvement (Priority: P3)

A developer or tech lead runs the benchmark suite and sees a side-by-side comparison of F02 pure-vector retrieval vs F03 graph-reranked retrieval on 10 test questions, confirming the measurable improvement required by F002.5 SC-008.

**Why this priority**: Ensures the graph-reranking investment delivers real quality gains and satisfies the post-sprint metric committed in F002.5.

**Independent Test**: Run the benchmark script against a fixed 10-question set and verify the output shows F03 graph-reranked answers score higher on relevance than F02 pure-vector answers.

**Acceptance Scenarios**:

1. **Given** the benchmark script is run, **When** it completes, **Then** a Markdown report is produced at `specs/003-ai-code-assistant-graph-rag/benchmark.md` with per-question scores for both retrieval strategies.
2. **Given** the report is produced, **When** the aggregate scores are reviewed, **Then** F03 graph-reranked retrieval shows at least 10% better answer relevance than F02 pure-vector retrieval across the 10-question set (satisfying F002.5 SC-008).

---

### Edge Cases

- What happens when the Claude API is unavailable during code generation? — The system returns a user-facing error ("Code generation temporarily unavailable") without crashing; the panel retains the user's description so they can retry.
- What happens when writeChunkNodes() fails during a RAG retrieval? — Silent degradation: the RAG response is returned normally; the graph write failure is logged server-side and does not surface to the user.
- What happens when rerankWithGraph() is called but all 20 chunks have the same graph edge count (zero)? — The function returns the original vector-similarity order unchanged; no error is raised.
- What happens when the user switches language mid-session in the code assistant? — The language selector value is always read at submit time; switching before submitting generates code in the new language.
- What happens when the user pastes a 10,000-character code block into explain-code mode? — Input is validated client-side against the existing 10,000-character message cap; oversized input is rejected with a validation error before the API call.
- What happens when queryCodeEntities() returns a very large result set (hundreds of nodes)? — The top-N entities by relevance score are selected (cap: 20 nodes) before injection into the prompt to prevent context overflow.
- What happens when graph edge counts change between writeChunkNodes() and rerankWithGraph() in the same request? — Both operations use a snapshot of the graph at retrieval time; no locking is needed because re-ranking happens synchronously after the write within the same request.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Code Assistant — Generate Mode

- **FR-001**: The system MUST provide a code assistant UI panel with: a function description text input, a language selector (TypeScript, JavaScript, Python, Go, Rust), and a syntax-highlighted code output area.
- **FR-002**: The system MUST expose a `POST /api/code/generate` endpoint accepting `{ description: string, language: string, providerId?: string }` and returning `{ code: string, language: string }`. When `providerId` is omitted, the endpoint MUST use the first available (non-archived) provider config. When no provider is available, the endpoint MUST return 503.
- **FR-003**: The `/api/code/generate` endpoint MUST use the Anthropic Claude API with a system prompt tuned for code output. The response MUST contain only the requested code block; no surrounding prose unless the description explicitly requests an explanation.
- **FR-004**: The description field MUST be validated to be non-empty and at most 2,000 characters; the language field MUST be one of the allowed values (`typescript`, `javascript`, `python`, `go`, `rust`). Requests failing validation MUST receive a 400 response.
- **FR-005**: The code assistant panel MUST support a toggle or tab to switch between Generate mode and Explain mode without navigating away.

#### Code Assistant — Explain Mode

- **FR-006**: The system MUST expose a `POST /api/code/explain` endpoint accepting `{ code: string, language?: string }` and returning `{ explanation: string }`.
- **FR-007**: The explanation MUST describe the function's purpose, inputs, outputs, and notable side effects in plain English. The system prompt MUST instruct the model not to re-state the code line-by-line.
- **FR-008**: The `code` field MUST be validated to be non-empty and at most 10,000 characters (consistent with the existing message cap). Requests failing validation MUST receive a 400 response.

#### Graph-Aware Code Generation

- **FR-009**: Before invoking the LLM for code generation, the service MUST call `queryCodeEntities('', description, 20)` (the third `limit` argument added in this feature) to retrieve up to 20 relevant code entity nodes from the knowledge graph.
- **FR-010**: When `queryCodeEntities()` returns a non-empty result, the returned entities MUST be serialised as a compact context block (name, kind, filePath, lineStart) and injected into the LLM system prompt.
- **FR-011**: When `queryCodeEntities()` returns an empty result or throws, code generation MUST proceed without graph context. The failure MUST be logged but MUST NOT surface an error to the user.

#### Graph-Enhanced RAG — Wider Candidate Pool

- **FR-012**: A new `retrieveAndRerank(query: string, sessionId: string): Promise<RetrievedChunk[]>` function MUST be added to `src/modules/rag/retrieval-service.ts`. It MUST: (1) call `retrieveChunks(query, config.ragCandidatePoolSize)` to get 20 candidates, (2) call `writeChunkNodes()`, (3) call `rerankWithGraph()`, (4) return the top `config.ragFinalContextSize` (5) chunks. All call sites that currently call `retrieveChunks()` for RAG context injection MUST be updated to call `retrieveAndRerank()` instead.
- **FR-013**: Two new config values MUST be added to `src/lib/config.ts`: `ragCandidatePoolSize: 20` (candidates retrieved from vector index) and `ragFinalContextSize: 5` (chunks injected into LLM prompt).

#### Graph-Enhanced RAG — writeChunkNodes()

- **FR-014**: The existing `writeChunkNodes(sessionId, chunks)` in `src/modules/graph/graph-service.ts` MUST have its chunk element type extended to accept richer metadata: `{ id: string; text: string; documentId?: string; pageNumber?: number; similarityScore?: number; retrievedAt?: number }`. The function MUST store `documentId`, `pageNumber`, `similarityScore`, and `retrievedAt` in the node's `properties` JSON blob when provided. The existing call sites that pass only `{ id, text }` MUST continue to work unchanged (all new fields are optional).
- **FR-015**: `writeChunkNodes()` is called by `retrieveAndRerank()` (FR-012) after the top-20 candidates are retrieved and before reranking. If the write fails, `retrieveAndRerank()` MUST continue to reranking normally (silent degradation, server-side log only — consistent with existing graph write behaviour).

#### Graph-Enhanced RAG — rerankWithGraph()

- **FR-016**: The existing `rerankWithGraph(_sessionId, candidates)` in `src/modules/graph/graph-service.ts` MUST be used as-is for reranking. It already scores by edge-weight sum (equivalent to edge count when weights are 1.0) and already degrades gracefully when the graph is empty. No changes to the function's logic are required.
- **FR-017**: `queryCodeEntities()` in `src/modules/graph/graph-service.ts` MUST be updated to accept an optional third parameter `limit = 10` (preserving the current default). Code generation calls it with `limit = 20`; chat enrichment continues to use the default of 10.
- **FR-018**: The top-5 slice happens inside `retrieveAndRerank()` (FR-012) after `rerankWithGraph()` returns the reranked list. The slice count is `config.ragFinalContextSize` (5).
- **FR-019**: When `rerankWithGraph()` returns an error or the graph is empty, `retrieveAndRerank()` MUST fall back to returning the first `config.ragFinalContextSize` (5) chunks from the original vector-similarity order (graceful degradation to F002 behaviour).

#### Source Citations — Graph Connectivity Score

- **FR-020**: The citation format MUST be updated to include the graph connectivity score when graph reranking was active: `[Document Name, Page N, Graph Score: X]` where X is the integer edge count.
- **FR-021**: When the graph store was empty and fallback mode was used, citations MUST use the F002 format `[Document Name, Page N]` with no graph score field. The two formats MUST be distinguishable in the response schema.

#### Benchmark

- **FR-022**: Before the benchmark script is written, a fixed evaluation set MUST be committed as `specs/003-ai-code-assistant-graph-rag/eval-set.md` containing 10 questions with expected answers drawn from an uploaded test document. This is the baseline that was never formalised in F002.5. The benchmark script MUST NOT be written until this file exists.
- **FR-023**: A benchmark script MUST be implemented (at `scripts/benchmark-rag.ts` or equivalent) that runs the 10 questions from `eval-set.md` against both F02 pure-vector retrieval (limit=5, no reranking) and F03 graph-reranked retrieval (limit=20 → rerank → top-5) and records per-question answer relevance scores.
- **FR-024-bench**: The benchmark results MUST be committed as `specs/003-ai-code-assistant-graph-rag/benchmark.md` containing: the 10 questions, per-question scores for both strategies, an aggregate improvement percentage, and a pass/fail verdict against the ≥ 10% improvement target (F002.5 SC-008).

#### README

- **FR-025**: The README MUST be updated with a "Graph-Enhanced RAG Pipeline" section that includes a before/after flow diagram (text-based ASCII or Mermaid) showing: F02 (vector search → top-5) vs F03 (vector search → top-20 → writeChunkNodes → rerankWithGraph → top-5).
- **FR-026**: The README MUST include a "Code Assistant" usage guide covering both generate mode (with language selector and provider fallback behaviour) and explain mode.

### Key Entities

- **CodeGenerationRequest**: The input to the generate endpoint. Attributes: `description` (string, max 2,000 chars), `language` (enum), `providerId` (optional string — falls back to first available provider).
- **CodeExplanation**: The output of the explain endpoint. Attributes: `explanation` (plain-English string), `language` (detected or provided).
- **CandidateChunk**: A RAG retrieval candidate before reranking. Attributes: `chunkId`, `documentId`, `pageNumber`, `text`, `similarityScore`.
- **RankedChunk**: A reranked RAG candidate. Extends `CandidateChunk` with: `graphEdgeCount` (integer, 0 when no graph node exists), `finalRank` (integer 1–20).
- **GraphScoredCitation**: Updated citation model. Attributes: `documentName`, `pageNumber`, `graphScore` (integer, present only when reranking was active).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Code generation returns a syntactically valid code block in the selected language within 10 seconds for descriptions under 500 characters, measured end-to-end from UI submit to rendered output.
- **SC-002**: Explain-code mode returns a plain-English explanation within 15 seconds for code inputs under 2,000 characters.
- **SC-003**: Graph-reranked RAG answers score at least 10% higher in relevance than pure-vector F02 answers on the fixed 10-question benchmark set (satisfying F002.5 SC-008).
- **SC-004**: `writeChunkNodes()` adds all 20 candidate chunks to the graph store within 200ms of retrieval without blocking the RAG response to the user.
- **SC-005**: `rerankWithGraph()` completes reranking of 20 chunks in under 100ms.
- **SC-006**: Citations with graph scores appear on at least 95% of document-grounded answers after the first retrieval has populated the graph (i.e., second query onwards).
- **SC-007**: Graph-aware code generation injects codebase context (when available) on 100% of generation requests where `queryCodeEntities()` returns at least one result.
- **SC-008**: All new API endpoints (`/api/code/generate`, `/api/code/explain`) achieve ≥ 95% test coverage (line, branch, function) consistent with the F002.5 coverage floor.

---

## Assumptions

- `queryCodeEntities(sessionId, query)` is implemented and returns an empty array (not an error) when no matching entities exist — per F002.5 FR-019b.
- The Graphify knowledge graph is initialised and operational from F002.5; `writeChunkNodes()` can append to it without schema changes.
- The Claude Anthropic API is already configured as a provider in the application; no new provider wiring is needed for code generation — it reuses the existing `getLLMModel("anthropic")` path.
- Syntax highlighting in the code assistant UI uses a client-side library already present in the project (e.g., highlight.js or equivalent bundled with a markdown renderer); no additional npm dependency is required if one already exists.
- The 10-question benchmark evaluation set is the fixed set baselined before F002.5 was completed (F002.5 SC-008); if it was not formalised, the first task of F003 must define and commit it before benchmark work begins.
- `writeChunkNodes()` writes are fire-and-forget asynchronously; they do not block the RAG response returned to the user.
- The `top_k` parameter for vector search is currently hardcoded to 5 in the retrieval layer; widening to 20 is the only retrieval-layer change required.
- `rerankWithGraph()` uses the full global graph (all nodes and edges), not a per-session subgraph. This is acceptable for v1 since the graph is a single-user local tool with no cross-user isolation concern.
- Code generation and explain-code are stateless — they do not require a `conversationId` and do not persist generated code to the database in v1.
- Maximum graph context injected into code generation prompts is capped at 20 nodes to prevent exceeding the model's effective context window for prompt + generated code.
