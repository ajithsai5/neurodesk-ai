// File: src/modules/rag/pdf-extractor.ts
/**
 * PDF Text Extractor
 * Wraps pdf-parse to extract text from PDF buffers with page-level boundaries.
 * Returns one entry per page; pages with no extractable text are omitted.
 * (Why: page granularity is required for accurate source citations in RAG answers)
 */

// pdf-parse uses CommonJS exports; use require-style import for compatibility
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

export interface ExtractedPage {
  pageNumber: number; // 1-indexed
  text: string;
}

/**
 * Extract text from a PDF buffer, preserving page boundaries.
 * pdf-parse inserts a form-feed character (\f) between pages in its output.
 *
 * @param buffer - Raw PDF file bytes
 * @returns Array of pages with 1-indexed page numbers and text content.
 *          Empty array if the PDF has no extractable text (e.g., image-only scans).
 * @throws Error if the buffer is not a valid PDF or is corrupt
 */
export async function extractPages(buffer: Buffer): Promise<ExtractedPage[]> {
  const result = await pdfParse(buffer);

  // pdf-parse separates pages with form-feed (\f); split and index from 1
  const rawPages = result.text.split('\f');
  const pages: ExtractedPage[] = [];

  for (let i = 0; i < result.numpages; i++) {
    const text = (rawPages[i] ?? '').trim();
    // Skip pages with no extractable text (blank pages, image-only pages)
    if (text.length > 0) {
      pages.push({ pageNumber: i + 1, text });
    }
  }

  return pages;
}
