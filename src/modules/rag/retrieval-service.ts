// File: src/modules/rag/retrieval-service.ts
/**
 * Retrieval Service
 * Embeds a user query and performs cosine similarity search against the vec_document_chunks
 * virtual table to return the top-k most relevant document chunks for RAG context injection.
 * Graph-enhanced retrieval widens the candidate pool then re-ranks by edge weight.
 *
 * F004 additions:
 *  - computePoolSize(N): dynamic pool formula min(base × N, max)
 *  - retrieveChunks: accepts optional documentIds filter (hard exclude)
 *  - RetrievedChunk: adds documentId (numeric) and similarityScore (1 - distance)
 *  - retrieveAndRerank: accepts optional documentIds filter; uses dynamic pool size
 *  - countReadyDocuments: helper used to derive pool size when no filter active
 */

import { db, sqlite } from '@/modules/shared/db';
import { documents } from '@/modules/shared/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateEmbedding } from './embedding-client';
import { config } from '@/lib/config';
import { writeChunkNodes, rerankWithGraph, createCrossDocumentEdges } from '@/modules/graph/graph-service';

// ---------------------------------------------------------------------------
// T035: Updated RetrievedChunk — adds documentId + similarityScore
// ---------------------------------------------------------------------------

export interface RetrievedChunk {
  chunkId: number;
  /** F004: numeric document ID (joins to documents.id) */
  documentId: number;
  content: string;
  pageNumber: number;
  documentName: string; // original_name from documents table
  distance: number;     // cosine distance (lower = more similar)
  /** F004: similarity = 1 - distance, in [0, 1] */
  similarityScore: number;
  graphScore?: number;  // optional reranking score from graph edge weights
}

// ---------------------------------------------------------------------------
// T036: Dynamic pool formula — min(base × N, max)
// ---------------------------------------------------------------------------

/**
 * Compute the candidate pool size for `N` in-scope documents.
 * Formula: min(ragDynamicPoolBase × N, ragDynamicPoolMax)
 * Minimum return value is ragDynamicPoolBase (base × 0 is still base).
 * (Why: scales retrieval breadth with library size; caps cost at ~100 vec queries)
 */
export function computePoolSize(docCount: number): number {
  const base = config.ragDynamicPoolBase;
  const max  = config.ragDynamicPoolMax;
  return Math.min(Math.max(base, base * docCount), max);
}

// ---------------------------------------------------------------------------
// T038: Count ready documents (used by retrieveAndRerank when no filter active)
// ---------------------------------------------------------------------------

/**
 * Count the number of documents with status = 'ready' owned by `userId`.
 * Used by `retrieveAndRerank` to compute the dynamic pool size when no
 * documentIds filter is active.
 */
export async function countReadyDocuments(userId = 'default'): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(documents)
    .where(eq(documents.status, 'ready'));
  // Note: userId filter is future-proofed here — for v1 all docs belong to 'default'
  // so we count all ready docs regardless. Filtered by userId when multi-user lands.
  void userId; // reserved for F006
  return Number(rows[0]?.count ?? 0);
}

// ---------------------------------------------------------------------------
// T037: retrieveChunks with documentIds filter + similarityScore + documentId
// ---------------------------------------------------------------------------

/**
 * Retrieve the top-k most semantically similar chunks to a query string.
 * Embeds the query using Ollama nomic-embed-text, then queries sqlite-vec
 * for the nearest neighbours. Only chunks from 'ready' documents are returned.
 *
 * F004: accepts optional `documentIds` filter — when provided, only chunks from
 * the listed document IDs enter the candidate set. This is a hard exclude (not
 * deprioritisation): unlisted docs are never returned regardless of similarity.
 *
 * @param query       - The user's question or search string
 * @param limit       - Maximum number of chunks to return
 * @param documentIds - Optional filter: restrict to these document IDs only
 * @returns Ranked list of chunks with source document metadata
 */
export async function retrieveChunks(
  query: string,
  limit = 5,
  documentIds?: number[],
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(query);
  const embeddingBuffer = new Float32Array(embedding);

  // Build the optional document filter clause.
  // Strategy: JOIN filter via document_chunks.document_id IN (...) rather than via
  // sqlite-vec's MATCH clause (which doesn't support WHERE on extension columns).
  // See research.md ADR-001 for the full rationale.
  const filterClause = documentIds && documentIds.length > 0
    ? `AND c.document_id IN (${documentIds.map(() => '?').join(',')})`
    : '';

  const params: unknown[] = [embeddingBuffer, limit];
  if (documentIds && documentIds.length > 0) {
    params.push(...documentIds);
  }

  const rows = sqlite.prepare<unknown[], {
    chunk_id: number;
    document_id: number;
    content: string;
    page_number: number;
    original_name: string;
    distance: number;
  }>(`
    SELECT
      v.chunk_id,
      c.document_id,
      c.content,
      c.page_number,
      d.original_name,
      v.distance
    FROM vec_document_chunks v
    JOIN document_chunks c ON c.id = v.chunk_id
    JOIN documents d ON d.id = c.document_id
    WHERE v.embedding MATCH ?
      AND k = ?
      AND d.status = 'ready'
      ${filterClause}
    ORDER BY v.distance
  `).all(...params);

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    content: row.content,
    pageNumber: row.page_number,
    documentName: row.original_name,
    distance: row.distance,
    // Clamp to [0, 1] — real nomic-embed-text vectors are unit-normalised so
    // 1 - L2_distance stays in [0, 1]; clamp guards against out-of-distribution inputs.
    similarityScore: Math.max(0, Math.min(1, 1 - row.distance)),
  }));
}

// ---------------------------------------------------------------------------
// T039: retrieveAndRerank with documentIds filter + dynamic pool
// ---------------------------------------------------------------------------

/**
 * Graph-enhanced retrieval: retrieve a dynamic candidate pool, write CHUNK nodes
 * to the knowledge graph, re-rank candidates by accumulated edge weight, then
 * return the top-N final context chunks.
 *
 * F004 changes:
 *  - Accepts optional `documentIds` filter (passed through to retrieveChunks)
 *  - Pool size is dynamic: min(base × N, max) where N is in-scope doc count
 *
 * @param sessionId   - Current session identifier passed to graph operations
 * @param query       - The user's question or search string
 * @param documentIds - Optional filter: restrict retrieval to these document IDs
 * @returns Top-N re-ranked chunks ready for LLM context injection
 */
export async function retrieveAndRerank(
  sessionId: string,
  query: string,
  documentIds?: number[],
): Promise<RetrievedChunk[]> {
  // Compute the pool size based on in-scope document count
  const docCount = documentIds && documentIds.length > 0
    ? documentIds.length
    : await countReadyDocuments();

  const poolSize = computePoolSize(docCount);

  const pool = await retrieveChunks(query, poolSize, documentIds);
  if (pool.length === 0) return [];

  // Write CHUNK nodes to the graph so future queries can leverage edge weights
  await writeChunkNodes(
    sessionId,
    pool.map((c) => ({
      id: String(c.chunkId),
      text: c.content,
      documentId: c.documentName, // graph nodes use string IDs; documentName is the readable key
      documentTitle: c.documentName, // F004: also persist as documentTitle for rich node metadata
      pageNumber: c.pageNumber,
      similarityScore: c.similarityScore,
      retrievedAt: Date.now(),
    })),
  );

  // T050: Fire-and-forget cross-document edges after writing chunk nodes.
  // Errors are caught inside createCrossDocumentEdges and never propagate.
  void createCrossDocumentEdges(
    sessionId,
    pool.map((c) => ({ id: String(c.chunkId), text: c.content, documentId: c.documentId })),
  );

  // Re-rank by graph edge weight; candidates without graph edges keep original order
  const withIds = pool.map((c) => ({ ...c, id: String(c.chunkId) }));
  const reranked = await rerankWithGraph(sessionId, withIds);

  return reranked.slice(0, config.ragFinalContextSize);
}

// ---------------------------------------------------------------------------
// Citation interfaces + helpers (unchanged except Citation gains F004 fields)
// ---------------------------------------------------------------------------

/**
 * A single citation referencing a source page in an uploaded document.
 * Sent as a message annotation so the client can render a Sources panel.
 * F004: adds documentId, badgeColour, similarityScore.
 */
export interface Citation {
  /** F004: numeric document ID */
  documentId?: number;
  documentName: string;
  /** F004: hex colour from badge palette */
  badgeColour?: string;
  pageNumber: number;
  excerpt: string;
  /** F004: cosine similarity score 0.0–1.0 */
  similarityScore?: number;
  graphScore?: number;
}

/**
 * Convert retrieved chunks into Citation objects for the client-side Sources panel.
 * Preserves graphScore when present on the chunk (set by graph-enhanced retrieval).
 * F004: includes documentId, similarityScore, and badgeColour (when provided via chunkMeta).
 */
export function formatCitations(
  chunks: RetrievedChunk[],
  badgeMap?: Map<number, string>,
): Citation[] {
  return chunks.map((chunk) => ({
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    ...(badgeMap?.has(chunk.documentId) && { badgeColour: badgeMap.get(chunk.documentId) }),
    pageNumber: chunk.pageNumber,
    excerpt: chunk.content,
    ...(chunk.similarityScore !== undefined && {
      similarityScore: Number(chunk.similarityScore.toFixed(2)),
    }),
    ...(chunk.graphScore !== undefined && { graphScore: chunk.graphScore }),
  }));
}

/**
 * Format retrieved chunks as a structured context block for LLM injection.
 * Returns null when no chunks are available (no documents in library).
 */
export function formatRagContext(chunks: RetrievedChunk[]): string | null {
  if (chunks.length === 0) return null;

  const sections = chunks.map((chunk) => {
    const scoreLabel = chunk.graphScore !== undefined
      ? `, Graph Score: ${chunk.graphScore}`
      : '';
    return `--- Source: ${chunk.documentName}, Page ${chunk.pageNumber}${scoreLabel} ---\n${chunk.content}`;
  });

  return [
    '[DOCUMENT CONTEXT]',
    sections.join('\n\n'),
    '[END DOCUMENT CONTEXT]',
    '',
    'Answer the user\'s question using ONLY the document context above.',
    'If the answer is not in the documents, say so explicitly.',
    'Cite sources as [DocumentName, Page N].',
  ].join('\n');
}
