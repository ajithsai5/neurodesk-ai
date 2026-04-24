// File: src/types/pdf-parse.d.ts
/**
 * Ambient module declaration for `pdf-parse/lib/pdf-parse.js`.
 *
 * The published `@types/pdf-parse` package only covers the main `pdf-parse`
 * entry point. We intentionally import from the `/lib/pdf-parse.js` subpath
 * (see src/modules/rag/pdf-extractor.ts) so that pdf-parse's index.js does
 * NOT execute its self-test on load, which reads a non-existent test PDF
 * under ESM dynamic import and crashes the Next.js server. This .d.ts
 * mirrors the runtime shape of that subpath so strict tsc --noEmit passes.
 */

declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }

  function pdfParse(
    buffer: Buffer | Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
