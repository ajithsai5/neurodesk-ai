// File: src/modules/rag/document-service.ts
/**
 * Document Service
 * Manages the user's document library: CRUD operations, SHA-256 deduplication,
 * file storage, document status transitions, library limits, badge colour assignment.
 * (Why: centralises all document lifecycle logic so API routes stay thin)
 *
 * F004 additions:
 *  - userId scoping (fixed 'default' in v1; column reserved for F006 multi-user)
 *  - badgeColour: deterministic hex colour from BADGE_PALETTE, assigned at upload time
 *  - Library limits: max 50 documents / 500 MB per user (enforced before DB insert)
 *  - resetStuckDocuments(): called at startup to mark interrupted ingestions as failed
 *  - getLibraryUsage(): COUNT + SUM for usage bar in Document Library UI
 */

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { eq, and, sql } from 'drizzle-orm';
import { db, sqlite } from '@/modules/shared/db';
import { documents, documentChunks } from '@/modules/shared/db/schema';
import { logger } from '@/modules/shared/logger';
import { config } from '@/lib/config';

// Uploaded files are stored in data/documents/ using UUID filenames to prevent path traversal
const DOCUMENTS_DIR = path.join(process.cwd(), 'data', 'documents');

// ---------------------------------------------------------------------------
// Badge colour palette — 8 accessible colours from F003.5 design tokens.
// Assigned deterministically at upload time: palette[existingCount % 8].
// Persisted in the DB so the colour never changes after upload.
// (Why: stable identity cue in citation badges across restarts and refreshes)
// ---------------------------------------------------------------------------
export const BADGE_PALETTE: readonly string[] = [
  '#E86C3A', // orange
  '#4A9EDB', // blue
  '#67B88F', // green
  '#9B6DD8', // purple
  '#D4A842', // amber
  '#E05C7B', // pink
  '#4BB8C4', // teal
  '#A0785A', // brown
] as const;

/** Assign a badge colour based on how many documents the user currently has */
export function assignBadgeColour(existingCount: number): string {
  return BADGE_PALETTE[existingCount % BADGE_PALETTE.length] as string;
}

// ---------------------------------------------------------------------------
// TypeScript interfaces — updated for F004
// ---------------------------------------------------------------------------

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
  /** F004: owner — always 'default' in v1 */
  userId: string;
  /** F004: hex colour from BADGE_PALETTE, assigned at upload time */
  badgeColour: string;
  createdAt: string;
}

export interface LibraryUsage {
  count: number;
  totalBytes: number;
  maxCount: number;
  maxBytes: number;
}

export interface CreateDocumentResult {
  document: DocumentRecord;
  isDuplicate: false;
}

export interface DuplicateDocumentResult {
  isDuplicate: true;
  existingId: number;
}

/** Typed error thrown when a library limit would be exceeded */
export class LibraryLimitError extends Error {
  constructor(
    message: string,
    public readonly code: 'LIBRARY_COUNT_LIMIT' | 'LIBRARY_STORAGE_LIMIT',
  ) {
    super(message);
    this.name = 'LibraryLimitError';
  }
}

// ---------------------------------------------------------------------------
// Library usage
// ---------------------------------------------------------------------------

/**
 * Compute COUNT + SUM(file_size) for all documents owned by `userId`.
 * All statuses (pending / ready / failed) count toward usage.
 */
export async function getLibraryUsage(userId: string): Promise<LibraryUsage> {
  const rows = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalBytes: sql<number>`COALESCE(SUM(${documents.fileSize}), 0)`,
    })
    .from(documents)
    .where(eq(documents.userId, userId));

  const row = rows[0];
  return {
    count: Number(row?.count ?? 0),
    totalBytes: Number(row?.totalBytes ?? 0),
    maxCount: config.libraryMaxDocuments,
    maxBytes: config.libraryMaxBytes,
  };
}

// ---------------------------------------------------------------------------
// Core document operations
// ---------------------------------------------------------------------------

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
 * Enforces library limits (50 docs / 500 MB) before inserting.
 * Assigns a badge colour from BADGE_PALETTE based on current document count.
 *
 * @param fileBuffer - Raw file bytes
 * @param originalName - The original filename shown in the UI
 * @param mimeType - 'application/pdf' or 'text/plain'
 * @param userId - Document owner (defaults to 'default')
 */
export async function createDocument(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  userId = 'default',
): Promise<CreateDocumentResult | DuplicateDocumentResult> {
  // Compute SHA-256 hash server-side (never trust client-provided values)
  const contentHash = createHash('sha256').update(fileBuffer).digest('hex');

  // Deduplicate: if an identical file exists, return its ID immediately
  const existing = await findByHash(contentHash);
  if (existing) {
    return { isDuplicate: true, existingId: existing.id };
  }

  // Check library limits before writing anything
  const usage = await getLibraryUsage(userId);
  if (usage.count >= config.libraryMaxDocuments) {
    throw new LibraryLimitError(
      `Document limit reached: ${usage.count} / ${config.libraryMaxDocuments} documents`,
      'LIBRARY_COUNT_LIMIT',
    );
  }
  if (usage.totalBytes + fileBuffer.length > config.libraryMaxBytes) {
    const usedMb  = Math.round(usage.totalBytes / 1_048_576);
    const maxMb   = Math.round(config.libraryMaxBytes / 1_048_576);
    throw new LibraryLimitError(
      `Storage limit reached: ${usedMb} MB of ${maxMb} MB used`,
      'LIBRARY_STORAGE_LIMIT',
    );
  }

  // Assign badge colour based on current document count (before this insert)
  const badgeColour = assignBadgeColour(usage.count);

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
      userId,
      badgeColour,
    })
    .returning();

  logger.info('Document uploaded', {
    documentId: (row as DocumentRecord).id,
    originalName,
    mimeType,
    fileSize: fileBuffer.length,
    userId,
    badgeColour,
  });

  return { document: row as DocumentRecord, isDuplicate: false };
}

/**
 * List all documents for a user ordered by most recently uploaded.
 * F004: scoped by userId.
 */
export async function listDocuments(userId = 'default'): Promise<DocumentRecord[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(documents.createdAt)
    .then((rows) => rows.reverse() as DocumentRecord[]);
}

/** Get a single document by ID scoped to userId, or null if not found */
export async function getDocument(id: number, userId = 'default'): Promise<DocumentRecord | null> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
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
 * F004: scoped by userId.
 */
export async function deleteDocument(id: number, userId = 'default'): Promise<boolean> {
  const doc = await getDocument(id, userId);
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
    sqlite.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(id, userId);
  })();

  // Remove file from disk after the transaction commits (idempotent — ignore missing file)
  try {
    fs.unlinkSync(doc.filePath);
  } catch {
    // File may already be missing — not a failure condition
  }

  return true;
}

/**
 * Reset any documents stuck in 'pending' state (e.g. due to a server crash during ingestion).
 * Called once at startup from the API route module initialisation.
 * Synchronous — runs before the first request is served.
 * F004: scoped by userId so only the relevant user's docs are reset.
 */
export function resetStuckDocuments(userId = 'default'): void {
  sqlite
    .prepare(
      `UPDATE documents
       SET status = 'failed',
           error_message = 'Interrupted by restart — please re-upload'
       WHERE status = 'pending' AND user_id = ?`,
    )
    .run(userId);

  logger.info('resetStuckDocuments: reset pending docs to failed', { userId });
}
