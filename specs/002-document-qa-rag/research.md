# Phase 0 Research: Document Q&A (Mini RAG)

**Feature**: 002-document-qa-rag  
**Date**: 2026-04-22

---

## Decision 1: PDF Text Extraction Library

**Decision**: `pdf-parse` (npm)

**Rationale**: Returns page-by-page text with page number metadata, zero native dependencies on Windows, simple API (`pdf(buffer) → { text, numpages, pages[] }`). Sufficient for text-based PDFs (scanned/OCR out of scope for v1).

**Alternatives considered**:
- `pdfjs-dist` — More accurate for complex layouts but requires Worker setup and is heavier (~3 MB). Overhead not justified for v1.
- `pdf2pic` + OCR — Out of scope; spec explicitly excludes scanned PDFs.

---

## Decision 2: Vector Store

**Decision**: `sqlite-vec` npm package loaded as a better-sqlite3 extension

**Rationale**: Reuses the existing `data/neurodesk.db` SQLite file — zero new processes or infrastructure. `sqlite-vec` exposes a `vec0` virtual table with cosine-similarity search. Loading pattern: `sqliteVec.load(sqlite)` in `src/modules/shared/db/index.ts` before Drizzle wraps the connection.

```typescript
// db/index.ts addition
import * as sqliteVec from 'sqlite-vec';
sqliteVec.load(sqlite); // load extension into the better-sqlite3 instance
```

**Virtual table** (raw SQL, not managed by Drizzle):
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding FLOAT[768]
);
```

**Query pattern** (top-5 cosine similarity):
```sql
SELECT chunk_id, distance
FROM vec_document_chunks
WHERE embedding MATCH ?
ORDER BY distance
LIMIT 5
```

**Alternatives considered**:
- `chromadb` — Separate process, heavier setup, not justified for single-user local tool.
- `hnswlib-node` — Requires serializing index to disk manually; no SQLite integration.
- `faiss-node` — Windows build issues; heavy binary dependency.

---

## Decision 3: Embedding Model & API

**Decision**: Ollama REST API — `nomic-embed-text` model, 768-dim output

**Endpoint**: `POST http://localhost:11434/api/embed`

```typescript
// Request
{ model: 'nomic-embed-text', input: 'text to embed' }

// Response  
{ embeddings: [[0.12, -0.45, ...]] }  // 768-dimensional float array
```

**Rationale**: `nomic-embed-text` is optimized for retrieval tasks and produces 768-dim embeddings — a widely-supported dimension size. Calling Ollama's REST API directly avoids adding a new SDK dependency. The existing project already calls external HTTP services (LLM providers).

**Dimension consistency**: All embeddings use 768 dims. If a cloud fallback (OpenAI) is added post-v1, `text-embedding-3-small` supports a `dimensions: 768` parameter to match.

**Alternatives considered**:
- `@ai-sdk/openai` embeddings — Cloud-only; defeats the "no external API calls" requirement for local mode.
- `ollama-ai-provider` — Community SDK; adds a dependency for functionality achievable with a direct `fetch` call.

---

## Decision 4: Text Chunking Tokenizer

**Decision**: Reuse `js-tiktoken` with `cl100k_base` encoding (already in project)

**Parameters**: 512 tokens per chunk, 64-token overlap (confirmed in clarifications)

**Rationale**: `js-tiktoken` is already installed for the context window module. Using the same encoder avoids a second tokenizer dependency and keeps token counts consistent across the codebase. `cl100k_base` is a reasonable approximation for `nomic-embed-text`'s token budget.

**Chunking algorithm**: Sliding window over sentences. Encode full text → split at token boundaries → emit overlapping windows of 512 with 64-token stride back.

---

## Decision 5: Ollama Generation Provider

**Decision**: Extend `getLLMModel()` with an `ollama` case using `createOpenAI` pointed at Ollama's OpenAI-compatible endpoint

```typescript
// llm-client.ts addition
case 'ollama':
  return createOpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama', // required by SDK, value ignored by Ollama
  })(modelId);
```

**Rationale**: Ollama exposes an OpenAI-compatible REST API at `/v1`. Using `createOpenAI` with a custom `baseURL` avoids adding `ollama-ai-provider` as a dependency. The existing `streamText()` path works unchanged.

**Alternatives considered**:
- `ollama-ai-provider` — Adds a dependency for something `createOpenAI` covers natively.
- Direct Ollama `/api/generate` — Non-streaming compatible with Vercel AI SDK's `toDataStreamResponse()` would require adapter work.

---

## Decision 6: File Storage

**Decision**: Local filesystem at `data/documents/`, files renamed to `<uuid>.<ext>`

**Rationale**: Simple, no new dependencies. UUID filenames prevent path traversal (original filename stored in DB only). `data/` is already gitignored.

**Security**: File path stored in DB is always `data/documents/<uuid>.<ext>`. The original filename is stored separately and never used to construct file system paths.

---

## Decision 7: RAG Context Injection in Chat

**Decision**: Extend the existing `/api/chat` route handler to run similarity search when documents exist, prepend retrieved chunks to the system prompt.

**Rationale**: Avoids creating a new `/api/rag/query` endpoint. The chat route already handles system prompts and streaming. RAG context becomes part of the system message only when documents are present (FR-017 fallback behavior preserved).

**System prompt injection format**:
```
[DOCUMENT CONTEXT]
--- Source: report.pdf, Page 3 ---
<chunk text>

--- Source: report.pdf, Page 5 ---
<chunk text>
[END DOCUMENT CONTEXT]

Answer the user's question using ONLY the document context above. 
If the answer is not in the documents, say so explicitly.
Cite sources as [DocumentName, Page N].
```

---

## Decision 8: Duplicate Detection

**Decision**: SHA-256 hash of raw file bytes, computed server-side on upload

```typescript
import { createHash } from 'crypto';
const hash = createHash('sha256').update(fileBuffer).digest('hex');
```

**Rationale**: Detects identical files regardless of filename. `crypto` is a Node.js built-in — no new dependency.

---

## New Dependencies Summary

| Package | Version | Purpose |
|---------|---------|---------|
| `sqlite-vec` | latest | Vector similarity search in SQLite |
| `pdf-parse` | latest | PDF text extraction with page numbers |
| `@types/pdf-parse` | latest | TypeScript types for pdf-parse |

No new LLM SDK packages required. Ollama generation reuses `@ai-sdk/openai` with custom baseURL. Ollama embeddings use native `fetch`.
