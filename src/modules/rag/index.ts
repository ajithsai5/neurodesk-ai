// File: src/modules/rag/index.ts
/**
 * RAG Module — Document Ingestion and Context Retrieval
 *
 * Public API:
 *   ingestDocument(documentId: number): Promise<void>
 *   retrieveChunks(query: string, limit?: number): Promise<RetrievedChunk[]>
 *   formatRagContext(chunks: RetrievedChunk[]): string | null
 *   createDocument(buffer, name, mimeType): Promise<CreateDocumentResult | DuplicateDocumentResult>
 *   listDocuments(): Promise<DocumentRecord[]>
 *   getDocument(id: number): Promise<DocumentRecord | null>
 *   deleteDocument(id: number): Promise<boolean>
 *
 * Dependencies: shared/db (sqlite-vec + Drizzle), embedding-client (Ollama REST)
 *
 * All embedding generation and LLM inference in local mode uses Ollama running
 * at http://localhost:11434 with nomic-embed-text (embeddings) and llama3.1:8b (generation).
 */

export { ingestDocument, chunkText } from './ingestion-pipeline';
export { retrieveChunks, formatRagContext } from './retrieval-service';
export type { RetrievedChunk } from './retrieval-service';
export {
  createDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  updateDocumentStatus,
  findByHash,
} from './document-service';
export type { DocumentRecord, CreateDocumentResult, DuplicateDocumentResult } from './document-service';
export { extractPages } from './pdf-extractor';
export type { ExtractedPage } from './pdf-extractor';
export { extractTextFile } from './txt-extractor';
export { generateEmbedding, EmbeddingError } from './embedding-client';
export type { TextChunk } from './ingestion-pipeline';
