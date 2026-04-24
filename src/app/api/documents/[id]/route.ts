// File: src/app/api/documents/[id]/route.ts
/**
 * Documents API — Single Document Detail and Deletion
 *
 * GET    /api/documents/:id  → return document status (used for polling after upload)
 * DELETE /api/documents/:id  → permanently delete document, chunks, vec entries, and file
 *
 * Contract: see specs/002-document-qa-rag/contracts/GET-documents-id.md
 *           and specs/002-document-qa-rag/contracts/DELETE-documents-id.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDocument, deleteDocument } from '@/modules/rag';

type RouteParams = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
  }

  try {
    const doc = await getDocument(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Omit internal fields from the response
    const { storedName: _s, filePath: _f, contentHash: _h, ...safe } = doc;
    return NextResponse.json(safe);
  } catch (err) {
    console.error(`[GET /api/documents/${id}] Failed:`, err);
    return NextResponse.json({ error: 'Failed to load document.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
  }

  try {
    const deleted = await deleteDocument(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[DELETE /api/documents/${id}] Failed:`, err);
    return NextResponse.json({ error: 'Failed to delete document.' }, { status: 500 });
  }
}
