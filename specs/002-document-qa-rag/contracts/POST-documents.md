# Contract: POST /api/documents

Upload a document to the user's global library. Triggers async ingestion (extraction → chunking → embedding → indexing).

---

## Request

**Method**: POST  
**Path**: `/api/documents`  
**Content-Type**: `multipart/form-data`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | File (Blob) | Yes | PDF or plain text. Max 50 MB. |

---

## Validation (server-side, in order)

1. `file` field present → 400 if missing
2. MIME type is `application/pdf` or `text/plain` → 400 if unsupported
3. File size ≤ 50 MB (52,428,800 bytes) → 400 if exceeded
4. SHA-256 hash does not match an existing document → 409 if duplicate

---

## Responses

### 202 Accepted — Upload received, processing started

```json
{
  "id": 42,
  "status": "pending",
  "originalName": "annual-report-2025.pdf",
  "createdAt": "2026-04-22T10:00:00.000Z"
}
```

Processing continues asynchronously. Poll `GET /api/documents/42` for status updates.

### 400 Bad Request — Validation failure

```json
{ "error": "Unsupported file type. Supported formats: PDF, plain text (.txt)" }
```

```json
{ "error": "File exceeds maximum size of 50 MB" }
```

```json
{ "error": "No file provided" }
```

### 409 Conflict — Duplicate document

```json
{
  "error": "Document already in library",
  "existingId": 17
}
```

### 500 Internal Server Error

```json
{ "error": "Upload failed. Please try again." }
```

---

## Side Effects

- File written to `data/documents/<uuid>.<ext>` (UUID prevents path traversal)
- Row inserted into `documents` table with `status = 'pending'`
- Async ingestion pipeline started:
  1. Extract text + page numbers
  2. Update `page_count`, validate ≤ 200 pages
  3. Split into 512-token / 64-overlap chunks
  4. Generate embeddings via Ollama `nomic-embed-text`
  5. Insert into `document_chunks` + `vec_document_chunks`
  6. Update `status` to `ready` (or `failed` with `error_message`)
