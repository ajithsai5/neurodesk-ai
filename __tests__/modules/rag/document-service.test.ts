// File: __tests__/modules/rag/document-service.test.ts
/**
 * Unit tests for F004 document-service changes — T012–T016
 * These tests MUST FAIL before T017–T021 (implementation) is complete.
 *
 * Covers:
 *  - T012: badgeColour assigned on createDocument
 *  - T013: getLibraryUsage returns count + totalBytes
 *  - T014: createDocument rejects when count ≥ 50 or bytes would exceed 500 MB;
 *          scopes to userId = "default"
 *  - T015: resetStuckDocuments transitions pending → failed
 *  - T016: listDocuments only returns rows for userId = "default"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory SQLite with the F004 schema (including user_id + badge_colour)
// ---------------------------------------------------------------------------
const { testSqlite } = vi.hoisted(() => {
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

vi.mock('@/modules/shared/db', async (importActual) => {
  const actual = await importActual<typeof import('@/modules/shared/db')>();
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  return {
    ...actual,
    db: drizzle(testSqlite, { schema: actual.schema }),
    sqlite: testSqlite,
  };
});

vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

import {
  createDocument,
  listDocuments,
  getLibraryUsage,
  resetStuckDocuments,
  BADGE_PALETTE,
} from '@/modules/rag/document-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let seq = 0;
function makeBuffer(bytes = 1024): Buffer {
  seq++;
  // Unique content per call so SHA-256 hashes differ
  return Buffer.alloc(bytes, seq);
}

function clearDocuments() {
  testSqlite.prepare('DELETE FROM documents').run();
}

// Insert a document row directly (bypasses createDocument validation)
function insertDoc(opts: {
  status?: 'pending' | 'ready' | 'failed';
  userId?: string;
  fileSizeBytes?: number;
}) {
  const { status = 'ready', userId = 'default', fileSizeBytes = 1024 } = opts;
  testSqlite.prepare(`
    INSERT INTO documents (original_name, stored_name, file_path, mime_type, file_size, status,
                           content_hash, user_id, badge_colour)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `doc-${Date.now()}-${Math.random()}.pdf`,
    `stored-${Math.random()}.pdf`,
    `/data/documents/stored-${Math.random()}.pdf`,
    'application/pdf',
    fileSizeBytes,
    status,
    `hash-${Math.random()}-${Date.now()}`,
    userId,
    '#E86C3A',
  );
}

// ---------------------------------------------------------------------------
// T012: badgeColour assigned on createDocument
// ---------------------------------------------------------------------------

describe('createDocument — T012: badge colour', () => {
  beforeEach(clearDocuments);

  it('BADGE_PALETTE is exported and has 8 hex entries', () => {
    expect(Array.isArray(BADGE_PALETTE)).toBe(true);
    expect(BADGE_PALETTE).toHaveLength(8);
    for (const colour of BADGE_PALETTE) {
      expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('assigns first palette colour to first document', async () => {
    const result = await createDocument(makeBuffer(), 'first.pdf', 'application/pdf');
    expect(result.isDuplicate).toBe(false);
    if (!result.isDuplicate) {
      expect(result.document.badgeColour).toBe(BADGE_PALETTE[0]);
    }
  });

  it('assigns second palette colour to second document', async () => {
    await createDocument(makeBuffer(), 'first.pdf', 'application/pdf');
    const result = await createDocument(makeBuffer(), 'second.pdf', 'application/pdf');
    expect(result.isDuplicate).toBe(false);
    if (!result.isDuplicate) {
      expect(result.document.badgeColour).toBe(BADGE_PALETTE[1]);
    }
  });

  it('wraps palette after 8 documents', async () => {
    // Insert 8 docs so the 9th gets index 0 again
    for (let i = 0; i < 8; i++) {
      insertDoc({ status: 'ready' });
    }
    const result = await createDocument(makeBuffer(), 'ninth.pdf', 'application/pdf');
    expect(result.isDuplicate).toBe(false);
    if (!result.isDuplicate) {
      expect(result.document.badgeColour).toBe(BADGE_PALETTE[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// T013: getLibraryUsage
// ---------------------------------------------------------------------------

describe('getLibraryUsage — T013', () => {
  beforeEach(clearDocuments);

  it('returns zero usage for an empty library', async () => {
    const usage = await getLibraryUsage('default');
    expect(usage.count).toBe(0);
    expect(usage.totalBytes).toBe(0);
    expect(usage.maxCount).toBe(50);
    expect(usage.maxBytes).toBe(524_288_000);
  });

  it('counts only documents for the specified userId', async () => {
    insertDoc({ userId: 'default', fileSizeBytes: 1000 });
    insertDoc({ userId: 'default', fileSizeBytes: 2000 });
    insertDoc({ userId: 'other-user', fileSizeBytes: 9999 });

    const usage = await getLibraryUsage('default');
    expect(usage.count).toBe(2);
    expect(usage.totalBytes).toBe(3000);
  });

  it('sums totalBytes from all statuses (pending counts toward storage)', async () => {
    insertDoc({ userId: 'default', fileSizeBytes: 500, status: 'pending' });
    insertDoc({ userId: 'default', fileSizeBytes: 500, status: 'ready' });
    insertDoc({ userId: 'default', fileSizeBytes: 500, status: 'failed' });

    const usage = await getLibraryUsage('default');
    expect(usage.count).toBe(3);
    expect(usage.totalBytes).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// T014: createDocument rejects on limit violation + scopes to userId
// ---------------------------------------------------------------------------

describe('createDocument — T014: library limits', () => {
  beforeEach(clearDocuments);

  it('rejects with LIBRARY_COUNT_LIMIT when 50 documents already exist', async () => {
    for (let i = 0; i < 50; i++) {
      insertDoc({ status: 'ready' });
    }
    await expect(
      createDocument(makeBuffer(), 'overflow.pdf', 'application/pdf'),
    ).rejects.toMatchObject({ code: 'LIBRARY_COUNT_LIMIT' });
  });

  it('rejects with LIBRARY_STORAGE_LIMIT when adding would exceed 500 MB', async () => {
    // Insert one doc that consumes just under the limit
    insertDoc({ fileSizeBytes: 524_000_000, status: 'ready' });

    // Attempting to add another ~500 KB file should exceed the limit
    await expect(
      createDocument(makeBuffer(512_000), 'overflow.pdf', 'application/pdf'),
    ).rejects.toMatchObject({ code: 'LIBRARY_STORAGE_LIMIT' });
  });

  it('persists userId = "default" on the created document', async () => {
    const result = await createDocument(makeBuffer(), 'scoped.pdf', 'application/pdf');
    expect(result.isDuplicate).toBe(false);
    if (!result.isDuplicate) {
      expect(result.document.userId).toBe('default');
    }
  });
});

// ---------------------------------------------------------------------------
// T015: resetStuckDocuments
// ---------------------------------------------------------------------------

describe('resetStuckDocuments — T015', () => {
  beforeEach(clearDocuments);

  it('transitions all pending docs to failed with the interrupted message', () => {
    insertDoc({ status: 'pending' });
    insertDoc({ status: 'pending' });
    insertDoc({ status: 'ready' }); // must remain ready

    resetStuckDocuments('default');

    const rows = testSqlite.prepare(
      `SELECT status, error_message FROM documents WHERE user_id = 'default'`,
    ).all() as Array<{ status: string; error_message: string | null }>;

    const pending  = rows.filter((r) => r.status === 'pending');
    const failed   = rows.filter((r) => r.status === 'failed');
    const ready    = rows.filter((r) => r.status === 'ready');

    expect(pending).toHaveLength(0);
    expect(failed).toHaveLength(2);
    expect(ready).toHaveLength(1);
    for (const f of failed) {
      expect(f.error_message).toMatch(/interrupted/i);
    }
  });

  it('does not affect docs from a different userId', () => {
    insertDoc({ status: 'pending', userId: 'other-user' });

    resetStuckDocuments('default');

    const row = testSqlite.prepare(
      `SELECT status FROM documents WHERE user_id = 'other-user'`,
    ).get() as { status: string } | undefined;
    expect(row?.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// T016: listDocuments scopes by userId
// ---------------------------------------------------------------------------

describe('listDocuments — T016: userId scoping', () => {
  beforeEach(clearDocuments);

  it('returns only documents owned by the querying user', async () => {
    insertDoc({ userId: 'default' });
    insertDoc({ userId: 'default' });
    insertDoc({ userId: 'other-user' });

    const docs = await listDocuments('default');
    expect(docs).toHaveLength(2);
    for (const doc of docs) {
      expect(doc.userId).toBe('default');
    }
  });

  it('returns empty array when user has no documents', async () => {
    insertDoc({ userId: 'other-user' });
    const docs = await listDocuments('default');
    expect(docs).toHaveLength(0);
  });
});
