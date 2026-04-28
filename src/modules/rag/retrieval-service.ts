// File: src/modules/rag/retrieval-service.ts
/**
 * Retrieval Service
 * Embeds a user query and performs cosine similarity search against the vec_document_chunks
 * virtual table to return the top-k most relevant document chunks for RAG context injection.
 * Graph-enhanced retrieval widens the candidate pool then re-ranks by edge weight.
 * (Why: similarity search is the core of retrieval-augmented generation)
 */

import { sqlite } from '@/modules/shared/db';
import { generateEmbedding } from './embedding-client';
import { config } from '@/lib/config';
import { writeChunkNodes, rerankWithGraph } from '@/modules/graph/graph-service';

export interface RetrievedChunk {
  chunkId: number;
  content: string;
  pageNumber: number;
  documentName: string; // original_name from documents table
  distance: number;     // cosine distance (lower = more similar)
  graphScore?: number;  // optional reranking score from graph edge weights
}

/**
 * Retrieve the top-k most semantically similar chunks to a query string.
 * Embeds the query using Ollama nomic-embed-text, then queries sqlite-vec
 * for the nearest neighbours. Only chunks from 'ready' documents are returned.
 *
 * @param query - The user's question or search string
 * @param limit - Maximum number of chunks to return (default: 5 per spec clarification)
 * @returns Ranked list of chunks with source document metadata
 */
export async function retrieveChunks(
  query: string,
  limit = 5,
): Promise<RetrievedChunk[]> {
  const embedding = await generateEmbedding(query);
  const embeddingBuffer = new Float32Array(embedding);

  // Cosine similarity search using sqlite-vec's MATCH + k = ? syntax.
  // k = ? tells sqlite-vec how many nearest neighbors to retrieve from the index;
  // the JOIN and status filter then narrow to only chunks from ready documents.
  // (Why: sqlite-vec v0.1.x requires 'k = ?' in the WHERE clause, not LIMIT ?)
  const rows = sqlite.prepare<unknown[], {
    chunk_id: number;
    content: string;
    page_number: number;
    original_name: string;
    distance: number;
  }>(`
    SELECT
      v.chunk_id,
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
    ORDER BY v.distance
  `).all(embeddingBuffer, limit);

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    content: row.content,
    pageNumber: row.page_number,
    documentName: row.original_name,
    distance: row.distance,
  }));
}

/**
 * Graph-enhanced retrieval: retrieve a wider candidate pool, write CHUNK nodes to the
 * knowledge graph, re-rank candidates by accumulated edge weight, then return the top-N.
 *
 * Uses config.ragCandidatePoolSize (20) as the retrieval limit and
 * config.ragFinalContextSize (5) as the final injection size.
 * Falls back to an empty array when the pool is empty (no ready documents).
 * (Why: wider pool gives the graph reranker more signal; final context stays small)
 *
 * @param sessionId - Current session identifier passed to graph operations
 * @param query     - The user's question or search string
 * @returns Top-N re-ranked chunks ready for LLM context injection
 */
export async function retrieveAndRerank(
  sessionId: string,
  query: string,
): Promise<RetrievedChunk[]> {
  const pool = await retrieveChunks(query, config.ragCandidatePoolSize);
  if (pool.length === 0) return [];

  // Write CHUNK nodes to the graph so future queries can leverage edge weights
  await writeChunkNodes(
    sessionId,
    pool.map((c) => ({
      id: String(c.chunkId),
      text: c.content,
      documentId: c.documentName,
      pageNumber: c.pageNumber,
      similarityScore: 1 - c.distance,  // convert distance → similarity
      retrievedAt: Date.now(),
    })),
  );

  // Re-rank by graph edge weight; candidates without graph edges keep original order
  const withIds = pool.map((c) => ({ ...c, id: String(c.chunkId) }));
  const reranked = await rerankWithGraph(sessionId, withIds);

  return reranked.slice(0, config.ragFinalContextSize);
}

/**
 * A single citation referencing a source page in an uploaded document.
 * Sent as a message annotation so the client can render a Sources panel.
 * graphScore is optional — only present when graph reranking was active.
 */
export interface Citation {
  documentName: string;
  pageNumber: number;
  excerpt: string;
  graphScore?: number;  // graph reranking weight (higher = more connected in knowledge graph)
}

/**
 * Convert retrieved chunks into Citation objects for the client-side Sources panel.
 * Preserves graphScore when present on the chunk (set by graph-enhanced retrieval).
 * Returns an empty array when no chunks are available.
 */
export function formatCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    documentName: chunk.documentName,
    pageNumber: chunk.pageNumber,
    excerpt: chunk.content,
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
