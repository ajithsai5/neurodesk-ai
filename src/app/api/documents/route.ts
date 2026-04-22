// File: src/app/api/documents/route.ts
/**
 * Documents API — List and Upload
 *
 * GET  /api/documents  → returns all documents in the library (ordered by most recent)
 * POST /api/documents  → upload a new document; triggers async ingestion pipeline
 *
 * Contract: see specs/002-document-qa-rag/contracts/GET-documents.md
 *           and specs/002-document-qa-rag/contracts/POST-documents.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDocument, listDocuments, ingestDocument } from '@/modules/rag';

// Supported MIME types for upload (FR-013)
const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain'] as const;
// 50 MB file size limit (SC-005)
const MAX_FILE_SIZE_BYTES = 52_428_800;

const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES);

export async function GET() {
  try {
    const docs = await listDocuments();

    // Omit internal fields (storedName, filePath, contentHash) from the response
    const sanitised = docs.map(({ storedName: _s, filePath: _f, contentHash: _h, ...rest }) => rest);

    return NextResponse.json({ documents: sanitised });
  } catch (err) {
    console.error('[GET /api/documents] Failed to list documents:', err);
    return NextResponse.json({ error: 'Failed to load document library.' }, { status: 500 });
  }
}

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
    const result = await createDocument(buffer, file.name, file.type);

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
    console.error('[POST /api/documents] Upload failed:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
