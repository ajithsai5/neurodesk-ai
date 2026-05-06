# Implementation Plan: Multi-Document RAG System

**Branch**: `004-multi-document-rag-system` | **Date**: 2026-05-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-multi-document-rag-system/spec.md`

---

## Summary

Extends the single-document RAG pipeline (F002) and graph-enhanced retrieval (F003) into a full multi-document knowledge base. The core changes are: schema additions for `userId`/`badgeColour` on documents, a dynamic retrieval pool formula `min(20 × N, 100)`, a `documentIds` filter on the chat API, cross-document graph edges via shared-entity detection, and an upgraded citation format with per-document colour-coded badges, similarity scores, and graph scores. All changes are additive — no existing functionality is removed or replaced.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 14 App Router, Drizzle ORM, better-sqlite3, sqlite-vec, js-tiktoken, Vercel AI SDK, uuid
**Storage**: SQLite (`data/neurodesk.db`) via Drizzle ORM; sqlite-vec virtual table for vector embeddings; local filesystem (`data/documents/default/`) for uploaded files
**Testing**: Vitest (unit + integration); Playwright (E2E)
**Target Platform**: Node.js, Windows 11 / Linux (local dev tool)
**Project Type**: Full-stack Next.js web application (single process)
**Performance Goals**: Retrieval latency ≤ 30s for indexed library (SC-001); ingestion async with live progress (no SLO); queue-continue within 1s of failure (SC-010)
**Constraints**: 50 docs / 500 MB hard cap per user; pool capped at 100 candidates; `ragFinalContextSize` stays at 5; no new npm dependencies introduced
**Scale/Scope**: Single local user (`userId = "default"`); library up to 50 docs; up to 100 graph reranking candidates

---

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Modular Architecture | ✅ Pass | All changes stay within `rag/`, `graph/`, `shared/`, `app/api/` — no cross-module shortcuts |
| II. Test-First (NON-NEGOTIABLE) | ✅ Required | Every phase below starts with failing tests before production code |
| III. Security-First | ✅ Pass | All limits enforced server-side; no client-trust; `userId` isolation at DB level |
| IV. API-First Design | ✅ Pass | Chat filter, document usage API, and citation schema defined in contracts before UI |
| V. Simplicity & YAGNI | ✅ Pass | No new vector store, no NLP library, no auth system; extends existing sqlite-vec with filter columns |
| VI. Observability | ✅ Pass | Existing structured logger used; ingestion progress via status polling |
| VII. Incremental Delivery | ✅ Pass | 8 phases, each independently deployable and testable |

**Complexity Justification**: Cross-document graph edge creation (FR-018) is the only novel algorithm. It uses lightweight token-overlap rather than a heavier NLP model, consistent with Principle V. The `SIMILAR_TO` edge relationship is already in the schema — no schema enum change needed.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-document-rag-system/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── eval-set.md          ← Phase 8 prerequisite (must exist before benchmark script)
├── benchmark.md         ← Phase 8 output (committed after benchmark runs)
├── contracts/
│   ├── GET-documents.md          ← updated response shape (usage stats)
│   ├── POST-documents.md         ← updated request (limit enforcement)
│   ├── DELETE-documents-id.md    ← unchanged (F002 contract still valid)
│   └── POST-chat.md              ← updated request body (documentIds filter)
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code — files changed or created by this feature

```text
src/
├── lib/
│   └── config.ts                        MODIFY — add 4 new constants; deprecate ragCandidatePoolSize
│
├── modules/
│   ├── shared/
│   │   └── db/
│   │       └── schema.ts                MODIFY — add userId, badgeColour to documents;
│   │                                             add userId to document_chunks
│   │
│   ├── rag/
│   │   ├── document-service.ts          MODIFY — userId scoping, badgeColour assignment,
│   │   │                                          limit enforcement, startup reset
│   │   ├── ingestion-pipeline.ts        MODIFY — pass documentTitle to writeChunkNodes
│   │   ├── retrieval-service.ts         MODIFY — documentIds filter, dynamic pool, enriched types
│   │   └── index.ts                     MODIFY — re-export new public API surface
│   │
│   └── graph/
│       └── graph-service.ts             MODIFY — writeChunkNodes gets documentTitle;
│                                                  new cross-doc edge creation helper
│
├── app/
│   └── api/
│       ├── documents/
│       │   └── route.ts                 MODIFY — enforce limits, add usage to GET response;
│       │                                          startup reset on module init
│       └── chat/
│           └── route.ts                 MODIFY — accept optional documentIds[] in body;
│                                                  pass to retrieveAndRerank
│
└── components/
    ├── DocumentLibrary.tsx              MODIFY — usage bar, per-doc progress, filter multi-select,
    │                                             colour badges
    ├── CitationPanel.tsx                MODIFY — show badgeColour, similarityScore, graphScore
    └── DocumentUpload.tsx               REVIEW — verify multi-file input already supported

__tests__/
├── modules/
│   ├── rag/
│   │   ├── document-service.test.ts     NEW — userId scoping, badgeColour, limits, startup reset
│   │   └── retrieval-service.test.ts    MODIFY — documentIds filter, dynamic pool formula
│   └── graph/
│       └── graph-service.test.ts        MODIFY — documentTitle in writeChunkNodes, cross-doc edges
└── integration/
    └── multi-doc-rag.test.ts            NEW — end-to-end: upload 2 docs → query → cross-doc citations

scripts/
└── benchmark-multi-doc-rag.ts          NEW — Phase 8 (created after eval-set.md committed)
```

---

## Complexity Tracking

No Constitution violations. All phases are additive extensions to existing modules.

---

## Implementation Phases

### Phase 1 — Config + Schema (foundation)

**Goal**: Lay the data model foundation all subsequent phases depend on.

**TDD checkpoints** — write these tests first, confirm they fail, then implement:
- `config.ts` exports `ragCandidatePoolPerDoc`, `ragCandidatePoolMax`, `docLibraryMaxCount`, `docLibraryMaxBytes`
- Dynamic pool formula: `min(ragCandidatePoolPerDoc × N, ragCandidatePoolMax)` produces correct values for N=1,5,10,20
- `documents` table has `userId` column defaulting to `"default"`
- `documents` table has `badgeColour` column (non-null text)
- `document_chunks` table has `userId` column defaulting to `"default"`

**Changes**:

1. **`src/lib/config.ts`** — add alongside existing values:
   ```ts
   ragCandidatePoolPerDoc: 20,   // candidates per document in scope
   ragCandidatePoolMax: 100,     // absolute cap regardless of doc count
   docLibraryMaxCount: 50,       // max documents per user
   docLibraryMaxBytes: 524_288_000, // 500 MB in bytes
   ```
   Keep `ragCandidatePoolSize: 20` as a deprecated alias for backward-compat — callers in F003 code still reference it; update them in Phase 3.

2. **`src/modules/shared/db/schema.ts`** — add to `documents` table:
   ```ts
   userId: text('user_id').notNull().default('default'),
   badgeColour: text('badge_colour').notNull().default(''),
   ```
   Add index `idx_doc_user` on `userId`. Add to `document_chunks`:
   ```ts
   userId: text('user_id').notNull().default('default'),
   ```
   Add index `idx_chunk_user` on `userId`.

3. **`npx drizzle-kit push`** — apply schema changes to `data/neurodesk.db`.

**Migration safety**: Both columns have `DEFAULT` values so existing rows are backfilled automatically. No data loss.

---

### Phase 2 — Document Service (userId, badgeColour, limits, startup reset)

**Goal**: All document operations are userId-scoped; library caps are enforced; badge colours are stable and persisted; stuck `pending` docs are cleared on startup.

**TDD checkpoints**:
- `createDocument` with default userId returns `userId = "default"` on the record
- `createDocument` assigns a non-empty `badgeColour` from the palette at creation time
- `createDocument` rejects (409 / count-exceeded error) when library already has 50 docs
- `createDocument` rejects when adding the file would exceed 500 MB
- `listDocuments` only returns documents with `userId = "default"`
- `resetStuckDocuments()` transitions all `pending` → `failed` with the restart message
- `getLibraryUsage()` returns `{ count, totalBytes }` for userId

**Changes to `src/modules/rag/document-service.ts`**:
- Add `BADGE_PALETTE` constant (8 hex colours matching F003.5 design tokens)
- Add `assignBadgeColour(existingColours: string[]): string` — picks next unused colour from palette (cycles when exhausted)
- Add `getLibraryUsage(userId: string): { count: number; totalBytes: number }`
- Update `createDocument` to:
  - Accept `userId = "default"` parameter
  - Call `getLibraryUsage` and reject if either limit is exceeded
  - Call `assignBadgeColour` and persist to record
  - Scope `findByHash` to userId
- Update `listDocuments(userId: string)` — add `WHERE userId = ?` filter
- Update `getDocument`, `updateDocumentStatus`, `deleteDocument` — add userId to WHERE clauses
- Add `resetStuckDocuments(userId: string)` — `UPDATE documents SET status='failed', error_message='Interrupted by restart — please re-upload' WHERE status='pending' AND user_id=?`

**Changes to `src/app/api/documents/route.ts`**:
- Import `resetStuckDocuments`, `getLibraryUsage`
- Call `resetStuckDocuments("default")` once at module load time (runs on server startup)
- Add `usage: { count, totalBytes, maxCount, maxBytes }` to GET response
- Remove the hardcoded `MAX_FILE_SIZE_BYTES` check from route (now enforced in service layer); keep as a fast-fail pre-check before reading the buffer

---

### Phase 3 — Multi-Document Retrieval (filter + dynamic pool)

**Goal**: `retrieveChunks` and `retrieveAndRerank` support a `documentIds` filter; pool size scales with document count.

**TDD checkpoints**:
- `retrieveChunks` with `documentIds = [1, 2]` only returns chunks from those documents (chunks from doc 3 never appear)
- `retrieveChunks` with no filter returns chunks from all docs
- Dynamic pool: for N=3 docs, pool = min(60, 100) = 60; for N=8 docs, pool = 100
- `retrieveAndRerank` with filter passes `documentIds` through to `retrieveChunks`
- `RetrievedChunk` includes `documentId`, `similarityScore` (1 − distance)
- `Citation` includes `documentId`, `documentTitle`, `badgeColour`, `similarityScore`

**Changes to `src/modules/rag/retrieval-service.ts`**:

```ts
// Updated RetrievedChunk
export interface RetrievedChunk {
  chunkId: number;
  documentId: number;          // NEW
  content: string;
  pageNumber: number;
  documentName: string;
  distance: number;
  similarityScore: number;     // NEW — 1 - distance
  graphScore?: number;
}

// Updated Citation
export interface Citation {
  documentId: number;          // NEW
  documentTitle: string;       // renamed from documentName
  badgeColour: string;         // NEW
  pageNumber: number;
  excerpt: string;
  similarityScore: number;     // NEW
  graphScore?: number;
}
```

- `retrieveChunks(query, limit, documentIds?: number[])` — add `AND c.document_id IN (...)` to the SQL when filter is present; compute `similarityScore = 1 - distance`
- `computePoolSize(docCount: number): number` — `Math.min(config.ragCandidatePoolPerDoc * docCount, config.ragCandidatePoolMax)`
- `retrieveAndRerank(sessionId, query, documentIds?: number[])` — compute pool size from `documentIds?.length ?? (await countReadyDocuments())`, pass filter to `retrieveChunks`
- `formatCitations` — updated to produce `Citation` with all new fields (badgeColour looked up from document record)
- `formatRagContext` — updated format string: `Source: {title}, Page {n}, Sim: {x.xx}{, Graph: y}`

---

### Phase 4 — Cross-Document Graph Edges

**Goal**: `writeChunkNodes` stores `documentTitle`; after writing, a new helper detects shared tokens across chunks from different documents and creates `SIMILAR_TO` edges tagged `isCrossDocument: true`.

**TDD checkpoints**:
- `writeChunkNodes` with `documentTitle` stores it in node properties JSON
- `createCrossDocumentEdges(sessionId, chunks)` creates a `SIMILAR_TO` edge between two chunks from different documents that share ≥ 3 non-stopword tokens
- `createCrossDocumentEdges` does NOT create edges between chunks from the same document
- `createCrossDocumentEdges` is fire-and-forget — a thrown error is logged but does not propagate
- `rerankWithGraph` promotes a cross-document chunk with high edge weight above a same-document chunk with lower weight

**Changes to `src/modules/graph/graph-service.ts`**:

1. Extend `writeChunkNodes` chunk element type: add optional `documentTitle?: string` to properties JSON.

2. Add `createCrossDocumentEdges(sessionId: string, chunks: RetrievedChunkWithDoc[])`:
   - Group candidates by `documentId`
   - For each pair from different documents: compute shared non-stopword token set
   - If `|intersection| ≥ 3`: look up the CHUNK graph nodes for both chunk IDs, create a `SIMILAR_TO` edge with `weight = intersectionSize`, `properties = JSON.stringify({ isCrossDocument: true, sharedTokenCount: N })`
   - Wrapped in `try/catch` — failures logged, never thrown

3. Update `retrieveAndRerank` in `retrieval-service.ts` to call `createCrossDocumentEdges` after `writeChunkNodes` (fire-and-forget `void`).

**Stopword list**: 50-word English stopword set inlined as a `Set<string>` constant in `graph-service.ts`. No external dependency.

---

### Phase 5 — Chat API: Document Filter Integration

**Goal**: `POST /api/chat` accepts optional `documentIds: string[]` and threads it through to `retrieveAndRerank`.

**TDD checkpoints**:
- Chat route with `documentIds: ["1", "2"]` calls `retrieveAndRerank` with `[1, 2]` (number-parsed)
- Chat route with no `documentIds` calls `retrieveAndRerank` with `undefined`
- Zod schema rejects `documentIds` that are non-numeric strings

**Changes to `src/app/api/chat/route.ts`**:
- Add to Zod request schema: `documentIds: z.array(z.string().regex(/^\d+$/)).optional()`
- Parse to `number[]` before passing to service layer
- Thread through `handleChatMessage` → `retrieveAndRerank`

**Changes to `src/modules/chat/chat-service.ts`**:
- Add `documentIds?: number[]` to the options parameter of `handleChatMessage`
- Pass through to `retrieveAndRerank` call

---

### Phase 6 — Citation Format Upgrade

**Goal**: All citations in streamed responses carry `documentTitle`, `badgeColour`, `pageNumber`, `similarityScore`, and (when applicable) `graphScore`. Format strings and client-side `CitationPanel` updated accordingly.

**TDD checkpoints**:
- `formatCitations` returns `badgeColour` from the document record (not empty)
- `formatRagContext` produces `[Title, Page N, Sim: 0.87, Graph: 4]` when graphScore present
- `formatRagContext` produces `[Title, Page N, Sim: 0.87]` when graph fallback mode

**Changes to `src/components/CitationPanel.tsx`**:
- Render colour-coded badge using `badgeColour` hex value
- Show similarity score as a percentage pill (e.g., "87%")
- Show graph score badge only when `graphScore` is defined

---

### Phase 7 — Document Library UI

**Goal**: Library panel shows usage bar, per-doc progress polling, colour badges, and a document filter multi-select that sets `documentIds` on the next chat request.

**TDD checkpoints** (component-level):
- Library renders usage bar with correct count/bytes
- A document in `pending` status shows a spinner
- A document in `ready` status shows a green badge
- A document in `failed` status shows the error message
- Selecting 2 of 3 documents in the filter and submitting a chat message sends `documentIds` for only those 2
- Clearing the filter sends no `documentIds`

**Changes to `src/components/DocumentLibrary.tsx`**:
- Add `LibraryUsageBar` sub-component: `{count} / 50 documents · {mb} MB / 500 MB`
- Add polling: re-fetch document list every 3s when any document is in `pending` status (stop polling when all `ready` or `failed`)
- Add colour badge dot using `badgeColour` on each document row
- Add multi-select checkboxes for document filter; "Filtering: N docs" indicator shown in chat panel when active
- Expose `selectedDocumentIds: number[]` via context/prop to `ChatPanel`

**Changes to `src/components/DocumentUpload.tsx`**:
- Verify `<input multiple>` is already present; if not, add `multiple` attribute

---

### Phase 8 — Benchmark + README

**Prerequisite gate**: `specs/004-multi-document-rag-system/eval-set.md` MUST be committed before the benchmark script is written.

**eval-set.md** — 10 synthesis questions across a two-document test corpus. Each entry:
```markdown
### Q01
**Question**: ...
**Expected answer summary**: ...
**Requires**: Both Doc A (section X) and Doc B (section Y)
```

**`scripts/benchmark-multi-doc-rag.ts`**:
- Accepts `--doc-a <path>` and `--doc-b <path>` CLI flags
- Runs each of the 10 questions in two modes:
  - Mode A (single-doc best): query each doc separately, take higher-scoring answer
  - Mode B (multi-doc): query both simultaneously with graph reranking
- Scores each answer 0–1 via keyword recall against the expected answer
- Outputs `specs/004-multi-document-rag-system/benchmark.md`

**README update**:
- Add "Multi-Document RAG" section with Mermaid cross-document graph diagram
- Add document library and filter usage guide
- Add benchmark results table

---

## Dependency Order (must be respected)

```
Phase 1 (config + schema)
    ↓
Phase 2 (document service)
    ↓
Phase 3 (retrieval — filter + pool)  ←→  Phase 4 (graph — cross-doc edges)
    ↓                                           ↓
Phase 5 (chat API filter)
    ↓
Phase 6 (citation format)
    ↓
Phase 7 (UI)
    ↓
Phase 8 (benchmark + README — requires eval-set.md first)
```

Phases 3 and 4 can be developed in parallel (different files, no shared writes). All others are sequential.

---

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| sqlite-vec `k = ?` syntax doesn't support a `document_id IN (...)` filter in the same WHERE clause | Medium | The filter is applied to the JOIN with `document_chunks`, not inside the vec MATCH clause — this pattern is already in use (status filter) and is safe |
| Dynamic pool formula causes reranking timeout for large libraries | Low | Pool is capped at 100; `rerankWithGraph` is O(N²) only for edge lookup which is bounded by DB index scan |
| Cross-doc edge creation on 100-chunk pool causes write spike | Low | Edge creation is fire-and-forget async; it runs after the response is already streaming |
| `badgeColour` palette exhausted after 8 docs causes colour collisions | Low | Colour cycles — two documents may share a colour but remain visually distinct because they have different titles. Acceptable for v1. |
| `resetStuckDocuments` on startup races with an in-flight ingestion from a prior run | Negligible | Node.js is single-process; ingestion is async but the module-load reset runs synchronously before any request can trigger ingestion |
