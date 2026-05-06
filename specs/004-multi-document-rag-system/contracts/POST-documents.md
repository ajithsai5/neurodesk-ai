# Contract: POST /api/documents

**Feature**: F004 — Multi-Document RAG System  
**Status**: Updated (extends F002 contract — adds library limit enforcement)

---

## Request

```
POST /api/documents
Content-Type: multipart/form-data
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | `File` | Yes | PDF (application/pdf) or plain text (text/plain) |

---

## Response — 202 Accepted

Upload accepted; ingestion running asynchronously. Poll `GET /api/documents/{id}` for status.

```json
{
  "id": 8,
  "status": "pending",
  "originalName": "Technical Report B.pdf",
  "createdAt": "2026-05-05T10:05:00.000Z"
}
```

---

## Response — 400 Bad Request

Returned for validation failures. `code` field identifies the specific rejection reason.

```jsonc
// Missing or non-File field
{ "error": "No file provided" }

// Unsupported MIME type
{ "error": "Unsupported file type. Supported formats: PDF (.pdf), plain text (.txt)" }

// File exceeds per-file size limit (50 MB)
{ "error": "File exceeds maximum size of 50 MB" }

// Library count limit reached — NEW in F004
{
  "error": "Document limit reached: 50 / 50 documents",
  "code": "LIBRARY_COUNT_LIMIT"
}

// Library storage limit reached — NEW in F004
{
  "error": "Storage limit reached: 498 MB of 500 MB used",
  "code": "LIBRARY_STORAGE_LIMIT"
}
```

---

## Response — 409 Conflict

File with identical content already exists in the library (SHA-256 deduplication).

```json
{
  "error": "Document already in library",
  "existingId": 5
}
```

---

## Response — 500 Internal Server Error

```json
{ "error": "Upload failed. Please try again." }
```

---

## Validation Order

1. File present and is a `File` instance
2. MIME type in allowed list
3. File size ≤ 50 MB (fast pre-check before reading buffer)
4. SHA-256 dedup check (requires reading buffer)
5. Library count ≤ 50 (checked in service layer before DB insert)
6. Library storage ≤ 500 MB (checked in service layer before DB insert)
