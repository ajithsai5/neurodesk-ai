# Data Model: Document Q&A (Mini RAG)

**Feature**: 002-document-qa-rag  
**Date**: 2026-04-22

---

## Entity Overview

```
documents ──< document_chunks >── vec_document_chunks (virtual)
                                       ↑
                              (chunk_id FK, cosine search)
```

---

## Table: `documents`

Managed by Drizzle ORM. Integer primary key required for sqlite-vec join.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `original_name` | TEXT | NOT NULL | Display name shown in UI |
| `stored_name` | TEXT | NOT NULL | UUID-based filename on disk (`<uuid>.pdf`) |
| `file_path` | TEXT | NOT NULL | Absolute path: `data/documents/<uuid>.<ext>` |
| `mime_type` | TEXT | NOT NULL | `application/pdf` or `text/plain` |
| `file_size` | INTEGER | NOT NULL | Bytes |
| `page_count` | INTEGER | nullable | Populated after extraction; null while pending |
| `status` | TEXT | NOT NULL, enum | `pending` \| `ready` \| `failed` |
| `content_hash` | TEXT | NOT NULL, UNIQUE | SHA-256 hex of raw file bytes; deduplication key |
| `error_message` | TEXT | nullable | Populated on status=`failed` |
| `created_at` | TEXT | NOT NULL | ISO-8601 datetime |

**Indexes**:
- UNIQUE on `content_hash` (deduplication)
- Index on `status` (list filtering)

**State transitions**:
```
          upload
[pending] ──────> processing ──> [ready]
                              └──> [failed]  (error_message populated)

[ready | failed] ──> DELETE (user-initiated; cascades to chunks + vec entries)
```

**Note**: No in-place retry. User must DELETE a failed document and re-upload.

---

## Table: `document_chunks`

Managed by Drizzle ORM. Cascade-deletes when parent document is deleted.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK, autoincrement | Also the PK in `vec_document_chunks` |
| `document_id` | INTEGER | NOT NULL, FK → documents.id (cascade) | |
| `page_number` | INTEGER | NOT NULL | 1-indexed source page |
| `chunk_index` | INTEGER | NOT NULL | 0-indexed position within document |
| `content` | TEXT | NOT NULL | Raw text of the chunk |
| `token_count` | INTEGER | NOT NULL | Actual token count (≤ 512) |
| `created_at` | TEXT | NOT NULL | ISO-8601 datetime |

**Indexes**:
- Index on `document_id` (load all chunks for a document)
- Composite index on `(document_id, chunk_index)` (ordered retrieval)

---

## Virtual Table: `vec_document_chunks`

Managed by sqlite-vec. Created via raw SQL (not Drizzle-managed). One row per chunk.

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding FLOAT[768]
);
```

| Column | Type | Notes |
|--------|------|-------|
| `chunk_id` | INTEGER | PK, matches `document_chunks.id` |
| `embedding` | FLOAT[768] | 768-dim vector from `nomic-embed-text` |

**Deletion**: When a document is deleted, its chunks are deleted via cascade. The vec rows must be deleted explicitly before or after the chunk deletion:
```sql
DELETE FROM vec_document_chunks WHERE chunk_id IN (
  SELECT id FROM document_chunks WHERE document_id = ?
);
```

**Query pattern** (top-5 retrieval):
```sql
SELECT v.chunk_id, v.distance, c.content, c.page_number, d.original_name
FROM vec_document_chunks v
JOIN document_chunks c ON c.id = v.chunk_id
JOIN documents d ON d.id = c.document_id
WHERE v.embedding MATCH ?
  AND d.status = 'ready'
ORDER BY v.distance
LIMIT 5
```

---

## Runtime Type: `Citation` (not persisted)

Constructed at query time from retrieval results. Passed to the LLM and returned in the API response.

```typescript
interface Citation {
  documentName: string;   // original_name from documents table
  pageNumber: number;     // page_number from document_chunks
  excerpt: string;        // first ~200 chars of chunk content (preview)
  chunkId: number;        // document_chunks.id
}
```

---

## Runtime Type: `RetrievalResult` (not persisted)

```typescript
interface RetrievalResult {
  chunks: Array<{
    content: string;
    citation: Citation;
    distance: number;     // cosine distance (lower = more similar)
  }>;
}
```

---

## Schema Changes to Existing Files

### `src/modules/shared/db/schema.ts`

Add at end of file:

```typescript
export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  originalName: text('original_name').notNull(),
  storedName: text('stored_name').notNull(),
  filePath: text('file_path').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  pageCount: integer('page_count'),
  status: text('status', { enum: ['pending', 'ready', 'failed'] }).notNull().default('pending'),
  contentHash: text('content_hash').notNull().unique(),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_doc_status').on(table.status),
]);

export const documentChunks = sqliteTable('document_chunks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_chunk_doc').on(table.documentId),
  index('idx_chunk_doc_order').on(table.documentId, table.chunkIndex),
]);
```

### `src/modules/shared/db/index.ts`

Add sqlite-vec extension loading before the Drizzle instance is created:

```typescript
import * as sqliteVec from 'sqlite-vec';

// ... existing sqlite setup ...
sqlite.pragma('foreign_keys = ON');

// Load sqlite-vec extension for vector similarity search
sqliteVec.load(sqlite);

// Create vec_document_chunks virtual table if it doesn't exist
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
    chunk_id INTEGER PRIMARY KEY,
    embedding FLOAT[768]
  )
`);

export const db = drizzle(sqlite, { schema });
```
