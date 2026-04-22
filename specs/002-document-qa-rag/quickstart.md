# Quickstart: Document Q&A (Mini RAG)

**Feature**: 002-document-qa-rag  
**Date**: 2026-04-22

---

## Prerequisites

1. **Ollama running** with both required models pulled:
   ```bash
   ollama pull llama3.1:8b
   ollama pull nomic-embed-text
   ```
   Verify: `curl http://localhost:11434/api/tags` should list both models.
   
   If Ollama uses a non-default model directory (`G:\Ollama\Model`), set the env var before starting Ollama:
   ```
   OLLAMA_MODELS=G:\Ollama\Model ollama serve
   ```

2. **Node.js 20+** and **npm** installed.

3. **Existing dev environment** from Feature 01 working (`npm run dev` starts on port 3000).

---

## Install New Dependencies

```bash
npm install sqlite-vec pdf-parse
npm install --save-dev @types/pdf-parse
```

---

## Database Migration

After adding the new tables to `schema.ts` and the sqlite-vec extension to `db/index.ts`:

```bash
npx drizzle-kit push
```

The `vec_document_chunks` virtual table is created automatically by `db/index.ts` on first connection (not managed by Drizzle Kit).

---

## Create Document Storage Directory

```bash
mkdir -p data/documents
```

Ensure `data/documents/` is in `.gitignore` (the `data/` directory is already gitignored).

---

## Run the App

```bash
npm run dev
```

Navigate to `http://localhost:3000`. The document library panel should appear alongside the chat interface.

---

## Verify the Pipeline End-to-End

1. Open a conversation.
2. Upload a small PDF (< 5 pages) using the document upload button.
3. Wait for the status badge to change from **Pending** → **Ready** (typically 5–30 seconds for a small doc).
4. Ask: *"What is the main topic of this document?"*
5. The response should include text grounded in the document with a `[DocumentName, Page N]` citation.

---

## Verify Local-Only Mode

With Ollama running:

1. Open browser DevTools → Network tab.
2. Upload a PDF and ask a question.
3. Confirm zero requests to `api.openai.com` or `api.anthropic.com`.
4. All traffic should go to `localhost:11434` (embeddings + generation).

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Embedding failed: Ollama unreachable" | Ollama not running | Run `ollama serve` |
| Document stuck in `pending` | Embedding model not pulled | `ollama pull nomic-embed-text` |
| `sqlite-vec` not found error | Extension not loading | Check `npm install sqlite-vec`; restart dev server |
| Empty text extraction | Scanned PDF (image-only) | v1 does not support OCR; use a text-based PDF |
| 409 on upload | Same file already in library | Delete the existing document and re-upload |

---

## Running Tests

```bash
# Unit tests for the RAG module
npx vitest run __tests__/modules/rag/

# Integration test for the documents API
npx vitest run __tests__/integration/documents-api.test.ts

# E2E (requires dev server running)
npm run test:e2e -- e2e/document-qa.spec.ts
```
