# Quickstart: Multi-Document RAG System (F004)

**Branch**: `004-multi-document-rag-system`

---

## Prerequisites

Same as F002/F003:
- Node.js 18+, npm
- Ollama running locally with `nomic-embed-text` and `llama3.1:8b` pulled (for local mode)
- OR a valid OpenAI / Anthropic API key in `.env.local`

---

## Setup

```bash
# Install dependencies (no new packages for F004)
npm install

# Apply schema changes (adds userId, badgeColour, graph_edges.properties columns)
npx drizzle-kit push

# Seed default personas and providers (if starting fresh)
npm run db:seed

# Start the dev server
npm run dev
```

---

## Upload Multiple Documents

1. Open **http://localhost:3000**
2. Click **Documents** in the left navigation
3. Drag-and-drop two or more PDFs (or use the file picker — multi-select supported)
4. Watch each document's status badge:
   - 🔄 **Processing** — ingestion in progress
   - ✅ **Indexed** — ready to query
   - ❌ **Failed** — hover to see error; delete and re-upload to retry
5. Each document gets a colour-coded badge that persists across restarts

Library limits: **50 documents max · 500 MB total**. The usage bar in the library header shows current utilisation.

---

## Ask a Cross-Document Question

1. Open any **Chat** conversation
2. The filter bar above the chat input shows **"All documents"** by default
3. Type a question that spans multiple documents, e.g.:
   > "What do these documents agree on regarding attention mechanisms?"
4. The answer cites each source with its colour badge, page number, similarity score, and graph connectivity score:
   > [Research Paper A.pdf, Page 8, Sim: 0.87, Graph: 4]
   > [Technical Report B.pdf, Page 3, Sim: 0.71, Graph: 2]

---

## Filter to Specific Documents

1. Click **"All documents"** filter bar above the chat input
2. Deselect documents you want to exclude — or click a single document to scope to it alone
3. The filter indicator updates: **"Filtering: 2 of 5 docs"**
4. Submit your question — only the selected documents' chunks enter the candidate pool

---

## Run the Benchmark

```bash
# 1. Ensure eval-set.md is committed first
# 2. Place your two test documents somewhere accessible
npx tsx scripts/benchmark-multi-doc-rag.ts \
  --doc-a data/test/paper-a.pdf \
  --doc-b data/test/report-b.pdf

# Results written to:
# specs/004-multi-document-rag-system/benchmark.md
```

---

## Run Tests

```bash
# Unit + integration tests for F004 changes
npm test

# Single test file
npx vitest run __tests__/modules/rag/document-service.test.ts
npx vitest run __tests__/modules/rag/retrieval-service.test.ts
npx vitest run __tests__/modules/graph/graph-service.test.ts
npx vitest run __tests__/integration/multi-doc-rag.test.ts
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Document stuck on "Processing" after restart | Server was killed mid-ingestion | Status auto-resets to "Failed" on next startup — delete and re-upload |
| "Document limit reached" on upload | Library has 50 documents | Delete old documents to free slots |
| Citations show no `Graph Score` | Graph store empty (first query) | Ask a second question — graph edges build up after each retrieval |
| Badge colour is empty (old document) | Document uploaded before F004 migration | Re-upload to assign a badge colour |
| Filter active but getting results from excluded docs | Stale filter state in UI | Refresh the page; filter state resets to "All documents" |
