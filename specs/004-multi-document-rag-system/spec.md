# Feature Specification: Multi-Document RAG System

**Feature Branch**: `004-multi-document-rag-system`
**Created**: 2026-05-03
**Status**: Draft
**Feature ID**: 004
**Depends On**: 003.5 (UI Redesign — Claude Design System)
**Priority**: High

---

## Clarifications

### Session 2026-05-03

- Q: Does F004 introduce multi-user authentication, or does "per-user" mean a single fixed user slot with a `userId` column for future extension? → A: **Fixed `userId = "default"` only — no auth layer in F004.** The `userId` column is added to the schema solely to enable F006 (long-term memory + personalisation) to introduce real user profiles without a schema migration. All F004 queries hardcode `userId = "default"`.
- Q: Does "FAISS pipeline" in the task list mean replacing `sqlite-vec` with Facebook FAISS? → A: **No migration — colloquial language.** The existing `sqlite-vec`-based vector pipeline from F002/F003 stays as-is. F004 extends it by adding `documentId` and `userId` filter columns to the embeddings table to support multi-document namespacing. No new vector-store dependency is introduced.
- Q: The "per-user memory / persist index to disk" task — is this already covered by sqlite-vec, or is there an explicit new requirement? → A: **Explicit new requirement: the vector index state must survive restarts via DB persistence.** Any in-memory index representation (e.g., loaded vectors, inverted lists) MUST be reconstructed from the persisted `sqlite-vec` rows on application startup, tied to `userId`. The requirement is that the system reconstructs query-ready state from the DB automatically — no user action required after a restart.
- Q: Should unselected documents in the filter be fully excluded from the candidate pool, or just deprioritised? → A: **Hard exclude.** When a filter is active, documents not in the filter set MUST NOT enter the candidate pool at all. This keeps retrieval fully predictable and citations trustworthy — the user's scoping decision is a hard boundary, not a hint to the ranker.
- Q: Does the candidate pool size stay at 20 regardless of document count, or scale with it? → A: **Scale with document count: `min(20 × N, 100)` where N is the number of documents in scope** (full library, or active filter set). A single document stays at 20. Five documents gets 100 candidates. The cap at 100 prevents runaway reranking cost. This formula replaces the fixed `ragCandidatePoolSize = 20` from F003 for multi-document queries.
- Q: When one document in the sequential ingestion queue fails, what happens to the remaining documents waiting behind it? → A: **Continue — mark the failed doc and immediately start the next document in the queue.** A single failure never blocks unrelated documents. Consistent with the non-blocking principle in FR-010.
- Q: What is the ingestion time target for a 50-page PDF? → A: **No hard latency SLO — async with real-time progress updates.** Hardware varies too much (local Ollama vs cloud embeddings) to commit to a wall-clock target. The library panel MUST show live per-document progress so the user is never left guessing. A completion notification MUST appear when indexing finishes.
- Q: What are the concrete document library limits per user? → A: **50 documents and 500 MB total per user.** Uploads exceeding either limit are rejected at the API boundary with a specific error message identifying which limit was hit.
- Q: Should badge colour assignment persist across app restarts, or reset on each startup? → A: **Persist in DB.** The `badgeColour` value is written to the document record at upload time and read back on every restart. Doc A always gets the same colour regardless of how many times the server restarts.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Upload Multiple Documents and Ask Questions Across All of Them (Priority: P1)

A user uploads three research papers and asks "What do these papers agree on regarding transformer attention?". The system retrieves the most relevant passages from across all three documents, synthesises a grounded answer, and cites which paper and page each piece of evidence came from — each document's citation shown in a distinct colour-coded badge.

**Why this priority**: This is the core value proposition of F004. Without cross-document retrieval and multi-source citations, the feature is functionally identical to F002 (single-document). Everything else in this spec depends on this working first.

**Independent Test**: Upload two PDFs on related topics, ask a question that requires synthesising both, and verify the answer cites passages from both documents with distinct per-document badges.

**Acceptance Scenarios**:

1. **Given** the user has uploaded two or more documents, **When** they ask a question in the chat panel, **Then** the system searches across all uploaded documents simultaneously and returns an answer grounded in content from multiple sources.
2. **Given** the answer draws from two or more documents, **When** citations are displayed, **Then** each citation shows the document title, page number, and a colour-coded badge unique to that document.
3. **Given** the answer draws from only one of three uploaded documents, **When** citations are displayed, **Then** only citations from the relevant document appear; the other two documents are not incorrectly cited.
4. **Given** no document contains relevant content for the user's question, **When** the system responds, **Then** it states that the information was not found in the uploaded documents rather than hallucinating.

---

### User Story 2 — Manage a Document Library (Upload, View Status, Delete) (Priority: P1)

A user opens the document library panel, uploads five files over time, sees each file's processing status (processing, indexed, failed), and deletes a document they no longer need. On the next app restart, all remaining documents and their indices are still present.

**Why this priority**: Without a functional document library UI, users cannot build or maintain the multi-document collection that all other F004 capabilities depend on. Status visibility prevents confusion when a document is still being ingested.

**Independent Test**: Upload a PDF, observe it transition through processing → indexed, then delete it and verify it disappears from the library and is no longer included in subsequent RAG queries.

**Acceptance Scenarios**:

1. **Given** the document library panel is open, **When** the user uploads a file, **Then** an entry appears immediately with status "processing" and transitions to "indexed" when ingestion completes.
2. **Given** ingestion fails (e.g., corrupt file), **When** the document entry is shown, **Then** it displays status "failed" with a human-readable error message.
3. **Given** the library lists three documents, **When** the user deletes one, **Then** the document is removed from the list, its file and vector index entries are deleted, and subsequent queries no longer retrieve chunks from it.
4. **Given** the user has uploaded documents and restarts the application, **When** they return to the library, **Then** all previously uploaded documents and their indices are present and immediately queryable without re-uploading.

---

### User Story 3 — Filter a Question to Specific Documents (Priority: P2)

A user has uploaded five documents but wants to ask a question about only two of them. They select those two documents in the filter UI before submitting their question. The system restricts retrieval to only those documents; the other three are excluded.

**Why this priority**: As document libraries grow, unfocused search across all documents introduces noise. Document filtering gives the user precision control and is essential for large collections.

**Independent Test**: Upload three documents on different topics, select only one in the filter, ask a question relevant to all three, and verify citations come only from the selected document.

**Acceptance Scenarios**:

1. **Given** the document library contains three documents, **When** the user selects two in the filter UI and submits a question, **Then** the RAG pipeline restricts vector search to only those two documents' chunks.
2. **Given** a document filter is active, **When** the answer is returned, **Then** all citations reference only documents from the active filter set; no chunks from excluded documents appear.
3. **Given** a document filter is active, **When** the user clears the filter, **Then** the next question is answered from the full document library.
4. **Given** the user selects a filter but no selected document contains relevant content, **When** the system responds, **Then** it states that the information was not found in the selected documents, not in all documents.

---

### User Story 4 — Cross-Document Graph-Enhanced Retrieval Surfaces Shared Concepts (Priority: P2)

A user uploads two documents that discuss the same concept (e.g., "attention mechanisms" appears in both a paper and a technical report). The graph pipeline detects that chunks from both documents mention the same entity and creates edges between them. When the user asks about that concept, the reranker promotes the connected chunks from both documents — improving answer quality beyond what vector similarity alone would surface.

**Why this priority**: The graph linkage across documents is the differentiating capability of F004 over simply running F002 twice. It justifies the architectural complexity of multi-document support.

**Independent Test**: Upload two documents that share a named concept, ask about that concept, and verify that the reranked answer references both documents even if one document's chunk had a lower raw vector similarity score.

**Acceptance Scenarios**:

1. **Given** two documents contain chunks referencing the same named entity, **When** `writeChunkNodes()` runs for both documents, **Then** each chunk node is tagged with its source `documentId` and `documentTitle` in the graph store.
2. **Given** chunk nodes from two different documents share a named entity, **When** `rerankWithGraph()` runs, **Then** edges are created between the cross-document chunks, and their edge-weight scores are elevated relative to isolated chunks.
3. **Given** graph reranking has promoted a chunk from a second document, **When** the answer is returned, **Then** the citation includes the document title of the promoted chunk, correctly attributing it to the second document.
4. **Given** the graph store is empty (first query), **When** the system answers, **Then** it falls back to pure vector similarity order with no error, consistent with F003 graph-fallback behaviour.

---

### User Story 5 — Citations Show Document Title, Page, Relevance Score, and Graph Score (Priority: P2)

A power user reviewing an answer wants to understand exactly why each passage was included. Each citation shows the document title with a colour-coded badge, the page number, the raw vector similarity score, and the graph connectivity score — giving them enough signal to audit retrieval quality without opening the original documents.

**Why this priority**: This extends the F003 graph-score citation format to the multi-document context. It is a trust and transparency feature that makes the system's reasoning auditable.

**Independent Test**: Upload two documents, ask a question that retrieves chunks from both, and verify each citation in the response shows document title (badged), page, similarity score (0.0–1.0), and graph score (integer).

**Acceptance Scenarios**:

1. **Given** graph reranking was active, **When** citations are displayed, **Then** each citation shows: document title (colour-coded badge), page number, similarity score, and graph connectivity score in the format `[DocTitle, Page N, Sim: 0.87, Graph: 4]`.
2. **Given** the graph store was empty (fallback mode), **When** citations are displayed, **Then** the graph score field is omitted; the format is `[DocTitle, Page N, Sim: 0.87]`.
3. **Given** multiple citations reference the same document, **When** they appear in the response, **Then** they share the same colour-coded badge colour, making the per-document grouping visually clear.
4. **Given** citations reference four different documents, **When** they appear, **Then** each document receives a distinct badge colour; badge colours are stable across queries (Doc A always gets the same colour in a session).

---

### User Story 6 — Benchmark Cross-Document Retrieval Quality (Priority: P3)

A developer runs the cross-document benchmark suite and sees a side-by-side comparison of single-document retrieval vs multi-document cross-retrieval on 10 questions that require synthesising information from two or more documents. The benchmark confirms that cross-document graph edges improve answer quality.

**Why this priority**: Without an empirical baseline, the cross-document graph capability cannot be validated. The benchmark is the F004 equivalent of F003's SC-003 quality gate.

**Independent Test**: Run the benchmark script against a fixed two-document test corpus with 10 synthesis questions. Verify the Markdown report shows per-question scores and an aggregate improvement verdict.

**Acceptance Scenarios**:

1. **Given** the benchmark script is run against a fixed two-document test corpus, **When** it completes, **Then** a Markdown report is produced at `specs/004-multi-document-rag/benchmark.md` with per-question scores for single-document retrieval vs cross-document retrieval.
2. **Given** the report is produced, **When** aggregate scores are reviewed, **Then** cross-document graph-enhanced retrieval scores at least 10% higher relevance than single-document retrieval on questions requiring synthesis from both test documents.

---

### User Story 7 — README Documents Multi-Document RAG (Priority: P3)

A developer reading the README understands how the multi-document RAG system works, how cross-document graph edges are created, and how to use the document filter. The README includes a cross-document graph diagram and the benchmark results.

**Why this priority**: Documentation closes the loop on F004 and makes the system discoverable and understandable to future contributors and evaluators.

**Independent Test**: A developer with no prior context on F004 reads only the README and can successfully upload two documents, ask a cross-document question, and interpret the citations.

**Acceptance Scenarios**:

1. **Given** the README is updated, **When** a developer reads the multi-document RAG section, **Then** it contains a cross-document graph diagram (ASCII or Mermaid) illustrating how nodes from Doc A and Doc B get linked via shared entities.
2. **Given** the README includes benchmark results, **When** a reviewer reads them, **Then** they can see the comparison between single-document and cross-document retrieval quality on the fixed benchmark set.

---

### Edge Cases

- What happens when a user reaches the library limit? The system enforces a hard cap of **50 documents and 500 MB total** per user. Any upload that would exceed either limit is rejected at the API boundary with a specific error identifying which limit was hit (e.g., "Document limit reached: 50/50" or "Storage limit reached: 498 MB of 500 MB used").
- What happens when two documents are identical in content? The SHA-256 deduplication check from F002 (FR-012a) applies — the second upload is rejected with "Document already in library."
- What happens when the document filter selects zero documents? The filter UI prevents submitting with zero documents selected; at least one must be chosen, or the filter must be cleared to use the full library.
- What happens when `writeChunkNodes()` is called for a chunk from a document that has since been deleted? The graph write is a no-op for orphaned document references; the chunk is excluded from retrieval anyway since its vector entries were deleted.
- What happens when cross-document graph edge creation causes a performance spike on a large library? Edge creation is asynchronous and fire-and-forget; it does not block the RAG response to the user (consistent with F003 behaviour).
- What happens when a document fails ingestion partway through (e.g., embedding error on chunk 30 of 150)? The document is marked `failed`, partial vector index entries are rolled back, and the user must delete and re-upload (no in-place retry — consistent with F002 behaviour).
- What happens when the user restarts the app and a document's status was `processing`? On startup, any document stuck in `processing` status is transitioned to `failed` with the message "Interrupted by restart — please re-upload."
- What happens when badge colours are exhausted (more than N documents)? The colour palette cycles; documents beyond the palette size reuse colours from the beginning. Within a session, colour assignment is stable (always the same colour for a given document).

---

## Requirements *(mandatory)*

### Functional Requirements

#### Document Library UI

- **FR-001**: The system MUST provide a document library panel accessible from the main navigation. The panel MUST list all uploaded documents with: filename, file size, upload date, page count (when known), and processing status (`processing`, `indexed`, `failed`).
- **FR-002**: The document library panel MUST support uploading multiple files simultaneously (multi-file picker and drag-and-drop). Each file begins ingestion independently; the panel updates status per-document in real time with a visible progress indicator (e.g., spinner or progress bar) for documents currently in `processing` state. When a document transitions to `indexed`, a completion notification MUST be shown without requiring a page refresh.
- **FR-003**: For documents in `failed` status, the library MUST display a human-readable error message alongside the status badge (e.g., "Embedding failed: Ollama unreachable").
- **FR-004**: The user MUST be able to delete individual documents from the library. Deletion MUST remove the document file, all its vector index entries, and all its graph nodes from the store. The document MUST no longer appear in retrieval results after deletion.
- **FR-005**: Any document stuck in `processing` status at application startup MUST be automatically transitioned to `failed` with the message "Interrupted by restart — please re-upload."

#### Per-User Document Store

- **FR-006**: Every document record in the database MUST include a `userId` column populated with the fixed value `"default"` in F004. All retrieval queries MUST be scoped to `userId = "default"`. No authentication layer is introduced; the column exists solely so that F006 (long-term memory + personalisation) can introduce real user profiles without a schema migration.
- **FR-007**: The document library panel MUST only display and operate on documents where `userId = "default"`.

#### Multi-File Ingestion Pipeline

- **FR-008**: Each uploaded file MUST be processed through the existing ingestion pipeline: text extraction → 512-token / 64-token-overlap chunking (using `cl100k_base`, consistent with F002) → embedding generation → vector index storage.
- **FR-009**: Every chunk produced from a document MUST be tagged with its source `documentId` and `documentTitle` at ingestion time. These tags MUST be stored both in the vector index entry and in the graph node properties (when written to the graph store).
- **FR-010**: The ingestion pipeline MUST be non-blocking — uploading and processing one document MUST NOT block the UI or prevent other documents from being uploaded simultaneously. When one document in the queue fails, processing MUST continue with the next queued document immediately; the failed entry is marked `failed` and the queue moves on without user intervention.
- **FR-011**: The SHA-256 content-hash deduplication check from F002 (FR-012a) MUST be enforced across all documents in the user's library. Identical content from a new upload MUST be rejected regardless of filename.
- **FR-011a**: The system MUST enforce a hard cap of **50 documents and 500 MB total storage** per user. Any upload that would breach either limit MUST be rejected at the API boundary (before ingestion begins) with a 400 response identifying which limit was reached. The library panel MUST display current usage (e.g., "12 / 50 documents · 124 MB / 500 MB") so the user can anticipate the limit before hitting it.

#### Cross-Document Vector Index

- **FR-012**: All chunk embeddings for a given user's documents MUST be stored in a single unified vector index scoped to that user. There MUST NOT be one index per document; all documents' embeddings are queryable in a single search operation.
- **FR-013**: When a document is deleted, ONLY that document's embeddings MUST be removed from the unified index. Other documents' embeddings MUST remain intact and immediately queryable.

#### Cross-Document Retrieval

- **FR-014**: The candidate pool size MUST scale with the number of documents in scope (full library or active filter set): `candidatePoolSize = min(20 × N, 100)` where N is the document count. A single document uses a pool of 20 (identical to F003). Five documents uses a pool of 100. The cap of 100 prevents runaway reranking cost regardless of library size. A new config value `ragCandidatePoolPerDoc: 20` and `ragCandidatePoolMax: 100` MUST be added to `src/lib/config.ts`; the pool size MUST be computed dynamically at query time, not hardcoded.
- **FR-015**: When a document filter is active, the vector search MUST be restricted to chunks whose `documentId` is in the active filter set. Chunks from excluded documents MUST NOT appear in the candidate pool regardless of their similarity score.
- **FR-016**: After vector retrieval, the candidate pool MUST pass through the existing `retrieveAndRerank()` pipeline from F003 (writeChunkNodes → rerankWithGraph → top-5 slice), with the addition that `writeChunkNodes()` now receives the `documentId` and `documentTitle` for each chunk.

#### Cross-Document Graph Integration

- **FR-017**: The `writeChunkNodes()` function MUST be extended to store `documentId` and `documentTitle` as properties on each graph node, in addition to the fields added in F003 (`similarityScore`, `retrievedAt`). The existing call-site interface (passing only `{ id, text }`) MUST continue to work unchanged (all new fields remain optional).
- **FR-018**: `rerankWithGraph()` MUST detect when two candidate chunks from **different** documents share a named entity or keyword (extracted from their text). When detected, a cross-document edge MUST be created between the two nodes with a weight proportional to entity co-occurrence count. Cross-document edges MUST be distinguishable from same-document edges (stored with an `isCrossDocument: true` property).
- **FR-019**: Cross-document edge creation MUST be asynchronous and fire-and-forget — it MUST NOT block the reranking result returned to the caller. Failures MUST be logged server-side only.

#### Source Citation Upgrade

- **FR-020**: Every cited chunk in an answer MUST include: document title (with colour-coded badge), page number, vector similarity score (0.0–1.0, two decimal places), and graph connectivity score (integer, present only when graph reranking was active). Format: `[DocTitle, Page N, Sim: X.XX, Graph: Y]`.
- **FR-021**: When graph reranking was not active (empty graph fallback), the graph score field MUST be omitted. Format: `[DocTitle, Page N, Sim: X.XX]`. The two formats MUST be distinguishable in the API response schema.
- **FR-022**: Each distinct document in the library MUST be assigned a stable colour from a predefined palette at upload time. The assigned colour MUST be persisted in the document's database record (`badgeColour` field) so it survives application restarts. The same document MUST always render with the same badge colour across all sessions. When the number of documents exceeds the palette size, colours cycle from the beginning of the palette.

#### Document Filter

- **FR-023**: The document library panel MUST include a filter control that allows the user to select a subset of their documents before submitting a question. The filter state MUST be visible alongside the chat input so the user knows it is active.
- **FR-024**: The filter MUST prevent submission with zero documents selected. If the user deselects all documents, the filter reverts to "all documents" automatically.
- **FR-025**: The active filter MUST be sent as part of the chat API request (as an optional `documentIds: string[]` field). When `documentIds` is present and non-empty, the retrieval layer restricts the candidate pool to those documents (FR-015). When absent or empty, the full library is searched.

#### Per-User Memory and Index Persistence

- **FR-026**: All chunk embeddings MUST be stored in the `sqlite-vec` table tied to `userId`. On application startup, the system MUST reconstruct any in-memory index representations (e.g., cached vector lists, neighbourhood structures) directly from the persisted rows — no user action, re-upload, or re-indexing required. The reconstruction MUST complete before the first query is accepted.
- **FR-027**: The vector index MUST support incremental addition and deletion of individual documents' embeddings. Adding a new document's chunks MUST NOT require rebuilding the index from scratch. Deleting a document's chunks MUST remove exactly those rows and leave all other documents' embeddings intact and immediately queryable.

#### Benchmark

- **FR-028**: Before the benchmark script is written, a fixed evaluation set MUST be committed as `specs/004-multi-document-rag/eval-set.md` containing 10 questions that require synthesising information from two or more test documents, with expected answers. The benchmark script MUST NOT be written until this file exists.
- **FR-029**: A benchmark script MUST be implemented (at `scripts/benchmark-multi-doc-rag.ts` or equivalent) that runs the 10 questions against: (a) single-document retrieval (one document at a time, best score wins) and (b) cross-document retrieval (all documents searched simultaneously with graph reranking). Per-question relevance scores and an aggregate improvement percentage MUST be recorded.
- **FR-030**: Benchmark results MUST be committed as `specs/004-multi-document-rag/benchmark.md` containing: the 10 questions, per-question scores for both strategies, an aggregate improvement percentage, and a pass/fail verdict against a ≥ 10% improvement target.

#### README

- **FR-031**: The README MUST be updated with a "Multi-Document RAG" section containing: a cross-document graph diagram (ASCII or Mermaid) showing how chunk nodes from Doc A and Doc B get connected via shared entities, a usage guide for the document library and filter UI, and the benchmark results summary.

---

### Key Entities

- **Document**: An uploaded file in the user's document library. Attributes: `id`, `userId`, `filename`, `fileSize`, `pageCount`, `contentHash` (SHA-256, unique per user for deduplication), `status` (`processing` | `indexed` | `failed`), `errorMessage` (nullable), `uploadedAt`, `badgeColour` (assigned at upload time from the palette, persisted to DB, stable across all restarts). Lifecycle: `processing` → `indexed` (success) or `failed` (error); permanently deleted on user request (cascades to chunks, embeddings, and graph nodes).
- **DocumentChunk**: A 512-token segment of extracted text tagged to its source document. Attributes: `id`, `documentId`, `userId`, `text`, `pageNumber`, `chunkPosition`, `tokenCount`.
- **ChunkEmbedding**: The vector representation of a DocumentChunk stored in the unified per-user vector index. Attributes: `chunkId`, `userId`, `vector` (float array), `documentId` (denormalised for filter support).
- **CrossDocumentEdge**: A graph edge linking chunks from different documents that share a named entity. Attributes: `fromNodeId`, `toNodeId`, `isCrossDocument: true`, `sharedEntity` (the entity string), `weight` (co-occurrence count).
- **MultiDocCitation**: The enriched citation model returned in answers. Attributes: `documentId`, `documentTitle`, `badgeColour`, `pageNumber`, `similarityScore` (float), `graphScore` (integer, nullable — null when fallback mode).
- **DocumentFilter**: The filter state attached to a chat request. Attributes: `documentIds: string[]` (empty = search all).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can upload five documents and receive a cross-document cited answer within 30 seconds for a library where all documents are already indexed (retrieval latency, not ingestion latency).
- **SC-002**: Every answer grounded in multiple documents includes citations from at least two documents when the question genuinely requires synthesis from two or more sources, at a rate ≥ 90% on the benchmark question set.
- **SC-003**: Cross-document graph-enhanced retrieval scores at least 10% higher relevance than single-document best-match retrieval on the fixed 10-question benchmark set.
- **SC-004**: Document deletion removes the document, all its vector index entries, and all its graph nodes within 3 seconds for documents up to 200 pages, with the library reflecting the deletion without a page refresh.
- **SC-005**: The document filter correctly restricts retrieval to selected documents on 100% of queries where the filter is active (zero cross-filter leakage).
- **SC-006**: All documents and their indices survive an application restart with zero data loss and are immediately queryable without re-uploading.
- **SC-007**: Each citation correctly displays document title, page number, similarity score, and (when applicable) graph score on ≥ 95% of document-grounded answers.
- **SC-008**: All new API endpoints and modified modules achieve ≥ 95% test coverage (line, branch, function) consistent with the F002.5 coverage floor.
- **SC-009**: The document library panel shows a live progress indicator within 500 ms of an upload being accepted, and displays a completion notification within 2 seconds of the `indexed` status being written to the DB — with no page refresh required.
- **SC-010**: When a document in the ingestion queue fails, the next queued document begins processing within 1 second of the failure being recorded, with no user action required.

---

## Assumptions

- F003's `retrieveAndRerank()` pipeline, `writeChunkNodes()`, and `rerankWithGraph()` are fully implemented and operational; F004 extends them rather than replacing them.
- The vector store is `sqlite-vec` (introduced in F002) and stays as-is — no migration to FAISS or any other vector store. F004 adds `documentId` and `userId` filter columns to the embeddings table to support multi-document namespacing. No new vector-store dependency is introduced.
- `userId` is always `"default"` in F004. The column exists for forward-compatibility with F006 (user profiles + personalisation) only. No authentication, session tokens, or login UI is built in this feature.
- Documents are stored in the local filesystem under `data/documents/default/`. Cloud storage is out of scope for F004.
- The `badgeColour` palette has at least 8 distinct colours. Palette definition is a UI implementation detail. The colour is assigned at upload time, persisted in the `documents` table, and stable across all restarts — not just within a single session.
- Named entity extraction for cross-document edge creation uses a lightweight keyword / noun-phrase extraction approach (e.g., TF-IDF or stop-word-filtered token overlap) to avoid introducing a new NLP dependency. A heavier NLP pipeline (spaCy, NER model) is out of scope for v1.
- Ingestion concurrency remains 1 document at a time per user queue (consistent with F002). Multiple uploads are queued and processed sequentially; the UI reflects each document's status independently.
- The document count limit is **50 documents** and the storage cap is **500 MB total per user**. Both are enforced at the API boundary before ingestion begins (FR-011a). These values are defined in `src/lib/config.ts` as `docLibraryMaxCount: 50` and `docLibraryMaxBytes: 524_288_000` so they can be adjusted without code changes.
- The dynamic pool formula `min(20 × N, 100)` supersedes the fixed `ragCandidatePoolSize = 20` from F003 for all multi-document queries. Single-document queries (N=1) produce the same pool size as F003, preserving backward-compatible behaviour.
- F003.5's UI redesign (Claude Design System) provides the component library and design tokens used by the document library panel and citation badges. No new CSS framework or component library is introduced.
