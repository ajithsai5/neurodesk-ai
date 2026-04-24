// File: src/modules/rag/txt-extractor.ts
/**
 * Plain-Text Extractor
 * Converts a plain-text Buffer into pseudo-pages of 50 lines each.
 * This mirrors pdf-extractor's page-level output shape so the ingestion
 * pipeline can treat both formats identically downstream.
 * (Why: 50-line pseudo-pages keep chunk sizes consistent with PDF pages
 * and give citations a meaningful "page N" reference in the UI)
 */

import type { ExtractedPage } from './pdf-extractor';

const LINES_PER_PAGE = 50;

/**
 * Split a plain-text buffer into pseudo-pages of up to 50 lines each.
 *
 * @param buffer - Raw bytes of a UTF-8 plain-text file
 * @returns Array of pages with 1-indexed page numbers and joined text.
 *          Returns an empty array for empty or whitespace-only files.
 */
export function extractTextFile(buffer: Buffer): ExtractedPage[] {
  const raw = buffer.toString('utf-8');

  // Split into individual lines, filtering out whitespace-only lines from the overall file
  const lines = raw.split('\n');

  // Bail early for files with no content at all
  if (lines.every((l) => l.trim() === '')) return [];

  const pages: ExtractedPage[] = [];
  let pageNumber = 1;

  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    const slice = lines.slice(i, i + LINES_PER_PAGE);
    const text = slice.join('\n').trim();

    // Skip a page slice that is entirely whitespace (e.g. trailing newlines)
    if (text.length > 0) {
      pages.push({ pageNumber, text });
    }

    pageNumber++;
  }

  return pages;
}
