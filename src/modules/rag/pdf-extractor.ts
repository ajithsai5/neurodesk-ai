// File: src/modules/rag/pdf-extractor.ts
/**
 * PDF Text Extractor
 * Wraps pdf-parse to extract text from PDF buffers with page-level boundaries.
 * Returns one entry per page; pages with no extractable text are omitted.
 * (Why: page granularity is required for accurate source citations in RAG answers)
 */

export interface ExtractedPage {
  pageNumber: number; // 1-indexed
  text: string;
}

type PdfParseResult = { text: string; numpages: number };

/**
 * Dynamically load pdf-parse, handling both CJS and ESM interop shapes.
 * Import from the lib path directly to avoid pdf-parse/index.js running its
 * own test suite on load (it checks !module.parent, which is true under ESM
 * dynamic import, causing it to try reading a non-existent test PDF file).
 */
async function loadPdfParse(): Promise<(buffer: Buffer) => Promise<PdfParseResult>> {
  const mod = await import('pdf-parse/lib/pdf-parse.js');
  // CJS module loaded via ESM: the function is at mod.default
  const fn = (mod as unknown as { default: unknown }).default ?? mod;
  if (typeof fn !== 'function') {
    throw new Error('pdf-parse module did not export a callable function');
  }
  return fn as (buffer: Buffer) => Promise<PdfParseResult>;
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
  const pdfParse = await loadPdfParse();
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
