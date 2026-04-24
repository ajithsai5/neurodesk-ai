// File: src/modules/rag/ingestion-pipeline.ts
/**
 * Ingestion Pipeline
 * Orchestrates the document processing pipeline: text extraction → chunking → embedding → storage.
 * Also exports the chunking function independently for unit testing.
 * (Why: keeping chunking logic separate from orchestration makes each step independently testable)
 */

import { getEncoding } from 'js-tiktoken';
import { eq } from 'drizzle-orm';
import { db, sqlite } from '@/modules/shared/db';
import { documentChunks } from '@/modules/shared/db/schema';
import { extractPages, type ExtractedPage } from './pdf-extractor';
import { extractTextFile } from './txt-extractor';
import { generateEmbedding, EmbeddingError } from './embedding-client';
import { getDocument, updateDocumentStatus } from './document-service';
import { logger } from '@/modules/shared/logger';
import fs from 'fs';

// Chunking configuration — matches values confirmed in spec clarifications
const CHUNK_SIZE_TOKENS = 512;
const CHUNK_OVERLAP_TOKENS = 64;
// Tiktoken encoding reused from the context-window module (cl100k_base)
const ENCODING = 'cl100k_base' as const;

export interface TextChunk {
  content: string;
  pageNumber: number; // source page (page where the chunk starts)
  chunkIndex: number; // 0-indexed position within the document
  tokenCount: number; // actual token count of this chunk (≤ CHUNK_SIZE_TOKENS)
}

/**
 * Split an array of extracted pages into overlapping token-bounded chunks.
 * Uses a sliding window of CHUNK_SIZE_TOKENS tokens with CHUNK_OVERLAP_TOKENS overlap.
 *
 * Strategy:
 * 1. Flatten all pages into a single number[] token array, tracking page-number per token.
 * 2. Slide a window of CHUNK_SIZE_TOKENS, advancing by stride = (CHUNK_SIZE - OVERLAP) = 448.
 * 3. Each window is decoded back to a string and stored as a chunk.
 *    The chunk's pageNumber is from the first token in the window.
 *
 * Note: js-tiktoken's encode() returns number[], decode(number[]) returns string directly.
 *
 * @param pages - Extracted pages from pdf-extractor or txt-extractor
 * @returns Array of chunks ready for embedding and storage
 */
export function chunkText(pages: ExtractedPage[]): TextChunk[] {
  if (pages.length === 0) return [];

  const encoder = getEncoding(ENCODING);

  // Build a flat token list with page provenance for each token
  const allTokens: number[] = [];
  const tokenPages: number[] = []; // parallel array: which page each token came from

  for (const page of pages) {
    const tokens = encoder.encode(page.text); // returns number[]
    for (const token of tokens) {
      allTokens.push(token);
      tokenPages.push(page.pageNumber);
    }
  }

  if (allTokens.length === 0) return [];

  const stride = CHUNK_SIZE_TOKENS - CHUNK_OVERLAP_TOKENS; // 448 tokens per step
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (let start = 0; start < allTokens.length; start += stride) {
    const end = Math.min(start + CHUNK_SIZE_TOKENS, allTokens.length);
    const chunkTokens = allTokens.slice(start, end);
    const pageNumber = tokenPages[start]!; // page of the first token in this chunk

    // decode(number[]) returns the string content directly
    const content = encoder.decode(chunkTokens).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        pageNumber,
        chunkIndex: chunkIndex++,
        tokenCount: chunkTokens.length,
      });
    }

    // Stop once the final token is included in this chunk
    if (end === allTokens.length) break;
  }

  return chunks;
}

/**
 * Run the full ingestion pipeline for a document that is already in 'pending' status.
 * On success: inserts chunks + embeddings, updates status to 'ready'.
 * On failure: removes any partial vec rows, updates status to 'failed' with error message.
 *
 * This function is intentionally fire-and-forget from the API route (no await at call site).
 */
export async function ingestDocument(documentId: number): Promise<void> {
  const doc = await getDocument(documentId);
  if (!doc) throw new Error(`Document ${documentId} not found`);

  const startMs = Date.now();
  logger.info('Ingestion started', { documentId, originalName: doc.originalName });

  // Pre-flight: verify Ollama embedding is reachable before reading the file.
  // 5-second timeout prevents ingestion from hanging when Ollama is not running.
  try {
    await generateEmbedding('ping', AbortSignal.timeout(5000));
  } catch (err) {
    const message = err instanceof EmbeddingError
      ? err.message
      : `Embedding service error: ${String(err)}`;
    await updateDocumentStatus(documentId, 'failed', { errorMessage: message });
    return;
  }

  try {
    // 1. Read file from disk
    const buffer = fs.readFileSync(doc.filePath);

    // 2. Extract text pages — route by MIME type (FR-013 multi-format support)
    const pages: ExtractedPage[] = doc.mimeType === 'text/plain'
      ? extractTextFile(buffer)
      : await extractPages(buffer);
    if (pages.length === 0) {
      await updateDocumentStatus(documentId, 'failed', {
        errorMessage: 'No extractable text found. The document may be image-only or empty.',
      });
      return;
    }

    // 3. Enforce page count limit (200 pages max per spec SC-005)
    const pageCount = pages.reduce((max, p) => Math.max(max, p.pageNumber), 0);
    if (pageCount > 200) {
      await updateDocumentStatus(documentId, 'failed', {
        errorMessage: `Document exceeds 200-page limit (${pageCount} pages detected).`,
      });
      return;
    }

    // 4. Split into chunks
    const chunks = chunkText(pages);

    // 5. Embed each chunk and persist to DB + vec table
    // Track inserted chunk IDs for cleanup on partial failure
    const insertedChunkIds: number[] = [];

    for (const chunk of chunks) {
      // Insert the chunk record first to get its autoincrement ID
      const [chunkRow] = await db
        .insert(documentChunks)
        .values({
          documentId,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
        })
        .returning({ id: documentChunks.id });

      const chunkId = chunkRow!.id;
      insertedChunkIds.push(chunkId);

      // Generate embedding and insert into the sqlite-vec virtual table.
      // sqlite-vec v0.1.x requires BigInt for the primary key column.
      const embedding = await generateEmbedding(chunk.content);
      sqlite.prepare(`
        INSERT INTO vec_document_chunks (chunk_id, embedding)
        VALUES (?, ?)
      `).run(BigInt(chunkId), new Float32Array(embedding));
    }

    // 6. Mark document as ready with final page count
    await updateDocumentStatus(documentId, 'ready', { pageCount });
    logger.info('Ingestion completed', {
      documentId,
      chunks: chunks.length,
      pageCount,
      durationMs: Date.now() - startMs,
    });
  } catch (err) {
    // On any error: clean up any partial vec rows and mark as failed
    const message = err instanceof EmbeddingError
      ? err.message
      : `Processing failed: ${err instanceof Error ? err.message : String(err)}`;

    // Remove partial vec entries (chunks are cascade-deleted with the document row, but
    // we want to leave the document record so the user can see the failure)
    sqlite.prepare(`
      DELETE FROM vec_document_chunks
      WHERE chunk_id IN (
        SELECT id FROM document_chunks WHERE document_id = ?
      )
    `).run(documentId);

    await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));

    await updateDocumentStatus(documentId, 'failed', { errorMessage: message });
    logger.error('Ingestion failed', {
      documentId,
      error: message,
      durationMs: Date.now() - startMs,
    });
  }
}
