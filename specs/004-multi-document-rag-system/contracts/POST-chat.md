# Contract: POST /api/chat

**Feature**: F004 — Multi-Document RAG System  
**Status**: Updated (extends F001/F003 contract — adds optional documentIds filter)

---

## Request

```
POST /api/chat
Content-Type: application/json
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `conversationId` | `string` | Yes | UUID of the active conversation |
| `message` | `string` | Yes | User message, max 10,000 characters |
| `documentIds` | `string[]` | No | **NEW** — numeric document IDs as strings (e.g. `["1","3"]`). When present and non-empty, RAG retrieval is restricted to exactly these documents. When absent or empty, all indexed documents are searched. Each value must match `/^\d+$/`. |

```jsonc
// Example — filter active
{
  "conversationId": "conv-abc123",
  "message": "What do these two papers agree on?",
  "documentIds": ["3", "7"]
}

// Example — no filter (search all documents)
{
  "conversationId": "conv-abc123",
  "message": "Summarise the key findings"
}
```

---

## Response — 200 OK (SSE stream)

Server-sent events stream (Vercel AI SDK `toDataStreamResponse()` format). Unchanged from F003 except citations now carry additional fields.

**Citation shape in stream annotations** (updated):

```jsonc
{
  "type": "citations",
  "citations": [
    {
      "documentId": 3,              // NEW
      "documentTitle": "Paper A.pdf",
      "badgeColour": "#E86C3A",     // NEW — hex, matches DocumentLibrary badge
      "pageNumber": 12,
      "excerpt": "...relevant passage...",
      "similarityScore": 0.87,      // NEW — 0.0–1.0, two decimal places
      "graphScore": 4               // present only when graph reranking was active
    },
    {
      "documentId": 7,
      "documentTitle": "Report B.pdf",
      "badgeColour": "#4A9EDB",
      "pageNumber": 3,
      "excerpt": "...relevant passage...",
      "similarityScore": 0.74
      // graphScore absent — graph fallback mode for this chunk
    }
  ]
}
```

**Candidate pool size** (transparent to client, documented here for test authors):

`candidatePoolSize = min(20 × N, 100)` where N = number of in-scope documents (filter size, or total ready library size when no filter active).

---

## Response — 400 Bad Request

```jsonc
// documentIds contains non-numeric string
{ "error": "Invalid input", "details": "documentIds must contain only numeric strings" }

// message empty or too long
{ "error": "Invalid input" }
```

---

## Response — 500 Internal Server Error

```json
{ "error": "An error occurred while processing your request." }
```
