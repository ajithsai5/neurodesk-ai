# Contract: GET /api/documents

List all documents in the user's global library, ordered by most recently uploaded.

---

## Request

**Method**: GET  
**Path**: `/api/documents`  
**Query Parameters**: none

---

## Response

### 200 OK

```json
{
  "documents": [
    {
      "id": 42,
      "originalName": "annual-report-2025.pdf",
      "mimeType": "application/pdf",
      "fileSize": 2097152,
      "pageCount": 48,
      "status": "ready",
      "errorMessage": null,
      "createdAt": "2026-04-22T10:00:00.000Z"
    },
    {
      "id": 41,
      "originalName": "notes.txt",
      "mimeType": "text/plain",
      "fileSize": 4096,
      "pageCount": null,
      "status": "failed",
      "errorMessage": "Embedding failed: Ollama unreachable at http://localhost:11434",
      "createdAt": "2026-04-21T09:30:00.000Z"
    },
    {
      "id": 40,
      "originalName": "draft.pdf",
      "mimeType": "application/pdf",
      "fileSize": 512000,
      "pageCount": null,
      "status": "pending",
      "errorMessage": null,
      "createdAt": "2026-04-22T10:05:00.000Z"
    }
  ]
}
```

**Field notes**:
- `pageCount`: null while `status = pending`; null for `.txt` files (not applicable)
- `errorMessage`: null unless `status = failed`
- `fileSize`: bytes
- `storedName` and `filePath` are **not** returned (internal only)

### 500 Internal Server Error

```json
{ "error": "Failed to load document library." }
```
