# Data Model — F003: AI Code Assistant + Graph-Enhanced RAG

## Updated Types

### `RetrievedChunk` (extended)

```typescript
// src/modules/rag/retrieval-service.ts
export interface RetrievedChunk {
  chunkId: number;
  content: string;
  pageNumber: number;
  documentName: string;
  distance: number;       // cosine distance (lower = more similar)
  graphScore?: number;    // NEW: optional graph edge-weight sum (higher = more connected)
}
```

`graphScore` is populated by the calling code after `rerankWithGraph()` returns — or set manually by callers that have weight information. It is **not** written by `retrieveAndRerank()` in the current implementation (the reranked order is the signal; an explicit score is a future enhancement).

---

### `Citation` (extended)

```typescript
// src/modules/rag/retrieval-service.ts
export interface Citation {
  documentName: string;
  pageNumber: number;
  excerpt: string;
  graphScore?: number;    // NEW: passed through from chunk when present
}
```

`formatCitations()` copies `graphScore` from the chunk to the citation when defined. The CitationPanel renders a badge when `graphScore !== undefined`.

---

### `GenerateCodeRequest` / `GenerateCodeResponse`

```typescript
// src/modules/code/types.ts
export interface GenerateCodeRequest {
  language: string;       // e.g. "typescript", "python"
  description: string;    // max 2000 chars
  sessionId?: string;     // used for graph context lookup
}

export interface GenerateCodeResponse {
  code: string;
}
```

---

### `ExplainCodeRequest` / `ExplainCodeResponse`

```typescript
export interface ExplainCodeRequest {
  code: string;           // max 10 000 chars
  language?: string;      // optional hint for system prompt
  sessionId?: string;
}

export interface ExplainCodeResponse {
  explanation: string;
}
```

---

## RAG Pipeline Concept: Ranked Chunk Pool

```
retrieveChunks(query, ragCandidatePoolSize=20)
    ↓  20 candidates ordered by cosine similarity
writeChunkNodes(sessionId, candidates)
    ↓  writes CHUNK nodes + PART_OF edges into the graph
rerankWithGraph(sessionId, candidates)
    ↓  sorts by accumulated edge-weight-sum (descending)
.slice(0, ragFinalContextSize=5)
    ↓  top-5 returned for LLM context injection
```

Chunks that appear repeatedly across sessions accumulate higher edge-weight sums and are promoted in future retrievals — a simple positive-feedback loop.

---

## API Contracts

| Route | Method | Request | Response |
|-------|--------|---------|----------|
| `/api/code/generate` | POST | `{ language, description, sessionId? }` | `{ code }` or `{ error }` |
| `/api/code/explain`  | POST | `{ code, language?, sessionId? }` | `{ explanation }` or `{ error }` |

**Validation limits**: `description` max 2 000 chars · `code` max 10 000 chars  
**Error codes**: 400 (validation) · 500 (LLM failure / no provider)
