# Quickstart Guide — F003: AI Code Assistant + Graph-Enhanced RAG

## Prerequisites

- Node 20+ and npm
- Ollama running at `http://localhost:11434` with:
  - `nomic-embed-text` (embeddings)
  - `llama3.1:8b` (generation)
- At least one provider configured in the database (`npm run db:seed`)

---

## Starting the Dev Server

```bash
npm run dev
# Open http://localhost:3000
```

---

## Using the Code Assistant

### 1. Navigate to Code Assistant

Click the **"Code Assistant"** tab in the top nav bar (next to Chat).

### 2. Generate Code

1. Click **"Generate"** (already active by default)
2. Type the target language (e.g. `typescript`, `python`, `go`)
3. Describe what you want:
   > "A function that debounces a callback with configurable delay"
4. Click **"Generate Code"**
5. The generated code appears in the dark output box below

**With graph context active**: If you have previously queried the codebase and the graph contains `CODE_ENTITY` nodes, the generator automatically injects relevant symbols into the system prompt. For example, asking for "a function that embeds text for vector search" may surface the existing `generateEmbedding` symbol.

### 3. Explain Code

1. Click **"Explain"** tab
2. Paste any code snippet into the text area
3. Optionally type the language (e.g. `rust`)
4. Click **"Explain Code"**
5. A plain-English explanation appears below

---

## Graph-Enhanced RAG (Document Q&A)

The RAG pipeline is upgraded automatically — no UI change needed.

### How It Works

| Step | F02 (old) | F03 (new) |
|------|-----------|-----------|
| Retrieve | top-5 by cosine similarity | top-20 by cosine similarity |
| Graph | not used | write CHUNK nodes + edges |
| Rerank | — | sort by accumulated edge weight |
| Inject | top-5 | top-5 (after rerank) |

### Seeing Graph Score in Citations

1. Upload a PDF via the Documents panel
2. Ask a question — the **Sources** panel below the answer shows citations
3. After a second question on the same document, citations that were retrieved multiple times show a **graph score badge** (small gray number)
4. Higher scores = more graph-connected = promoted by reranking

### Cold Start Note

On the first question, the graph is empty so reranking has no effect (F03 ≈ F02). Edge weights accumulate with each Q&A turn. After 5–10 questions, frequently-retrieved chunks are promoted.

---

## Running the RAG Benchmark

```bash
# Requires dev server running + Ollama running + indexed document
npx ts-node scripts/benchmark-rag.ts
```

Results are written to `specs/003-ai-code-assistant-graph-rag/benchmark.md`.

**Pass criterion**: F03 avg score ≥ F02 avg score + 10%.

---

## Running Tests

```bash
npm test                          # all tests
npx vitest run __tests__/modules/rag/     # RAG module only
npx vitest run __tests__/modules/code/   # Code module only
npx vitest run __tests__/api/code/       # API routes only
```
