# Contract: GET /api/documents

**Feature**: F004 — Multi-Document RAG System  
**Status**: Updated (extends F002 contract)

---

## Request

```
GET /api/documents
```

No parameters, no body.

---

## Response — 200 OK

```jsonc
{
  "documents": [
    {
      "id": 7,
      "originalName": "Research Paper A.pdf",
      "mimeType": "application/pdf",
      "fileSize": 1048576,
      "pageCount": 42,
      "status": "ready",          // "pending" | "ready" | "failed"
      "errorMessage": null,       // string when status = "failed", null otherwise
      "badgeColour": "#E86C3A",   // NEW — hex colour, stable across restarts
      "createdAt": "2026-05-05T10:00:00.000Z"
      // storedName, filePath, contentHash, userId intentionally omitted
    }
  ],
  "usage": {                      // NEW — library utilisation for the current user
    "count": 12,
    "totalBytes": 52428800,
    "maxCount": 50,
    "maxBytes": 524288000
  }
}
```

**Status display mapping** (UI only — DB stores `pending | ready | failed`):

| DB status | UI label |
|---|---|
| `pending` | Processing |
| `ready` | Indexed |
| `failed` | Failed |

---

## Response — 500 Internal Server Error

```json
{ "error": "Failed to load document library." }
```
