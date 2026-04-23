# Contract: DELETE /api/documents/[id]

Permanently delete a document from the library. Removes the stored file, all chunk records, and all vector index entries.

---

## Request

**Method**: DELETE  
**Path**: `/api/documents/:id`  
**Path Parameter**: `id` — integer document ID

---

## Responses

### 200 OK

```json
{ "success": true }
```

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
{ "error": "Failed to delete document." }
```

---

## Side Effects (executed in order)

1. Delete from `vec_document_chunks` WHERE chunk_id IN (SELECT id FROM document_chunks WHERE document_id = ?)
2. Delete from `document_chunks` WHERE document_id = ? (also handled by cascade)
3. Delete from `documents` WHERE id = ?
4. Delete file from `data/documents/<stored_name>`

**Atomicity**: Steps 1–3 are wrapped in a SQLite transaction. File deletion (step 4) happens after the transaction commits. If the file is already missing from disk, the operation still returns 200 (idempotent file cleanup).

**Documents in `pending` status can also be deleted** — the user may cancel a long-running upload/processing job this way.
