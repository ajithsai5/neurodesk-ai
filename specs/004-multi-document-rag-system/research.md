# Research: Multi-Document RAG System (F004)

**Branch**: `004-multi-document-rag-system` | **Date**: 2026-05-05

---

## 1. Vector Filter Strategy — sqlite-vec with documentId

**Decision**: Apply the `documentIds` filter via JOIN with `document_chunks`, not inside the sqlite-vec MATCH clause.

**Rationale**: The existing retrieval query already filters on `d.status = 'ready'` through a JOIN chain `vec_document_chunks → document_chunks → documents`. Adding `AND c.document_id IN (?, ...)` to the same WHERE clause is the same pattern and is safe with sqlite-vec v0.1.x. The `k = ?` parameter controls how many candidates the vec index returns before the JOIN; the JOIN then filters the results down to the requested documents. This may return fewer than `k` results when the filter is narrow — callers must handle `pool.length < k` gracefully (already the case in `retrieveAndRerank`).

**Alternative considered**: Separate `vec0` virtual table per document. Rejected — creates N tables, complicates deletion, and prevents cross-document similarity search. Constitution Principle V (Simplicity & YAGNI) applies.

**Alternative considered**: Adding a `document_id` column to `vec_document_chunks` and using a `WHERE document_id IN (...)` inside the MATCH. Rejected — sqlite-vec v0.1.x virtual tables only support their own indexed column (`embedding`) in the MATCH clause. Metadata filter columns must live on the backing physical table.

---

## 2. Dynamic Candidate Pool Formula

**Decision**: `candidatePoolSize = Math.min(config.ragCandidatePoolPerDoc × N, config.ragCandidatePoolMax)` where N = count of in-scope documents.

**Rationale**: With a single document, the pool is 20 (identical to F003 — backward compatible). With 5 documents, the pool is 100, giving the graph reranker 20 candidates per document to work with. The cap at 100 prevents `rerankWithGraph`'s linear scan over all graph edges from becoming expensive as the library grows.

**N source**: When no `documentIds` filter is active, N = count of documents with `status = 'ready'` for `userId = 'default'`. When a filter is active, N = `documentIds.length`. N is fetched with a cheap `COUNT(*)` query before calling `retrieveChunks`.

**Alternative considered**: Fixed 20 regardless of doc count. Rejected — a single document dominates the pool, making multi-document synthesis unlikely since one document's top-20 may score higher than the second document's best chunks.

---

## 3. Cross-Document Edge Detection — Lightweight Token Overlap

**Decision**: Detect shared entities between candidate chunks using a stop-word-filtered token intersection. Two chunks from different documents that share ≥ 3 non-stopword tokens get a `SIMILAR_TO` edge with `weight = intersectionSize`.

**Rationale**: Avoids introducing an NLP dependency (spaCy, compromise.js). Token overlap is a well-established similarity heuristic (Jaccard) that works well for technical documents where key terms repeat verbatim across sources. It is O(N²) over the candidate pool (max 100), which is negligible.

**Stop word list**: 50-word English stop-word set (common articles, prepositions, conjunctions) inlined as `Set<string>` in `graph-service.ts`. No external dependency, no file I/O.

**Tokenisation**: Split on whitespace and punctuation with `.toLowerCase().split(/\W+/).filter(t => t.length > 2)`. Keeping it simple and dependency-free.

**Threshold = 3**: Empirically, shared terms like "transformer", "attention", "gradient" will appear in both documents. A threshold of 1–2 produces too many spurious edges; 5+ misses genuine connections. 3 is the established minimum for meaningful co-occurrence in short passages.

**Alternative considered**: Named Entity Recognition (spaCy/compromise.js). Rejected — adds a dependency, increases latency, and fails for technical jargon that NER models don't recognise. Constitution Principle V applies.

**Alternative considered**: Embedding similarity between chunks (cosine distance). Rejected — vector distance is already the primary ranking signal; duplicating it in the graph adds no new signal.

---

## 4. Badge Colour Persistence

**Decision**: Assign `badgeColour` at upload time, persist to the `documents.badge_colour` column, read back on every request.

**Rationale**: Assignment uses the modulo of the document's creation order within the user's library against the palette size. This is deterministic and stable: deleting a document does not reassign colours to other documents. Colours survive restarts because they are in the DB.

**Palette**: 8 colours derived from F003.5's Claude Design System tokens:
```
#E86C3A (amber-orange — primary accent)
#4A9EDB (blue)
#5BB974 (green)
#C678A0 (purple)
#E8A23A (gold)
#5BC4C4 (teal)
#DB7B5A (coral)
#8C8CDB (lavender)
```

**Assignment**: `palette[existingDocCount % palette.length]` where `existingDocCount` = number of documents already in the library for this user at upload time.

---

## 5. Startup Reset of Stuck Documents

**Decision**: On module load in `documents/route.ts`, call `resetStuckDocuments("default")` synchronously before the first request handler runs.

**Rationale**: If the server crashed or was killed during ingestion, `status = 'pending'` rows are left orphaned. On next startup, these will never transition since no ingestion task will pick them up. Resetting them to `failed` at startup is safe because Node.js is single-process — no other process could have resumed the ingestion.

**Implementation**: Module-level `void resetStuckDocuments("default")` at the top of `route.ts`. This runs once when Next.js first loads the route module (typically on the first request to `/api/documents`). Since better-sqlite3 is synchronous, the reset is atomic.

---

## 6. Library Usage Bar — Real-Time Feedback

**Decision**: The GET `/api/documents` response includes a `usage` object: `{ count, totalBytes, maxCount, maxBytes }`. The UI renders this as a dual progress bar in the library panel header.

**Rationale**: Users approaching the 50-document / 500 MB limit need advance warning. A usage bar prevents surprise rejections. The data is cheap to compute (one `COUNT(*) + SUM(file_size)` query) and piggybacks on the existing GET endpoint.

---

## 7. Index Reconstruction on Startup

**Decision**: sqlite-vec stores embeddings in the physical SQLite database file. No in-memory re-loading is needed. The `vec_document_chunks` virtual table is reconstructed from the DB file automatically by the `CREATE VIRTUAL TABLE IF NOT EXISTS` call in `db/index.ts` on every startup.

**Rationale**: sqlite-vec is not an in-memory vector store — it is a persistent SQLite virtual table. The embeddings survive restarts because they are rows in `data/neurodesk.db`. The `CREATE VIRTUAL TABLE IF NOT EXISTS` call is a no-op when the table already exists; the underlying page data remains intact.

**What changes in F004**: The `vec_document_chunks` virtual table gains an implicit association to `userId` via the JOIN with `document_chunks → documents`. No change to the virtual table DDL is needed. The `userId` filter is enforced in the SQL query, not in the vec schema.

**FR-026 compliance**: The spec requires "reconstruct query-ready state from persisted DB state on startup." This is satisfied natively by sqlite-vec's persistence model. No explicit serialisation step is required.
