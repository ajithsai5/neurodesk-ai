// File: src/modules/rag/ingestion-pipeline.ts
/**
 * Ingestion Pipeline
 * Orchestrates the document processing pipeline: text extraction → chunking → embedding → storage.
 * Also exports the chunking function independently for unit testing.
 * (Why: keeping chunking logic separate from orchestration makes each step independently testable)
 */

import { getEncoding } from 'js-tiktoken';
import type { ExtractedPage } from './pdf-extractor';

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
