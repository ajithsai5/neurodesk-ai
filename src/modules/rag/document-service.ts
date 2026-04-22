// File: src/modules/rag/document-service.ts
/**
 * Document Service
 * Manages the user's global document library: CRUD operations, SHA-256 deduplication,
 * file storage, and document status transitions.
 * (Why: centralises all document lifecycle logic so API routes stay thin)
 */

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { db, sqlite } from '@/modules/shared/db';
import { documents, documentChunks } from '@/modules/shared/db/schema';
import { logger } from '@/modules/shared/logger';

// Uploaded files are stored in data/documents/ using UUID filenames to prevent path traversal
const DOCUMENTS_DIR = path.join(process.cwd(), 'data', 'documents');

export interface DocumentRecord {
  id: number;
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  pageCount: number | null;
  status: 'pending' | 'ready' | 'failed';
  contentHash: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface CreateDocumentResult {
  document: DocumentRecord;
  isDuplicate: false;
}

export interface DuplicateDocumentResult {
  isDuplicate: true;
  existingId: number;
}

/** Check if a document with the given SHA-256 hash already exists in the library */
export async function findByHash(contentHash: string): Promise<DocumentRecord | null> {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.contentHash, contentHash))
    .limit(1);
  return (rows[0] as DocumentRecord | undefined) ?? null;
}

/**
 * Create a new document record and write the file to disk.
 * Computes SHA-256 hash server-side; rejects with DuplicateDocumentResult if already present.
 *
 * @param fileBuffer - Raw file bytes
 * @param originalName - The original filename shown in the UI
 * @param mimeType - 'application/pdf' or 'text/plain'
 */
export async function createDocument(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<CreateDocumentResult | DuplicateDocumentResult> {
  // Compute SHA-256 hash server-side (never trust client-provided values)
  const contentHash = createHash('sha256').update(fileBuffer).digest('hex');

  // Deduplicate: if an identical file exists, return its ID immediately
  const existing = await findByHash(contentHash);
  if (existing) {
    return { isDuplicate: true, existingId: existing.id };
  }

  // Derive a safe extension from the MIME type for the stored filename
  const ext = mimeType === 'application/pdf' ? '.pdf' : '.txt';
  const storedName = `${randomUUID()}${ext}`;
  const filePath = path.join(DOCUMENTS_DIR, storedName);

  // Ensure the storage directory exists
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

  // Write file to disk before inserting the DB record
  // (Why: if DB insert fails, we can clean up the file; easier than the reverse)
  fs.writeFileSync(filePath, fileBuffer);

  const [row] = await db
    .insert(documents)
    .values({
      originalName,
      storedName,
      filePath,
      mimeType,
      fileSize: fileBuffer.length,
      status: 'pending',
      contentHash,
    })
    .returning();

  logger.info('Document uploaded', {
    documentId: (row as DocumentRecord).id,
    originalName,
    mimeType,
    fileSize: fileBuffer.length,
  });

  return { document: row as DocumentRecord, isDuplicate: false };
}

/** List all documents ordered by most recently uploaded */
export async function listDocuments(): Promise<DocumentRecord[]> {
  return db
    .select()
    .from(documents)
    .orderBy(documents.createdAt)
    .then((rows) => rows.reverse() as DocumentRecord[]);
}

/** Get a single document by ID, or null if not found */
export async function getDocument(id: number): Promise<DocumentRecord | null> {
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return (rows[0] as DocumentRecord | undefined) ?? null;
}

/**
 * Update a document's processing status.
 * @param errorMessage - Populated when transitioning to 'failed'
 * @param pageCount - Populated when transitioning to 'ready'
 */
export async function updateDocumentStatus(
  id: number,
  status: 'pending' | 'ready' | 'failed',
  opts?: { errorMessage?: string; pageCount?: number },
): Promise<void> {
  await db
    .update(documents)
    .set({
      status,
      errorMessage: opts?.errorMessage ?? null,
      pageCount: opts?.pageCount ?? null,
    })
    .where(eq(documents.id, id));
}

/**
 * Permanently delete a document: removes vec entries, cascades chunks, deletes DB row,
 * then removes the file from disk.
 * Steps 1–3 run in a SQLite transaction; file deletion runs after commit.
 */
export async function deleteDocument(id: number): Promise<boolean> {
  const doc = await getDocument(id);
  if (!doc) return false;

  // Delete vector entries first (not managed by Drizzle cascade)
  // then cascade will handle document_chunks, and finally the documents row
  sqlite.transaction(() => {
    sqlite.prepare(`
      DELETE FROM vec_document_chunks
      WHERE chunk_id IN (
        SELECT id FROM document_chunks WHERE document_id = ?
      )
    `).run(id);

    sqlite.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(id);
    sqlite.prepare('DELETE FROM documents WHERE id = ?').run(id);
  })();

  // Remove file from disk after the transaction commits (idempotent — ignore missing file)
  try {
    fs.unlinkSync(doc.filePath);
  } catch {
    // File may already be missing — not a failure condition
  }

  return true;
}
