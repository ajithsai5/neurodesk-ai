import { describe, it, expect, vi } from 'vitest';
import { extractPages } from '@/modules/rag/pdf-extractor';

// Mock pdf-parse so tests don't depend on the CJS/ESM interop resolution
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}));

// Helper to set up a mock pdf-parse result for a given page structure
async function mockPdfParse(pages: string[]) {
  const mod = await import('pdf-parse');
  const mockFn = (mod as unknown as { default: ReturnType<typeof vi.fn> }).default;
  mockFn.mockResolvedValue({
    text: pages.join('\f'),
    numpages: pages.length,
  });
}

describe('extractPages', () => {
  it('extracts text with correct page numbers from a valid PDF buffer', async () => {
    await mockPdfParse(['Content of page one', 'Content of page two', 'Content of page three']);

    const result = await extractPages(Buffer.from('fake-pdf-bytes'));

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ pageNumber: 1, text: 'Content of page one' });
    expect(result[1]).toEqual({ pageNumber: 2, text: 'Content of page two' });
    expect(result[2]).toEqual({ pageNumber: 3, text: 'Content of page three' });
  });

  it('returns an empty array when the PDF contains no extractable text', async () => {
    await mockPdfParse(['', '', '']); // three image-only pages with no text

    const result = await extractPages(Buffer.from('fake-pdf-bytes'));
    expect(result).toEqual([]);
  });

  it('skips pages with whitespace-only text', async () => {
    await mockPdfParse(['   ', 'Real content here', '\t\n']);

    const result = await extractPages(Buffer.from('fake-pdf-bytes'));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pageNumber: 2, text: 'Real content here' });
  });

  it('returns pages with 1-indexed page numbers (not 0-indexed)', async () => {
    await mockPdfParse(['Page A', 'Page B']);

    const result = await extractPages(Buffer.from('fake-pdf-bytes'));
    expect(result[0].pageNumber).toBe(1);
    expect(result[1].pageNumber).toBe(2);
  });

  it('throws an error when pdf-parse rejects (corrupt buffer)', async () => {
    const mod = await import('pdf-parse');
    const mockFn = (mod as unknown as { default: ReturnType<typeof vi.fn> }).default;
    mockFn.mockRejectedValueOnce(new Error('Invalid PDF structure'));

    await expect(extractPages(Buffer.from('corrupt'))).rejects.toThrow('Invalid PDF structure');
  });
});

// ---------------------------------------------------------------------------
// T037: txt-extractor tests — written BEFORE implementation (TDD)
// ---------------------------------------------------------------------------

import { extractTextFile } from '@/modules/rag/txt-extractor';

describe('extractTextFile', () => {
  it('returns an empty array for an empty buffer', () => {
    expect(extractTextFile(Buffer.from(''))).toEqual([]);
  });

  it('splits content into pseudo-pages of 50 lines each', () => {
    // 100 lines → 2 pages of 50 each
    const text = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    const result = extractTextFile(Buffer.from(text));
    expect(result).toHaveLength(2);
  });

  it('uses 1-indexed page numbers', () => {
    const text = Array.from({ length: 60 }, (_, i) => `L${i}`).join('\n');
    const result = extractTextFile(Buffer.from(text));
    expect(result[0]!.pageNumber).toBe(1);
    expect(result[1]!.pageNumber).toBe(2);
  });

  it('produces a single page for fewer than 50 lines', () => {
    const text = 'line1\nline2\nline3';
    const result = extractTextFile(Buffer.from(text));
    expect(result).toHaveLength(1);
    expect(result[0]!.pageNumber).toBe(1);
    expect(result[0]!.text).toContain('line1');
  });

  it('returns an empty array for whitespace-only content', () => {
    const result = extractTextFile(Buffer.from('   \n\n\t\n'));
    expect(result).toEqual([]);
  });

  it('preserves the text content within each page', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Row ${i}`);
    const text = lines.join('\n');
    const result = extractTextFile(Buffer.from(text));
    expect(result).toHaveLength(1);
    for (const line of lines) {
      expect(result[0]!.text).toContain(line);
    }
  });
});
