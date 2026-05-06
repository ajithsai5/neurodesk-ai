# Tasks: Multi-Document RAG System

**Input**: Design documents from `specs/004-multi-document-rag-system/`
**Branch**: `004-multi-document-rag-system`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Constitution Principle II — TDD is NON-NEGOTIABLE**: Test tasks marked ⚠️ MUST be written and confirmed FAILING before the corresponding implementation tasks are started.

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Can run in parallel (different files, no shared state dependency)
- **[Story]**: User story this task belongs to (US1–US7 from spec.md)

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Confirm existing tests pass before any changes are made.

- [ ] T001 Run `npm test` and confirm all existing tests are green — baseline checkpoint
- [ ] T002 Run `npx drizzle-kit push` dry-run to confirm schema push path works — `data/neurodesk.db`

---

## Phase 2: Foundational — Config + Schema

**Purpose**: Config constants and schema migrations that EVERY subsequent phase depends on. Nothing else can start until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until T010 (schema push) is complete.

### Tests (write first — must FAIL before T006–T010)

- [ ] T003 [P] Write failing test: `config` exports `ragCandidatePoolPerDoc = 20` — `__tests__/modules/shared/config.test.ts`
- [ ] T004 [P] Write failing test: `config` exports `ragCandidatePoolMax = 100` — `__tests__/modules/shared/config.test.ts`
- [ ] T005 [P] Write failing test: `config` exports `docLibraryMaxCount = 50` and `docLibraryMaxBytes = 524_288_000` — `__tests__/modules/shared/config.test.ts`

### Implementation

- [ ] T006 Add `ragCandidatePoolPerDoc: 20`, `ragCandidatePoolMax: 100`, `docLibraryMaxCount: 50`, `docLibraryMaxBytes: 524_288_000` to `src/lib/config.ts` (keep deprecated `ragCandidatePoolSize: 20` alias)
- [ ] T007 [P] Add `userId TEXT NOT NULL DEFAULT 'default'` and `badgeColour TEXT NOT NULL DEFAULT ''` columns to `documents` table in `src/modules/shared/db/schema.ts`; add `idx_doc_user` index
- [ ] T008 [P] Add `userId TEXT NOT NULL DEFAULT 'default'` column to `document_chunks` table in `src/modules/shared/db/schema.ts`; add `idx_chunk_user` index
- [ ] T009 [P] Add `properties TEXT NOT NULL DEFAULT '{}'` column to `graph_edges` table in `src/modules/shared/db/schema.ts`
- [ ] T010 Run `npx drizzle-kit push` to apply all schema changes to `data/neurodesk.db`
- [ ] T011 Run `npm test` — confirm T003–T005 now pass and no regressions

**✅ Checkpoint**: Config constants live in `config.ts`; schema has `userId`, `badgeColour`, `graph_edges.properties`. All prior tests green.

---

## Phase 3: User Story 2 — Document Library Management (Priority: P1) 🎯 MVP

**Goal**: User can upload multiple files, see per-document status (with live progress), delete documents, and have everything survive a restart.

**Independent Test**: Upload a PDF → watch status change to "Indexed" without page refresh → restart server → doc still appears as "Indexed" → delete it → disappears immediately.

### Tests (write first — must FAIL before T018–T030) ⚠️

- [ ] T012 [P] [US2] Write failing tests for `BADGE_PALETTE` and `assignBadgeColour()` — `__tests__/modules/rag/document-service.test.ts`
- [ ] T013 [P] [US2] Write failing tests for `getLibraryUsage()` returns `{ count, totalBytes, maxCount, maxBytes }` — `__tests__/modules/rag/document-service.test.ts`
- [ ] T014 [P] [US2] Write failing tests for `createDocument()` — rejects when count ≥ 50, rejects when bytes would exceed 500 MB, assigns `badgeColour`, scopes to `userId = "default"` — `__tests__/modules/rag/document-service.test.ts`
- [ ] T015 [P] [US2] Write failing tests for `resetStuckDocuments()` — transitions all `pending` → `failed` with correct message — `__tests__/modules/rag/document-service.test.ts`
- [ ] T016 [P] [US2] Write failing tests for `listDocuments()` — only returns rows with `userId = "default"` — `__tests__/modules/rag/document-service.test.ts`

### Implementation — Document Service

- [ ] T017 [US2] Add `BADGE_PALETTE` constant (8 hex colours) and `assignBadgeColour(existingCount: number): string` to `src/modules/rag/document-service.ts`
- [ ] T018 [US2] Add `getLibraryUsage(userId: string): Promise<LibraryUsage>` (COUNT + SUM query) to `src/modules/rag/document-service.ts`
- [ ] T019 [US2] Update `createDocument()` — add `userId = "default"` param; call `getLibraryUsage` and throw typed error for count/storage limit; call `assignBadgeColour`; persist both to DB — `src/modules/rag/document-service.ts`
- [ ] T020 [US2] Update `listDocuments()`, `getDocument()`, `deleteDocument()` — add `userId = "default"` WHERE clause to all queries — `src/modules/rag/document-service.ts`
- [ ] T021 [US2] Add `resetStuckDocuments(userId: string): void` — sets `status = 'failed'`, `error_message = 'Interrupted by restart — please re-upload'` where `status = 'pending'` — `src/modules/rag/document-service.ts`

### Implementation — Documents API Route

- [ ] T022 [US2] Add `resetStuckDocuments("default")` call at module-level init (before first request handler) — `src/app/api/documents/route.ts`
- [ ] T023 [US2] Update `GET /api/documents` — append `usage: { count, totalBytes, maxCount, maxBytes }` to response JSON — `src/app/api/documents/route.ts`
- [ ] T024 [US2] Update `POST /api/documents` — call `getLibraryUsage` before `createDocument`; return `400` with `code: "LIBRARY_COUNT_LIMIT"` or `"LIBRARY_STORAGE_LIMIT"` when exceeded — `src/app/api/documents/route.ts`

### Implementation — Document Library UI

- [ ] T025 [P] [US2] Add `LibraryUsageBar` sub-component (reads `usage` from GET response) to `src/components/DocumentLibrary.tsx` — shows `{count} / 50 documents · {mb} MB / 500 MB`
- [ ] T026 [P] [US2] Add polling logic to `DocumentLibrary.tsx` — re-fetch every 3s when any doc is `pending`; stop when all `ready` or `failed`; show spinner on `pending` rows — `src/components/DocumentLibrary.tsx`
- [ ] T027 [P] [US2] Add colour badge dot per document row using `badgeColour` field — `src/components/DocumentLibrary.tsx`
- [ ] T028 [US2] Verify `<input type="file" multiple>` is set in `src/components/DocumentUpload.tsx`; add `multiple` attribute if missing
- [ ] T029 [US2] Add completion toast/notification when a polled document transitions from `pending` → `ready` — `src/components/DocumentLibrary.tsx`
- [ ] T030 [US2] Run `npm test` — confirm T012–T016 pass and no regressions

**✅ Checkpoint**: Document library shows live progress, usage bar, colour badges, restarts cleanly.

---

## Phase 4: User Story 1 — Cross-Document Queries (Priority: P1) 🎯 MVP

**Goal**: User asks a question and the system retrieves the top-N chunks from across all uploaded documents and returns a grounded multi-source answer.

**Independent Test**: Upload two PDFs on related topics → ask a synthesis question → verify answer cites passages from both documents with correct doc names.

### Tests (write first — must FAIL before T036–T043) ⚠️

- [ ] T031 [P] [US1] Write failing tests for `computePoolSize(N)` — N=1→20, N=5→100, N=8→100 — `__tests__/modules/rag/retrieval-service.test.ts`
- [ ] T032 [P] [US1] Write failing tests for `retrieveChunks` with `documentIds` filter — chunks from excluded docs never appear — `__tests__/modules/rag/retrieval-service.test.ts`
- [ ] T033 [P] [US1] Write failing tests for `RetrievedChunk` includes `documentId` and `similarityScore = 1 - distance` — `__tests__/modules/rag/retrieval-service.test.ts`
- [ ] T034 [P] [US1] Write failing integration test: upload 2 docs → `retrieveAndRerank` returns chunks from both — `__tests__/integration/multi-doc-rag.test.ts`

### Implementation — Retrieval Service

- [ ] T035 [US1] Update `RetrievedChunk` interface — add `documentId: number` and `similarityScore: number` fields — `src/modules/rag/retrieval-service.ts`
- [ ] T036 [US1] Add `computePoolSize(docCount: number): number` — `Math.min(config.ragCandidatePoolPerDoc * docCount, config.ragCandidatePoolMax)` — `src/modules/rag/retrieval-service.ts`
- [ ] T037 [US1] Update `retrieveChunks()` — add `documentIds?: number[]` param; append `AND c.document_id IN (...)` to SQL when present; compute and return `similarityScore = 1 - distance` — `src/modules/rag/retrieval-service.ts`
- [ ] T038 [US1] Add `countReadyDocuments(userId: string): Promise<number>` helper (used by `retrieveAndRerank` to compute pool size when no filter active) — `src/modules/rag/retrieval-service.ts`
- [ ] T039 [US1] Update `retrieveAndRerank()` — accept `documentIds?: number[]`; call `computePoolSize` with doc count; pass `documentIds` to `retrieveChunks` — `src/modules/rag/retrieval-service.ts`
- [ ] T040 [US1] Update `ingestDocument()` — pass `documentTitle: doc.originalName` to `writeChunkNodes` call — `src/modules/rag/ingestion-pipeline.ts`
- [ ] T041 [US1] Run `npm test` — confirm T031–T034 pass and no regressions

**✅ Checkpoint**: Multi-document retrieval works. Asking a question searches across all indexed documents. Pool scales with document count.

---

## Phase 5: User Story 4 — Cross-Document Graph Edges (Priority: P2)

**Goal**: Graph promotes chunks from different documents that share key concepts, improving answer quality beyond pure vector similarity.

**Independent Test**: Upload two docs sharing a named concept → ask about it → verify the reranked answer cites both documents; ask a second time → verify graph score appears in citations.

### Tests (write first — must FAIL before T047–T051) ⚠️

- [ ] T042 [P] [US4] Write failing tests for `writeChunkNodes` with `documentTitle` — stored in node properties JSON — `__tests__/modules/graph/graph-service.test.ts`
- [ ] T043 [P] [US4] Write failing tests for `createCrossDocumentEdges` — creates `SIMILAR_TO` edge between chunks from different docs sharing ≥ 3 non-stopword tokens — `__tests__/modules/graph/graph-service.test.ts`
- [ ] T044 [P] [US4] Write failing tests for `createCrossDocumentEdges` — does NOT create edges between chunks from the same document — `__tests__/modules/graph/graph-service.test.ts`
- [ ] T045 [P] [US4] Write failing tests for `createCrossDocumentEdges` — thrown errors are caught and logged, never propagated — `__tests__/modules/graph/graph-service.test.ts`

### Implementation — Graph Service

- [ ] T046 [US4] Update `writeChunkNodes()` — add optional `documentTitle?: string` to chunk input type; persist to node properties JSON — `src/modules/graph/graph-service.ts`
- [ ] T047 [US4] Add `STOPWORDS: Set<string>` constant (50-word English stop-word set) to `src/modules/graph/graph-service.ts`
- [ ] T048 [US4] Add `extractSignificantTokens(text: string): Set<string>` helper — lowercase split on `\W+`, filter length ≤ 2 and stop-words — `src/modules/graph/graph-service.ts`
- [ ] T049 [US4] Implement `createCrossDocumentEdges(sessionId: string, chunks: Array<{ id: string; text: string; documentId: number }>): Promise<void>` — for each cross-doc pair with |intersection| ≥ 3: insert `SIMILAR_TO` edge with `properties = { isCrossDocument: true, sharedTokenCount: N }`; wrapped in try/catch (fire-and-forget) — `src/modules/graph/graph-service.ts`
- [ ] T050 [US4] Update `retrieveAndRerank()` — call `void createCrossDocumentEdges(...)` after `writeChunkNodes`, passing chunks with `documentId` — `src/modules/rag/retrieval-service.ts`
- [ ] T051 [US4] Run `npm test` — confirm T042–T045 pass and no regressions

**✅ Checkpoint**: Cross-document graph edges created asynchronously. Reranker promotes shared-concept chunks from different documents.

---

## Phase 6: User Story 3 — Document Filter (Priority: P2)

**Goal**: User can scope a question to a subset of documents; excluded documents never enter the candidate pool.

**Independent Test**: Upload 3 docs on different topics → select only 1 in the filter → ask a question about all 3 → verify citations only reference the selected document.

### Tests (write first — must FAIL before T057–T062) ⚠️

- [ ] T052 [P] [US3] Write failing integration test: `POST /api/chat` with `documentIds: ["1"]` calls `retrieveAndRerank` with `[1]`; chunks from doc 2 and 3 absent — `__tests__/integration/chat-api.test.ts`
- [ ] T053 [P] [US3] Write failing test: Zod schema rejects `documentIds` with non-numeric strings — `__tests__/integration/chat-api.test.ts`
- [ ] T054 [P] [US3] Write failing component test: selecting 2 of 3 docs in filter emits `selectedDocumentIds = [id1, id2]` — `__tests__/components/DocumentLibrary.test.tsx`
- [ ] T055 [P] [US3] Write failing component test: deselecting all docs reverts filter to "all documents" (empty array) — `__tests__/components/DocumentLibrary.test.tsx`

### Implementation — Chat API + Service

- [ ] T056 [US3] Add `documentIds: z.array(z.string().regex(/^\d+$/)).optional()` to chat request Zod schema — `src/app/api/chat/route.ts`
- [ ] T057 [US3] Parse `documentIds` to `number[]` and thread through to `handleChatMessage()` — `src/app/api/chat/route.ts`
- [ ] T058 [US3] Add `documentIds?: number[]` to `handleChatMessage` options; pass to `retrieveAndRerank` call — `src/modules/chat/chat-service.ts`

### Implementation — Filter UI

- [ ] T059 [US3] Add document filter multi-select checkboxes to `src/components/DocumentLibrary.tsx` — shows each document with checkbox; "Filtering: N docs" indicator when < all selected; "All documents" when none explicitly selected
- [ ] T060 [US3] Expose `selectedDocumentIds: number[]` from `DocumentLibrary` to `ChatPanel` — via React context or prop drilling — `src/components/DocumentLibrary.tsx` and `src/components/chat/ChatPanel.tsx`
- [ ] T061 [US3] Update `ChatPanel` to include `documentIds` in the `useChat` body when filter is active — `src/components/chat/ChatPanel.tsx`
- [ ] T062 [US3] Run `npm test` — confirm T052–T055 pass and no regressions

**✅ Checkpoint**: Chat API filter hard-excludes non-selected docs. Filter UI state drives retrieval scope end-to-end.

---

## Phase 7: User Story 5 — Rich Citations (Priority: P2)

**Goal**: Every citation shows document title (colour-coded badge), page, similarity score (0–1), and graph connectivity score (when applicable).

**Independent Test**: Upload 2 docs → ask a question that retrieves from both → verify each citation shows `[DocTitle, Page N, Sim: X.XX, Graph: Y]` with matching badge colour; on first query (empty graph) verify format is `[DocTitle, Page N, Sim: X.XX]`.

### Tests (write first — must FAIL before T068–T073) ⚠️

- [ ] T063 [P] [US5] Write failing tests for updated `Citation` interface — has `documentId`, `documentTitle`, `badgeColour`, `similarityScore` fields — `__tests__/modules/rag/retrieval-service.test.ts`
- [ ] T064 [P] [US5] Write failing tests for `formatCitations()` — returns `badgeColour` from document record (non-empty); `similarityScore` = `1 - distance` rounded to 2dp — `__tests__/modules/rag/retrieval-service.test.ts`
- [ ] T065 [P] [US5] Write failing tests for `formatRagContext()` — format string `[Title, Page N, Sim: X.XX, Graph: Y]` when graphScore present; `[Title, Page N, Sim: X.XX]` when absent — `__tests__/modules/rag/retrieval-service.test.ts`
- [ ] T066 [P] [US5] Write failing component test: `CitationPanel` renders hex colour badge; renders similarity percentage; renders graph badge only when `graphScore` defined — `__tests__/components/CitationPanel.test.tsx`

### Implementation — Citation Types + Formatting

- [ ] T067 [US5] Update `Citation` interface — add `documentId: number`, rename `documentName` → `documentTitle`, add `badgeColour: string`, add `similarityScore: number` — `src/modules/rag/retrieval-service.ts`
- [ ] T068 [US5] Update `formatCitations()` — look up `badgeColour` from document record via DB query; round `similarityScore` to 2dp — `src/modules/rag/retrieval-service.ts`
- [ ] T069 [US5] Update `formatRagContext()` — new format string with Sim and Graph fields; omit Graph field when `graphScore` is undefined — `src/modules/rag/retrieval-service.ts`

### Implementation — Citation UI

- [ ] T070 [US5] Update `CitationPanel.tsx` — render colour-coded badge dot using `badgeColour` hex; render similarity as percentage pill (e.g. "87%"); render graph score badge only when `graphScore` is defined — `src/components/CitationPanel.tsx`
- [ ] T071 [US5] Run `npm test` — confirm T063–T066 pass and no regressions

**✅ Checkpoint**: Every cited chunk renders with doc-colour badge, page, sim score, and optional graph score. Two distinct citation formats (graph active vs fallback) render correctly.

---

## Phase 8: User Story 6 — Benchmark (Priority: P3)

**Goal**: Benchmark script proves cross-document retrieval scores ≥ 10% higher than single-doc best-match on 10 synthesis questions.

**⚠️ GATE**: `specs/004-multi-document-rag-system/eval-set.md` MUST be committed before T074 (script) is written.

**Independent Test**: Run `npx tsx scripts/benchmark-multi-doc-rag.ts --doc-a ... --doc-b ...` → `benchmark.md` produced with per-question scores and pass/fail verdict.

- [ ] T072 [US6] Define and commit 10 synthesis questions with expected answers drawn from a two-document test corpus — `specs/004-multi-document-rag-system/eval-set.md`
- [ ] T073 [US6] Implement `scripts/benchmark-multi-doc-rag.ts` — CLI flags `--doc-a` / `--doc-b`; runs each of 10 questions in Mode A (single-doc best) and Mode B (multi-doc + graph reranking); scores by keyword recall
- [ ] T074 [US6] Run benchmark and commit results — `specs/004-multi-document-rag-system/benchmark.md` (10 questions, per-question scores, aggregate %, pass/fail verdict vs ≥ 10% target)

**✅ Checkpoint**: Benchmark report committed. Cross-doc graph retrieval quality validated empirically.

---

## Phase 9: User Story 7 — README (Priority: P3)

**Goal**: README documents multi-document RAG with a cross-document graph diagram, library usage guide, and benchmark results.

**Independent Test**: A developer with no prior F004 context reads only the README and successfully uploads two documents, asks a cross-document question, and interprets the citations.

- [ ] T075 [P] [US7] Add "Multi-Document RAG" section with Mermaid cross-document graph diagram (Doc A + Doc B nodes linked via shared entity edge) to `README.md`
- [ ] T076 [P] [US7] Add document library and filter usage guide to `README.md` — covers upload, status badges, colour badges, filter activation
- [ ] T077 [US7] Add benchmark results table to `README.md` (link to `benchmark.md` for full data)

**✅ Checkpoint**: README fully documents F004 end-to-end.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T078 [P] Update `src/modules/rag/index.ts` — re-export all new public API surface: `getLibraryUsage`, `resetStuckDocuments`, `LibraryUsage`, updated `Citation`, `computePoolSize`
- [ ] T079 [P] Update `src/modules/graph/index.ts` — re-export `createCrossDocumentEdges`, `STOPWORDS`
- [ ] T080 Run full test suite `npm test` — confirm ≥ 95% coverage on all touched modules (SC-008)
- [ ] T081 Run `npm run lint` — confirm zero ESLint errors
- [ ] T082 Run `npm run build` — confirm production build succeeds with no TypeScript errors
- [ ] T083 Run `graphify update .` — refresh knowledge graph after all code changes

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup baseline)
    ↓
Phase 2 (Foundational — config + schema)  ← BLOCKS ALL
    ↓
Phase 3 (US2 Document Library — P1)  ←→  Phase 4 (US1 Cross-doc Queries — P1)  [parallel]
         ↓                                           ↓
Phase 5 (US4 Cross-doc Graph — P2)           Phase 6 (US3 Document Filter — P2)
         ↓                                           ↓
         └──────────────── Phase 7 (US5 Citations — P2) ────────────────┘
                                        ↓
                        Phase 8 (US6 Benchmark — P3)  ←→  Phase 9 (US7 README — P3)  [parallel after eval-set committed]
                                        ↓
                               Phase 10 (Polish)
```

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|---|---|---|
| US2 (P1) | Phase 2 complete | US1 |
| US1 (P1) | Phase 2 complete | US2 |
| US4 (P2) | US1 complete (needs `retrieveAndRerank` changes) | US3 |
| US3 (P2) | US1 complete (needs `documentIds` in retrieval) | US4 |
| US5 (P2) | US1 + US2 complete (needs `badgeColour` + `similarityScore`) | — |
| US6 (P3) | US5 complete + `eval-set.md` committed | US7 |
| US7 (P3) | US6 complete (benchmark.md needed for README) | — |

### Within Each Phase

- ⚠️ Test tasks MUST be written and confirmed FAILING before implementation tasks
- `[P]` tasks within a phase can run in parallel (different files)
- Non-`[P]` tasks within a phase run sequentially

---

## Parallel Execution Examples

### Phase 2 Parallel Window (after T005)
```
T006 config.ts update
T007 schema.ts — documents columns
T008 schema.ts — document_chunks column
T009 schema.ts — graph_edges column
```
All touch different sections of the schema file — assign sequentially to avoid conflicts, or split into separate commits.

### Phase 3 + 4 Parallel Window (after Phase 2 complete)
```
Developer A: T012–T030 (US2 Document Library)
Developer B: T031–T041 (US1 Cross-Document Retrieval)
```
Zero file conflicts — US2 touches `document-service.ts` + `documents/route.ts` + `DocumentLibrary.tsx`; US1 touches `retrieval-service.ts` + `ingestion-pipeline.ts`.

### Phase 5 + 6 Parallel Window (after Phases 3+4 complete)
```
Developer A: T042–T051 (US4 Graph Edges) — graph-service.ts
Developer B: T052–T062 (US3 Filter) — chat/route.ts + chat-service.ts + DocumentLibrary.tsx filter
```

### Phase 8 + 9 Parallel Window (after Phase 7 complete)
```
T075 README diagram
T076 README guide
T072 eval-set.md
```
All independent files.

---

## Implementation Strategy

### MVP Scope (User Stories 1 + 2 only — Phases 1–4)

1. ✅ Phase 1: Verify baseline
2. ✅ Phase 2: Config + schema
3. ✅ Phase 3: Document library management (US2) — upload, status, delete, restart-safe
4. ✅ Phase 4: Cross-document retrieval (US1) — query across all docs, multi-source citations
5. **STOP and VALIDATE**: Upload 2 docs → ask a synthesis question → verify citations from both

### Incremental Delivery

1. **MVP** (Phases 1–4): Multi-doc upload + cross-doc query → demo-able
2. **+Filter** (Phase 6): Scope questions to doc subsets → precision control
3. **+Graph edges** (Phase 5): Cross-doc shared-concept promotion → quality boost
4. **+Rich citations** (Phase 7): Full citation format with badges + scores → transparency
5. **+Benchmark** (Phase 8): Empirical quality validation → portfolio evidence
6. **+README** (Phase 9): Documentation → handoff-ready

---

## Notes

- `[P]` = different files, no dependency on incomplete task in same phase
- Every `[US?]` label maps to a user story in `specs/004-multi-document-rag-system/spec.md`
- **TDD gate**: test tasks must FAIL before implementation — never skip
- **Eval-set gate**: T073 (benchmark script) must not start before T072 (`eval-set.md`) is committed
- Run `npx drizzle-kit push` again if schema changes are made after T010
- Commit after each checkpoint to preserve a clean rollback point
