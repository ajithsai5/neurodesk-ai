/**
 * Integration tests for the Documents API routes.
 * Uses an in-memory SQLite database with sqlite-vec loaded so the full service
 * layer runs without touching the production database.
 * File I/O and ingestion are mocked to keep tests fast and side-effect-free.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// 1. Create the in-memory SQLite connection in vi.hoisted so it is available
//    inside the vi.mock() factory below (which also runs before imports).
//    Only native CJS modules (no TypeScript) can be required here.
// ---------------------------------------------------------------------------
const { testSqlite } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Database = require('better-sqlite3') as any;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqliteVec = require('sqlite-vec') as typeof import('sqlite-vec');

  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqliteVec.load(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT    NOT NULL,
      stored_name   TEXT    NOT NULL,
      file_path     TEXT    NOT NULL,
      mime_type     TEXT    NOT NULL,
      file_size     INTEGER NOT NULL,
      page_count    INTEGER,
      status        TEXT    NOT NULL DEFAULT 'pending',
      content_hash  TEXT    NOT NULL UNIQUE,
      error_message TEXT,
      user_id       TEXT    NOT NULL DEFAULT 'default',
      badge_colour  TEXT    NOT NULL DEFAULT '',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content     TEXT    NOT NULL,
      token_count INTEGER NOT NULL,
      user_id     TEXT    NOT NULL DEFAULT 'default',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
      chunk_id  INTEGER PRIMARY KEY,
      embedding FLOAT[768]
    )
  `);

  return { testSqlite: sqlite };
});

// ---------------------------------------------------------------------------
// 2. Replace the shared DB singleton.
//    We call importActual to get the real schema object (TypeScript, resolved
//    by Vitest's module system), then wrap testSqlite in a Drizzle instance.
// ---------------------------------------------------------------------------
vi.mock('@/modules/shared/db', async (importActual) => {
  const actual = await importActual<typeof import('@/modules/shared/db')>();
  const { drizzle } = await import('drizzle-orm/better-sqlite3');

  return {
    ...actual,
    db: drizzle(testSqlite, { schema: actual.schema }),
    sqlite: testSqlite,
  };
});

// ---------------------------------------------------------------------------
// 3. Mock fs to prevent real disk operations.
// ---------------------------------------------------------------------------
vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('')),
  };
});

// ---------------------------------------------------------------------------
// 4. Mock the ingestion pipeline to avoid Ollama calls.
// ---------------------------------------------------------------------------
vi.mock('@/modules/rag/ingestion-pipeline', async (importActual) => {
  const actual = await importActual<typeof import('@/modules/rag/ingestion-pipeline')>();
  return { ...actual, ingestDocument: vi.fn().mockResolvedValue(undefined) };
});

// ---------------------------------------------------------------------------
// 5. Import route handlers AFTER all mocks are in place.
// ---------------------------------------------------------------------------
import { GET as listDocs, POST as uploadDoc } from '@/app/api/documents/route';
import { GET as getDoc, DELETE as deleteDoc } from '@/app/api/documents/[id]/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest that looks like a multipart file upload. */
function makeUploadRequest(fileName: string, mimeType: string, sizeBytes: number): NextRequest {
  const fileContent = Buffer.alloc(sizeBytes, 65); // fill with 'A' bytes
  const file = new File([fileContent], fileName, { type: mimeType });
  const form = new FormData();
  form.append('file', file);
  return new NextRequest('http://localhost/api/documents', { method: 'POST', body: form });
}

/** Clear documents table between tests so each starts from a clean state. */
function clearDocuments() {
  testSqlite.prepare('DELETE FROM documents').run();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/documents', () => {
  beforeEach(clearDocuments);

  it('(a) returns 202 with id + status for a valid PDF upload', async () => {
    const res = await uploadDoc(makeUploadRequest('report.pdf', 'application/pdf', 1024));

    expect(res.status).toBe(202);
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.id).toBe('number');
    expect(body.status).toBe('pending');
    expect(body.originalName).toBe('report.pdf');
  });

  it('(b) returns 409 with existingId when the same file is uploaded twice', async () => {
    const res1 = await uploadDoc(makeUploadRequest('dupe.pdf', 'application/pdf', 512));
    expect(res1.status).toBe(202);
    const first = await res1.json() as { id: number };

    const res2 = await uploadDoc(makeUploadRequest('dupe.pdf', 'application/pdf', 512));
    expect(res2.status).toBe(409);
    const body = await res2.json() as { existingId: number };
    expect(body.existingId).toBe(first.id);
  });

  it('(c) returns 400 when file exceeds 50 MB', async () => {
    const res = await uploadDoc(makeUploadRequest('huge.pdf', 'application/pdf', 52_428_801));

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/50 MB/i);
  });

  it('(d) returns 400 for an unsupported MIME type', async () => {
    const res = await uploadDoc(
      makeUploadRequest('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 100),
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unsupported file type/i);
  });

  it('accepts text/plain as 202', async () => {
    const res = await uploadDoc(makeUploadRequest('notes.txt', 'text/plain', 256));
    expect(res.status).toBe(202);
  });
});

describe('GET /api/documents', () => {
  beforeEach(clearDocuments);

  it('(e) returns the document list after an upload', async () => {
    await uploadDoc(makeUploadRequest('sample.pdf', 'application/pdf', 512));

    const res = await listDocs();
    expect(res.status).toBe(200);
    const body = await res.json() as { documents: unknown[] };
    expect(Array.isArray(body.documents)).toBe(true);
    expect(body.documents.length).toBe(1);
  });

  it('returns an empty array when the library is empty', async () => {
    const res = await listDocs();
    expect(res.status).toBe(200);
    const body = await res.json() as { documents: unknown[] };
    expect(body.documents).toHaveLength(0);
  });

  it('omits internal fields (filePath, storedName, contentHash) from response', async () => {
    await uploadDoc(makeUploadRequest('internal.pdf', 'application/pdf', 128));

    const res = await listDocs();
    const body = await res.json() as { documents: Record<string, unknown>[] };
    const doc = body.documents[0]!;

    expect(doc.filePath).toBeUndefined();
    expect(doc.storedName).toBeUndefined();
    expect(doc.contentHash).toBeUndefined();
    expect(doc.id).toBeDefined();
    expect(doc.originalName).toBeDefined();
  });
});

describe('GET /api/documents/:id', () => {
  beforeEach(clearDocuments);

  it('returns 200 with document details for a known id', async () => {
    const uploadRes = await uploadDoc(makeUploadRequest('detail.pdf', 'application/pdf', 256));
    const { id } = await uploadRes.json() as { id: number };

    const res = await getDoc(
      new NextRequest(`http://localhost/api/documents/${id}`),
      { params: Promise.resolve({ id: String(id) }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { id: number; originalName: string };
    expect(body.id).toBe(id);
    expect(body.originalName).toBe('detail.pdf');
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await getDoc(
      new NextRequest('http://localhost/api/documents/99999'),
      { params: Promise.resolve({ id: '99999' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-integer id', async () => {
    const res = await getDoc(
      new NextRequest('http://localhost/api/documents/abc'),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/documents/:id', () => {
  beforeEach(clearDocuments);

  it('(f) returns 200 and removes the document from the DB', async () => {
    const uploadRes = await uploadDoc(makeUploadRequest('todelete.pdf', 'application/pdf', 512));
    const { id } = await uploadRes.json() as { id: number };

    const delRes = await deleteDoc(
      new NextRequest(`http://localhost/api/documents/${id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: String(id) }) },
    );

    expect(delRes.status).toBe(200);
    const body = await delRes.json() as { success: boolean };
    expect(body.success).toBe(true);

    // Verify the document is gone from the list
    const listBody = await listDocs().then((r) => r.json()) as { documents: unknown[] };
    expect(listBody.documents).toHaveLength(0);
  });

  it('(g) returns 404 when deleting a non-existent document', async () => {
    const res = await deleteDoc(
      new NextRequest('http://localhost/api/documents/99999', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '99999' }) },
    );
    expect(res.status).toBe(404);
  });
});
