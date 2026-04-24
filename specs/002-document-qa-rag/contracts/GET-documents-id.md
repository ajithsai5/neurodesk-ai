# Contract: GET /api/documents/[id]

Get details and current processing status of a single document. Used for polling after upload.

---

## Request

**Method**: GET  
**Path**: `/api/documents/:id`  
**Path Parameter**: `id` — integer document ID

---

## Responses

### 200 OK

```json
{
  "id": 42,
  "originalName": "annual-report-2025.pdf",
  "mimeType": "application/pdf",
  "fileSize": 2097152,
  "pageCount": 48,
  "status": "ready",
  "errorMessage": null,
  "createdAt": "2026-04-22T10:00:00.000Z"
}
```

Same shape as a single item from `GET /api/documents`. `storedName` and `filePath` are not returned.

### 400 Bad Request — Invalid ID

```json
{ "error": "Invalid document ID" }
```

### 404 Not Found

```json
{ "error": "Document not found" }
```

### 500 Internal Server Error

```json
{ "error": "Failed to load document." }
```

---

## Usage Pattern (polling)

After `POST /api/documents` returns `status: "pending"`, the client polls this endpoint until `status` is `"ready"` or `"failed"`. Recommended poll interval: 2 seconds. Timeout after 120 seconds.
