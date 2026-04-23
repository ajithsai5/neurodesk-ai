// File: src/modules/rag/retrieval-service.ts
/**
 * Retrieval Service
 * Embeds a user query and performs cosine similarity search against the vec_document_chunks
 * virtual table to return the top-k most relevant document chunks for RAG context injection.
 * (Why: similarity search is the core of retrieval-augmented generation)
 */

import { sqlite } from '@/modules/shared/db';
import { generateEmbedding } from './embedding-client';

export interface RetrievedChunk {
  chunkId: number;
  content: string;
  pageNumber: number;
  documentName: string; // original_name from documents table
  distance: number;     // cosine distance (lower = more similar)
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
 * A single citation referencing a source page in an uploaded document.
 * Sent as a message annotation so the client can render a Sources panel.
 */
export interface Citation {
  documentName: string;
  pageNumber: number;
  excerpt: string;
}

/**
 * Convert retrieved chunks into Citation objects for the client-side Sources panel.
 * Returns an empty array when no chunks are available.
 */
export function formatCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    documentName: chunk.documentName,
    pageNumber: chunk.pageNumber,
    excerpt: chunk.content,
  }));
}

/**
 * Format retrieved chunks as a structured context block for LLM injection.
 * Returns null when no chunks are available (no documents in library).
 */
export function formatRagContext(chunks: RetrievedChunk[]): string | null {
  if (chunks.length === 0) return null;

  const sections = chunks.map((chunk) =>
    `--- Source: ${chunk.documentName}, Page ${chunk.pageNumber} ---\n${chunk.content}`
  );

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
