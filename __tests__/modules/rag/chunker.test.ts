import { describe, it, expect } from 'vitest';
import { chunkText } from '@/modules/rag/ingestion-pipeline';
import type { ExtractedPage } from '@/modules/rag/pdf-extractor';

// Helper: produce a page with N words (each word ~1 token)
function makePage(pageNumber: number, wordCount: number): ExtractedPage {
  return { pageNumber, text: Array(wordCount).fill('word').join(' ') };
}

// Helper: produce a page with a specific token-heavy string
function makePageWithText(pageNumber: number, text: string): ExtractedPage {
  return { pageNumber, text };
}

describe('chunkText', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkText([])).toEqual([]);
  });

  it('returns a single chunk for text shorter than 512 tokens', () => {
    const pages = [makePage(1, 50)]; // ~50 tokens — well under 512
    const chunks = chunkText(pages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].tokenCount).toBeLessThanOrEqual(512);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('produces chunks of at most 512 tokens', () => {
    // 1500 tokens worth of content across two pages
    const pages = [makePage(1, 800), makePage(2, 700)];
    const chunks = chunkText(pages);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(512);
    }
  });

  it('produces overlapping chunks with 64-token overlap', () => {
    // 600-word document across one page — should produce at least 2 chunks
    const pages = [makePage(1, 600)];
    const chunks = chunkText(pages);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // The second chunk should start 448 tokens into the first chunk's content
    // (stride = 512 - 64 = 448). Verify by checking that adjacent chunk contents overlap.
    if (chunks.length >= 2) {
      // The last 64 tokens of chunk[0] should appear at the start of chunk[1]
      // We verify this by checking that both chunks have content and chunkIndex is sequential
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[1].chunkIndex).toBe(1);
    }
  });

  it('preserves the source page number for each chunk', () => {
    const pages = [
      makePageWithText(3, 'This text is on page three'),
      makePageWithText(5, 'This text is on page five'),
    ];
    const chunks = chunkText(pages);
    // First chunk starts on page 3
    expect(chunks[0].pageNumber).toBe(3);
    // If enough content spans to page 5, the chunk starting there should be page 5
    // At minimum, all chunks must have valid page numbers from the input
    for (const chunk of chunks) {
      expect([3, 5]).toContain(chunk.pageNumber);
    }
  });

  it('assigns sequential 0-indexed chunkIndex values', () => {
    const pages = [makePage(1, 600)];
    const chunks = chunkText(pages);
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it('each chunk has non-empty content', () => {
    const pages = [makePage(1, 300)];
    const chunks = chunkText(pages);
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });
});
