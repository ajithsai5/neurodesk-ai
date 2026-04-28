# Evaluation Set — Graph-Enhanced RAG Benchmark

**Feature**: F003 — AI Code Assistant + Graph-Enhanced RAG  
**Purpose**: 10-question evaluation set for comparing F02 (top-5 pure-vector) vs F03 (top-20 + graph rerank → top-5) retrieval strategies.

Each question is scored by counting how many **expected key phrases** appear in the LLM's generated answer. A score of `n/k` means `n` of `k` expected phrases were found (case-insensitive substring match).

---

## Evaluation Questions

> **Note**: These questions are designed around the NeuroDesk AI codebase documentation and architecture itself. In a production scenario, questions would be drawn from an uploaded domain PDF. The benchmark script (`scripts/benchmark-rag.ts`) can be adapted to any seeded document corpus.

| # | Question | Expected Key Phrases | Source Concept |
|---|----------|----------------------|----------------|
| 1 | What database does NeuroDesk AI use for storing conversations? | `sqlite`, `drizzle`, `better-sqlite3` | Architecture overview |
| 2 | How does the context window trimming work? | `token`, `20 messages`, `100k`, `tiktoken` | Context window module |
| 3 | What embedding model is used for document search? | `nomic-embed-text`, `ollama`, `768` | Embedding client |
| 4 | How are citations attached to assistant messages? | `StreamData`, `annotation`, `sources panel`, `useChat` | Chat route |
| 5 | What is the graph reranking strategy? | `edge weight`, `rerankWithGraph`, `writeChunkNodes`, `CHUNK` | Graph service |
| 6 | How does the RAG pipeline retrieve document chunks? | `vec_document_chunks`, `cosine`, `sqlite-vec`, `distance` | Retrieval service |
| 7 | What LLM providers are supported? | `openai`, `anthropic`, `ollama`, `providerConfigs` | LLM client |
| 8 | How is the system prompt constructed for RAG? | `DOCUMENT CONTEXT`, `persona`, `systemPrompt`, `basePrompt` | Chat service |
| 9 | What is the maximum message length allowed? | `10000`, `10,000`, `maxMessageLength`, `validation` | Config / validation |
| 10 | How are conversation titles generated? | `first message`, `200 characters`, `defaultConversationTitle`, `auto` | Conversation service |

---

## Scoring Rubric

- **4/4 phrases matched** → 1.0 (full credit)  
- **3/4 phrases matched** → 0.75  
- **2/4 phrases matched** → 0.5  
- **1/4 phrases matched** → 0.25  
- **0/4 phrases matched** → 0.0 (miss)

**Pass threshold**: F03 aggregate score ≥ F02 aggregate score + 10% improvement.

---

## Benchmark Script

Run: `npx ts-node scripts/benchmark-rag.ts`

Requires:
- Dev instance running: `npm run dev`
- At least one document indexed with status `ready`
- Ollama running at `localhost:11434` with `nomic-embed-text` and `llama3.1:8b`
