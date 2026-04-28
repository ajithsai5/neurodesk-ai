# RAG Benchmark Results — F02 vs F03

**Status**: Pending live run — Ollama + indexed documents required.

## How to Run

```bash
# 1. Start dev server and ensure Ollama is running
npm run dev

# 2. Upload at least one document via the UI and wait for status 'ready'

# 3. Run the benchmark
npx ts-node scripts/benchmark-rag.ts
```

The script will overwrite this file with actual results.

---

## Expected Behaviour

- **First run (empty graph)**: F03 ≈ F02 — edge weights have not accumulated yet, so graph reranking has no signal.
- **After 5+ Q&A turns**: F03 > F02 — CHUNK nodes gain FOLLOWS/PART_OF edges that promote repeatedly-retrieved chunks.
- **Target**: ≥ 10% improvement in key-phrase recall (measured across 10 eval questions).

---

## Methodology

Each of the 10 eval-set questions (see `eval-set.md`) is answered twice:

| Strategy | Retrieval | Pool Size | Reranking |
|----------|-----------|-----------|-----------|
| F02 | `retrieveChunks(q, 5)` | 5 | None |
| F03 | `retrieveAndRerank('benchmark', q)` | 20 | Graph edge-weight sum |

Scores are key-phrase recall: fraction of expected phrases found in the LLM answer (case-insensitive substring match).
