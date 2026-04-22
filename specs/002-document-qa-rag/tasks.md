# Tasks: Document Q&A (Mini RAG)

**Input**: Design documents from `specs/002-document-qa-rag/`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅  
**TDD**: Tests are written FIRST and must FAIL before implementation (Constitution Principle II — NON-NEGOTIABLE)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to (US1–US5)
- Exact file paths included in every task

---

## Phase 1: Setup

**Purpose**: Install new dependencies and prepare filesystem

- [x] T001 Install new npm dependencies: `npm install sqlite-vec pdf-parse` and `npm install --save-dev @types/pdf-parse`
- [x] T002 Create `data/documents/` directory and verify `data/` is in `.gitignore`

**Checkpoint**: Dependencies installed, file storage directory ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database extension, schema additions, and provider support — MUST complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Extend `src/modules/shared/db/schema.ts` — add `documents` table (id, original_name, stored_name, file_path, mime_type, file_size, page_count, status enum, content_hash UNIQUE, error_message, created_at) and `document_chunks` table (id, document_id FK cascade, page_number, chunk_index, content, token_count, created_at) per `data-model.md`
- [x] T004 Extend `src/modules/shared/db/index.ts` — import `sqlite-vec`, call `sqliteVec.load(sqlite)` after pragma setup, then `sqlite.exec(CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(chunk_id INTEGER PRIMARY KEY, embedding FLOAT[768]))` before the Drizzle instance is created
- [x] T005 Run `npx drizzle-kit push` to apply new tables to `data/neurodesk.db`; verify tables exist with `sqlite3 data/neurodesk.db ".tables"`
- [x] T006 [P] Implement `src/modules/rag/pdf-extractor.ts` — wrap `pdf-parse`, export `extractPages(buffer: Buffer): Promise<{ pageNumber: number; text: string }[]>`; return empty array for zero-text PDFs; throw on corrupt files
- [x] T007 [P] Implement chunker in `src/modules/rag/ingestion-pipeline.ts` (chunk logic only, no DB calls yet) — export `chunkText(pages: { pageNumber: number; text: string }[]): { content: string; pageNumber: number; chunkIndex: number; tokenCount: number }[]` using `js-tiktoken` cl100k_base encoder, 512-token chunks, 64-token overlap sliding window
- [x] T008 [P] Implement `src/modules/rag/embedding-client.ts` — export `generateEmbedding(text: string): Promise<number[]>` that POSTs to `http://localhost:11434/api/embed` with `{ model: 'nomic-embed-text', input: text }`; validates response is a 768-dim float array; throws `EmbeddingError` with message "Ollama unreachable at http://localhost:11434" when the request fails
- [x] T009 [P] Add `'ollama'` case to `getLLMModel()` in `src/modules/chat/llm-client.ts` — use `createOpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' })(modelId)`
- [x] T010 [P] Add Ollama provider seed entry in `src/modules/shared/db/seed.ts` — insert provider_config with `providerName: 'ollama'`, `modelId: 'llama3.1:8b'`, `displayName: 'Ollama (llama3.1:8b)'`; run `npm run db:seed` to apply

**Checkpoint**: DB schema migrated, sqlite-vec loaded, pdf-extractor + chunker + embedding-client scaffolded, Ollama provider registered

---

## Phase 3: User Story 1 — Upload PDF and Ask a Question (Priority: P1) 🎯 MVP

**Goal**: User uploads a PDF, the system ingests it, and answers questions with page-level citations

**Independent Test**: Upload a 5-page PDF, ask "What is the main topic?", verify response includes document content and a `[filename, Page N]` citation

### Tests for User Story 1 ⚠️ Write first — must FAIL before implementation

- [ ] T011 [P] [US1] Write failing unit tests for `pdf-extractor.ts` in `__tests__/modules/rag/pdf-extractor.test.ts` — test: (a) extracts text with correct page numbers, (b) returns empty array for zero-text PDF, (c) throws on corrupt buffer
- [ ] T012 [P] [US1] Write failing unit tests for chunker in `__tests__/modules/rag/chunker.test.ts` — test: (a) chunks are ≤ 512 tokens, (b) overlap is 64 tokens between adjacent chunks, (c) page number is preserved from source page, (d) short text produces one chunk
- [ ] T013 [P] [US1] Write failing unit tests for `embedding-client.ts` in `__tests__/modules/rag/embedding-client.test.ts` — mock `fetch`; test: (a) sends correct Ollama request shape, (b) returns 768-dim array, (c) throws `EmbeddingError` on fetch failure or non-200 response

### Implementation for User Story 1

- [ ] T014 [US1] Implement `src/modules/rag/document-service.ts` — export: `createDocument(file: Buffer, originalName: string, mimeType: string)` (compute SHA-256, check duplicate, write UUID file to `data/documents/`, insert DB row with `status: 'pending'`), `updateDocumentStatus(id, status, opts?)`, `listDocuments()`, `getDocument(id)`, `deleteDocument(id)` (vec cleanup → cascade → unlink file)
- [ ] T015 [US1] Complete `src/modules/rag/ingestion-pipeline.ts` — export `ingestDocument(documentId: number): Promise<void>` that orchestrates: load file → extractPages → chunkText → for each chunk: generateEmbedding → insert into `document_chunks` + `vec_document_chunks` (raw SQL for vec insert) → updateDocumentStatus('ready'); on any error: updateDocumentStatus('failed', error.message) and delete partial vec rows
- [ ] T016 [US1] Implement `src/modules/rag/retrieval-service.ts` — export `retrieveChunks(query: string, limit = 5): Promise<{ content: string; pageNumber: number; documentName: string; chunkId: number; distance: number }[]>` — generates query embedding, runs cosine similarity vec query with JOIN to document_chunks + documents (WHERE status = 'ready'), returns top-5 results
- [ ] T017 [US1] Create `src/modules/rag/index.ts` — export public API: `ingestDocument`, `retrieveChunks`, `listDocuments`, `getDocument`, `deleteDocument`; add module comment block per Constitution Principle VI
- [ ] T018 [P] [US1] Implement `src/app/api/documents/route.ts` — `POST`: validate MIME type allowlist (`application/pdf`, `text/plain`), file size ≤ 52,428,800 bytes, SHA-256 dedup (409 with `existingId`), write file via `document-service`, trigger `ingestDocument()` async (no await), return 202 with `{ id, status, originalName, createdAt }`; `GET`: call `listDocuments()`, return 200 with `{ documents }`; validate all inputs with Zod per contracts/
- [ ] T019 [US1] Implement `src/app/api/documents/[id]/route.ts` — `GET`: validate id is integer, call `getDocument(id)`, return 200 or 404; `DELETE`: validate id, call `deleteDocument(id)` in DB transaction then unlink file, return 200 `{ success: true }` or 404; per `DELETE-documents-id.md` atomicity contract
- [ ] T020 [US1] Extend `src/app/api/chat/route.ts` — before calling `handleChatMessage()`, check if any `ready` documents exist (`listDocuments()` filtered); if yes, embed the latest user message via `generateEmbedding`, call `retrieveChunks`, prepend retrieved chunks as structured system context block (format from `research.md` Decision 7) to the persona system prompt; if no docs exist, pass system prompt unchanged (FR-017 fallback)
- [ ] T021 [P] [US1] Build `src/components/DocumentUpload.tsx` — file picker (accept `.pdf,.txt`, max 50 MB client-side hint), calls `POST /api/documents` with FormData, triggers status polling on 202 response, shows upload progress and processing state
- [ ] T022 [P] [US1] Build `src/components/DocumentStatus.tsx` — accepts `status: 'pending' | 'ready' | 'failed'` and optional `errorMessage`; renders colour-coded badge; shows error tooltip on hover for failed status
- [ ] T023 [US1] Build `src/components/DocumentLibrary.tsx` — fetches `GET /api/documents` on mount, polls every 2s for any `pending` documents, renders list of documents with `DocumentStatus` badge and delete button (calls `DELETE /api/documents/:id`, optimistic removal from list)
- [ ] T024 [US1] Integrate `DocumentLibrary` + `DocumentUpload` into the chat layout (sidebar panel or collapsible drawer alongside the existing `ChatPanel`)
- [ ] T025 [US1] Write integration tests in `__tests__/integration/documents-api.test.ts` — use in-memory SQLite with sqlite-vec loaded; test: (a) POST upload → 202, (b) duplicate SHA-256 → 409 with existingId, (c) oversized file → 400, (d) unsupported type → 400, (e) GET list returns documents, (f) DELETE removes DB rows and returns 200, (g) DELETE unknown id → 404

**Checkpoint**: Full upload → ingest → ask → cited answer flow working. User Story 1 independently testable.

---

## Phase 4: User Story 2 — Switch Between Cloud and Local LLM (Priority: P2)

**Goal**: User can switch between Ollama (local, no external calls) and cloud providers; RAG works with both

**Independent Test**: Upload a PDF, ask a question with Ollama selected, switch to OpenAI/Anthropic, ask again — both return cited answers; network monitor shows zero external calls during Ollama mode

### Tests for User Story 2 ⚠️ Write first — must FAIL before implementation

- [ ] T026 [P] [US2] Write failing unit test in `__tests__/modules/rag/embedding-client.test.ts` — test that `generateEmbedding` throws `EmbeddingError` with "Ollama unreachable" message when `fetch` to `localhost:11434` returns a network error

### Implementation for User Story 2

- [ ] T027 [US2] Add Ollama availability pre-check in `src/modules/rag/ingestion-pipeline.ts` — call `generateEmbedding('ping')` with timeout 5s before starting full ingestion; if it throws `EmbeddingError`, immediately set document status to `failed` with message "Embedding failed: Ollama unreachable at http://localhost:11434"
- [ ] T028 [US2] Update `POST /api/documents` in `src/app/api/documents/route.ts` — surface `EmbeddingError` from ingestion as a structured error in the document's `error_message` field (already handled by pipeline); ensure the 202 response is returned before the async pipeline starts so the client can poll for failure
- [ ] T029 [US2] Verify provider switching end-to-end — manually switch model switcher to Ollama `llama3.1:8b`, upload a PDF, ask a question; confirm response is grounded; switch to OpenAI/Anthropic, ask again; confirm embeddings remain from `nomic-embed-text` (FR-016 — no re-embedding on provider switch)

**Checkpoint**: Local-only mode verified; Ollama unavailable shows clear error; provider switching preserves vector index

---

## Phase 5: User Story 3 — Multi-Turn Q&A on the Same Document (Priority: P2)

**Goal**: Follow-up questions correctly reference both the document and prior conversation turns

**Independent Test**: Upload PDF, ask "What is section 2 about?", follow up with "Can you elaborate on that?" — second response uses both prior context and document retrieval

### Tests for User Story 3 ⚠️ Write first — must FAIL before implementation

- [ ] T030 [P] [US3] Write failing integration test in `__tests__/integration/documents-api.test.ts` — simulate two-turn chat with a document; verify RAG context is injected on both turns and conversation history is preserved alongside it

### Implementation for User Story 3

- [ ] T031 [US3] Audit `src/app/api/chat/route.ts` RAG injection — verify that when RAG context is prepended to the system prompt, the full conversation history (from context window) is still passed unchanged to `streamText()`; ensure the 100K token cap context window trimming does not remove RAG context (system prompt is not subject to trimming)
- [ ] T032 [US3] Write E2E test in `e2e/document-qa.spec.ts` — upload a PDF, ask an initial question, verify citation in response, ask a follow-up referencing "that", verify follow-up uses document context

**Checkpoint**: Multi-turn Q&A with document context working; conversation history and RAG context coexist correctly

---

## Phase 6: User Story 4 — View Source Citations (Priority: P3)

**Goal**: Citations in the answer are displayed as visible, verifiable references to source passages

**Independent Test**: Ask a factual question about an uploaded PDF; verify `[filename, Page N]` citations appear below the AI response as a distinct UI element

### Tests for User Story 4 ⚠️ Write first — must FAIL before implementation

- [ ] T033 [P] [US4] Write failing unit test for citation extraction — given a retrieval result array, verify `formatCitations()` produces the correct `[DocumentName, Page N]` strings

### Implementation for User Story 4

- [ ] T034 [US4] Add `citations` array to the chat API data stream — after retrieval, encode `Citation[]` as a stream annotation using Vercel AI SDK's `writeMessageAnnotation` so citations arrive alongside the streamed text
- [ ] T035 [P] [US4] Build `src/components/CitationPanel.tsx` — renders a collapsible "Sources" section below the assistant message; displays each citation as `[DocumentName, Page N]` with the excerpt text on expand
- [ ] T036 [US4] Integrate `CitationPanel` into the chat message renderer — show panel only when the message has citations annotations; read annotations from the `useChat` hook message metadata

**Checkpoint**: Citations visible in UI; each citation maps to a real page and document

---

## Phase 7: User Story 5 — Multiple File Formats (Priority: P3)

**Goal**: Users can upload `.txt` files in addition to `.pdf`; unsupported types are rejected with a clear error

**Independent Test**: Upload a `.txt` file, ask a question, verify cited answer is returned; attempt `.xlsx` upload, verify rejection error lists supported formats

### Tests for User Story 5 ⚠️ Write first — must FAIL before implementation

- [ ] T037 [P] [US5] Write failing unit tests for txt-extractor in `__tests__/modules/rag/pdf-extractor.test.ts` — test: (a) `.txt` file split into pseudo-pages every 50 lines, (b) page numbers are 1-indexed, (c) empty file returns empty array

### Implementation for User Story 5

- [ ] T038 [P] [US5] Implement `src/modules/rag/txt-extractor.ts` — export `extractTextFile(buffer: Buffer): { pageNumber: number; text: string }[]`; split content into pseudo-pages of 50 lines each (page numbers 1-indexed); return empty array for empty files
- [ ] T039 [US5] Extend `src/modules/rag/ingestion-pipeline.ts` — route by MIME type: `application/pdf` → `extractPages()`, `text/plain` → `extractTextFile()`; all downstream chunking and embedding unchanged
- [ ] T040 [US5] Extend MIME type validation in `src/app/api/documents/route.ts` Zod schema — allowlist: `['application/pdf', 'text/plain']`; error message: `"Unsupported file type. Supported formats: PDF (.pdf), plain text (.txt)"`

**Checkpoint**: `.txt` files ingested and retrievable; unsupported formats rejected cleanly

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T041 [P] Write unit tests for `retrieval-service.ts` in `__tests__/modules/rag/retrieval-service.test.ts` — mock `vec_document_chunks` query; test: (a) returns top-5 ordered by distance, (b) excludes chunks from `failed` documents, (c) returns empty array when no documents exist
- [ ] T042 Run `npm run lint && npm run build` — resolve all TypeScript strict-mode errors and ESLint warnings introduced by new RAG module files
- [ ] T043 Validate `quickstart.md` steps end-to-end — follow each step from a clean state, confirm the full upload → ask → cited answer flow completes within 60 s for a 10-page PDF (SC-001)
- [ ] T044 [P] Review system prompt RAG injection format in `src/app/api/chat/route.ts` — verify the prompt instructs the LLM to cite as `[DocumentName, Page N]` and to decline when information is not in the documents (SC-003 compliance)
- [ ] T045 [P] Add structured INFO/ERROR logging to `src/modules/rag/document-service.ts` and `src/modules/rag/ingestion-pipeline.ts` — log upload received, ingestion started/completed/failed with document id and duration (Constitution Principle VI)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
  - T003 → T004 → T005 (sequential: schema before extension before migration)
  - T006, T007, T008, T009, T010 can run in parallel after T001
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phases 4–7 (US2–US5)**: All depend on Phase 3 completion; can run in priority order
- **Phase 8 (Polish)**: Depends on all desired stories being complete

### Within Phase 3 (US1) Execution Order

```
T011, T012, T013 (tests, parallel) → FAIL confirmed
T014 (document-service) → T015 (ingestion-pipeline full), T016 (retrieval-service) [parallel]
T017 (rag/index.ts) → T018, T019 [parallel], T020, T021
T020 (chat route) → manual smoke test
T021, T022 (UI components, parallel) → T023 (DocumentLibrary) → T024 (layout integration)
T025 (integration tests)
```

### User Story Dependencies

- **US1 (P1)**: Standalone — no dependency on other stories
- **US2 (P2)**: Depends on US1 (provider switching requires RAG to be working)
- **US3 (P2)**: Depends on US1 (multi-turn requires base RAG to be working)
- **US4 (P3)**: Depends on US1 (citations are an enhancement of the answer flow)
- **US5 (P3)**: Depends on Phase 2 (ingestion pipeline must exist); largely independent of US1 UI

---

## Parallel Execution Examples

### Phase 2 Parallel Group

```
Task: "Implement pdf-extractor.ts"            (T006)
Task: "Implement chunker in ingestion-pipeline.ts"  (T007)
Task: "Implement embedding-client.ts"         (T008)
Task: "Add ollama case to llm-client.ts"      (T009)
Task: "Add Ollama seed entry in seed.ts"      (T010)
```

### Phase 3 (US1) Parallel Group — Tests First

```
Task: "Write failing tests for pdf-extractor" (T011)
Task: "Write failing tests for chunker"       (T012)
Task: "Write failing tests for embedding-client" (T013)
```

### Phase 3 (US1) Parallel Group — API Routes

```
Task: "Implement POST + GET /api/documents"   (T018)
Task: "Build DocumentUpload.tsx"              (T021)
Task: "Build DocumentStatus.tsx"              (T022)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Phase 1: Setup (T001–T002)
2. Phase 2: Foundational (T003–T010)
3. Phase 3: US1 tests → implementation → integration (T011–T025)
4. **STOP and VALIDATE**: Upload a PDF, ask a question, verify a cited answer
5. Demo / ship MVP

### Incremental Delivery

- Phase 3 complete → MVP shipped (upload + cited answers)
- Phase 4 complete → Ollama mode verified, error handling hardened
- Phase 5 complete → Multi-turn Q&A confirmed
- Phase 6 complete → Citation UI panel added
- Phase 7 complete → TXT format supported
- Phase 8 complete → Polish, tests, logging

---

## Summary

| Phase | Stories | Tasks | Parallel Opportunities |
|-------|---------|-------|----------------------|
| 1 — Setup | — | T001–T002 | T001, T002 |
| 2 — Foundational | — | T003–T010 | T006–T010 |
| 3 — US1 (P1) MVP | US1 | T011–T025 | T011–T013, T018/T021/T022 |
| 4 — US2 (P2) | US2 | T026–T029 | T026 |
| 5 — US3 (P2) | US3 | T030–T032 | T030 |
| 6 — US4 (P3) | US4 | T033–T036 | T033, T035 |
| 7 — US5 (P3) | US5 | T037–T040 | T037, T038 |
| 8 — Polish | — | T041–T045 | T041, T042, T044, T045 |
| **Total** | **5 stories** | **45 tasks** | **15 parallel groups** |
