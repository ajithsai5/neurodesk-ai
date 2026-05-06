# Data Model: Multi-Document RAG System (F004)

**Branch**: `004-multi-document-rag-system` | **Date**: 2026-05-05

---

## Schema Changes (additive only — no existing columns removed)

### Table: `documents` (existing — modified)

Two new columns added:

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `user_id` | `TEXT` | NOT NULL | `'default'` | Forward-compat slot for F006 multi-user; always `'default'` in F004 |
| `badge_colour` | `TEXT` | NOT NULL | `''` | Hex colour string (e.g. `#E86C3A`) assigned at upload time, persisted, stable across restarts |

New index: `idx_doc_user ON documents(user_id)`

**Status enum** (unchanged at DB level — existing `pending | ready | failed` values used; UI/API maps `pending → processing`, `ready → indexed` in display only):

| DB value | API/UI display |
|---|---|
| `pending` | processing |
| `ready` | indexed |
| `failed` | failed |

---

### Table: `document_chunks` (existing — modified)

One new column added:

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `user_id` | `TEXT` | NOT NULL | `'default'` | Denormalised from parent document; enables userId-scoped chunk queries without join |

New index: `idx_chunk_user ON document_chunks(user_id)`

---

### Virtual Table: `vec_document_chunks` (unchanged)

No DDL changes. The `userId` filter is applied via JOIN `document_chunks.user_id` — the vec virtual table schema is fixed by sqlite-vec.

---

## Entity Lifecycle Changes

### Document lifecycle (updated state machine)

```
           upload
              │
              ▼
          [ pending ]  ←── startup reset also targets this state
              │  \
     success  │   \  failure (any step: extract, chunk, embed)
              │    ──────────────────────────┐
              ▼                              ▼
          [ ready ]                      [ failed ]
              │                              │
              └──── user delete ─────────────┘
                         │
                         ▼
                   (hard delete — cascades to chunks,
                    vec embeddings, graph nodes, file on disk)
```

**Startup reset**: On application startup, any document with `status = 'pending'` is transitioned to `failed` with `error_message = 'Interrupted by restart — please re-upload'`. This handles the case where the server was killed during ingestion.

---

## New Types (TypeScript)

### `DocumentRecord` (updated)

```ts
// src/modules/rag/document-service.ts
export interface DocumentRecord {
  id: number;
  userId: string;          // NEW — always "default" in F004
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  pageCount: number | null;
  status: 'pending' | 'ready' | 'failed';
  contentHash: string;
  errorMessage: string | null;
  badgeColour: string;     // NEW — hex colour, persisted
  createdAt: string;
}
```

### `LibraryUsage` (new)

```ts
export interface LibraryUsage {
  count: number;       // number of documents for userId
  totalBytes: number;  // sum of file_size for userId
  maxCount: number;    // config.docLibraryMaxCount (50)
  maxBytes: number;    // config.docLibraryMaxBytes (524_288_000)
}
```

### `RetrievedChunk` (updated)

```ts
// src/modules/rag/retrieval-service.ts
export interface RetrievedChunk {
  chunkId: number;
  documentId: number;       // NEW — FK to documents.id
  content: string;
  pageNumber: number;
  documentName: string;     // original_name (display title)
  distance: number;         // raw cosine distance
  similarityScore: number;  // NEW — 1 - distance (0.0–1.0)
  graphScore?: number;      // graph edge weight sum (when reranking active)
}
```

### `Citation` (updated)

```ts
// src/modules/rag/retrieval-service.ts
export interface Citation {
  documentId: number;       // NEW
  documentTitle: string;    // renamed from documentName
  badgeColour: string;      // NEW — from documents.badge_colour
  pageNumber: number;
  excerpt: string;
  similarityScore: number;  // NEW — 0.0–1.0, two decimal places in display
  graphScore?: number;      // present only when graph reranking was active
}
```

### `DocumentFilter` (new)

```ts
// Sent as part of POST /api/chat request body
export interface DocumentFilter {
  documentIds: number[]; // empty array = no filter (search all)
}
```

---

## Config Values Added (`src/lib/config.ts`)

| Key | Value | Replaces |
|---|---|---|
| `ragCandidatePoolPerDoc` | `20` | `ragCandidatePoolSize` (deprecated alias kept for F003 backward compat) |
| `ragCandidatePoolMax` | `100` | — |
| `docLibraryMaxCount` | `50` | (was implementation-time decision) |
| `docLibraryMaxBytes` | `524_288_000` | (was implementation-time decision) |

---

## Badge Colour Palette

Stored in `src/modules/rag/document-service.ts` as a const array. 8 colours from F003.5 design tokens:

```ts
export const BADGE_PALETTE = [
  '#E86C3A', // amber-orange  (primary accent)
  '#4A9EDB', // blue
  '#5BB974', // green
  '#C678A0', // purple
  '#E8A23A', // gold
  '#5BC4C4', // teal
  '#DB7B5A', // coral
  '#8C8CDB', // lavender
] as const;
```

Assignment: `BADGE_PALETTE[existingDocCount % BADGE_PALETTE.length]` at upload time.

---

## Graph Node Properties Schema (extended)

CHUNK nodes in `graph_nodes.properties` now include two additional optional fields:

```json
{
  "chunkId": "42",
  "documentId": "7",
  "documentTitle": "Research Paper A.pdf",
  "pageNumber": 3,
  "similarityScore": 0.87,
  "retrievedAt": 1746432000000
}
```

Cross-document `SIMILAR_TO` edges in `graph_edges` now carry metadata in a `properties` column — **however**, `graph_edges` does not currently have a `properties` column. F004 adds it:

### Table: `graph_edges` (existing — modified)

One new column added:

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `properties` | `TEXT` | NOT NULL | `'{}'` | JSON blob; cross-doc edges store `{ isCrossDocument: true, sharedTokenCount: N }` |

---

## Migration Safety

All schema changes use `DEFAULT` values:
- `documents.user_id DEFAULT 'default'` — backfills all existing rows
- `documents.badge_colour DEFAULT ''` — backfills all existing rows (empty string; UI treats empty as no badge, documents uploaded before F004 will appear without a badge until re-uploaded)
- `document_chunks.user_id DEFAULT 'default'` — backfills all existing rows
- `graph_edges.properties DEFAULT '{}'` — backfills all existing rows

**No data migration required.** `npx drizzle-kit push` applies all changes atomically.
