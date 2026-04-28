# Research Notes — F003: AI Code Assistant + Graph-Enhanced RAG

## Provider Resolution Strategy

**Decision**: Code service queries the first `isAvailable = true` row from `providerConfigs`.

**Rationale**: The code assistant is stateless — it has no conversation ID to look up a specific provider config. Selecting the first available provider mirrors the fallback behaviour in the chat service and reuses the existing `providerConfigs` table without adding new configuration surface area.

**Error**: When no available provider exists, `generateCode()` / `explainCode()` throw `new Error('No available LLM provider configured')`. The API routes catch this and return 500. A future improvement could differentiate 503 (provider unavailable) from 500 (unexpected error).

---

## LLM Prompt Decisions

### generateCode()

System prompt: `"You are an expert software engineer. Generate clean, production-ready <language> code.\nRespond with ONLY the code, no explanation or markdown fences."`

**Why "ONLY the code"**: Without this instruction, most models wrap the response in markdown fences and add prose. The UI renders the raw string; stripping fences client-side is fragile.

**Graph context injection**: When `queryCodeEntities()` returns entities, a `[CODEBASE CONTEXT]` block listing `kind \`label\` in filePath` lines is appended to the system prompt. This is best-effort: if the graph is empty or the service throws, generation proceeds without context.

### explainCode()

System prompt: `"You are an expert software engineer. Explain the following <language> code in plain English. Be concise and clear. Focus on what the code does and why."`

**Why no "ONLY" constraint**: Explanations are prose; markdown and structure are welcome.

---

## rehype-highlight Reuse

The existing `MessageList.tsx` markdown renderer uses `rehype-highlight` for syntax coloring. The `CodeAssistant` component returns raw code text in a `<pre>` block styled with `bg-slate-900 text-slate-100` — simple and consistent without requiring an additional markdown render pass.

A future improvement would pipe the code through the same `react-markdown` + `rehype-highlight` pipeline used by chat messages.

---

## Graph Edge-Weight-Sum vs Raw Edge Count

`rerankWithGraph()` accumulates **sum of edge weights** (not count) for each chunk node. This was an existing design choice in `graph-service.ts`:

```typescript
weightMap.set(chunkId, (weightMap.get(chunkId) ?? 0) + (edge.weight ?? 1));
```

**Why sum not count**: Edge weights encode semantic strength. A single high-weight FOLLOWS edge should outweigh many low-weight PART_OF edges. The current implementation writes weight `1.0` for all edges, so sum ≡ count in practice — but the model supports weighted edges for future improvement.

---

## RAG Pool Size Rationale

`ragCandidatePoolSize = 20`, `ragFinalContextSize = 5`:

- 20 candidates gives the graph reranker enough signal diversity without exceeding the `k = ?` sqlite-vec scan budget.
- 5 final chunks keeps the injected context block under ~2000 tokens for typical document excerpts.
- These constants live in `src/lib/config.ts` for easy tuning without code changes.
