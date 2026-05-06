// File: src/app/api/documents/route.ts
/**
 * Documents API — List and Upload
 *
 * GET  /api/documents  → returns all documents in the library + library usage stats
 * POST /api/documents  → upload a new document; enforces library limits; triggers async ingestion
 *
 * Contract: see specs/004-multi-document-rag-system/contracts/GET-documents.md
 *           and specs/004-multi-document-rag-system/contracts/POST-documents.md
 *
 * F004 changes:
 *  - GET: includes `usage: { count, totalBytes, maxCount, maxBytes }` and `badgeColour` per doc
 *  - POST: enforces 50-document / 500-MB library limits (LIBRARY_COUNT_LIMIT / LIBRARY_STORAGE_LIMIT)
 *  - Module init: calls resetStuckDocuments() so interrupted ingestions show as "failed" after restart
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createDocument,
  listDocuments,
  getLibraryUsage,
  resetStuckDocuments,
  LibraryLimitError,
} from '@/modules/rag/document-service';
import { ingestDocument } from '@/modules/rag';

// Supported MIME types for upload (FR-013)
const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain'] as const;
// 50 MB per-file size limit
const MAX_FILE_SIZE_BYTES = 52_428_800;

const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES);

// ---------------------------------------------------------------------------
// T022: Startup reset — mark any documents that were stuck in 'pending' as 'failed'.
// Called synchronously at module initialisation (before any request is served).
// (Why: if the server was killed mid-ingestion, those docs would be stuck forever)
// ---------------------------------------------------------------------------
resetStuckDocuments('default');

// ---------------------------------------------------------------------------
// GET /api/documents
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const [docs, usage] = await Promise.all([
      listDocuments('default'),
      getLibraryUsage('default'),
    ]);

    // Omit internal fields (storedName, filePath, contentHash, userId) from the response
    const sanitised = docs.map(({
      storedName: _s,
      filePath: _f,
      contentHash: _h,
      userId: _u,
      ...rest
    }) => rest);

    return NextResponse.json({ documents: sanitised, usage });
  } catch (err) {
    console.error('[GET /api/documents] Failed to list documents:', err);
    return NextResponse.json({ error: 'Failed to load document library.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/documents
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate MIME type
    const mimeResult = mimeTypeSchema.safeParse(file.type);
    if (!mimeResult.success) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported formats: PDF (.pdf), plain text (.txt)' },
        { status: 400 },
      );
    }

    // Validate file size (server-side, not trusting Content-Length)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds maximum size of 50 MB' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await createDocument(buffer, file.name, file.type, 'default');

    if (result.isDuplicate) {
      return NextResponse.json(
        { error: 'Document already in library', existingId: result.existingId },
        { status: 409 },
      );
    }

    const { document: doc } = result;

    // Trigger ingestion asynchronously — do NOT await (FR-010, SC-001)
    // The client polls GET /api/documents/:id for status updates
    void ingestDocument(doc.id).catch((err) => {
      console.error(`[POST /api/documents] Ingestion failed for doc ${doc.id}:`, err);
    });

    return NextResponse.json(
      {
        id: doc.id,
        status: doc.status,
        originalName: doc.originalName,
        createdAt: doc.createdAt,
      },
      { status: 202 },
    );
  } catch (err) {
    // T024: Return structured 400 for library limit violations
    if (err instanceof LibraryLimitError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    console.error('[POST /api/documents] Upload failed:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
