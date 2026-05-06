// File: __tests__/integration/multi-doc-rag.test.ts
/**
 * Integration tests for multi-document RAG — T034 (F004)
 *
 * Verifies that retrieveAndRerank returns chunks from multiple documents
 * when the library contains more than one indexed document.
 * Uses an in-memory SQLite with real sqlite-vec so the full retrieval path executes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory SQLite with F004 schema
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
      status        TEXT    NOT NULL DEFAULT 'ready',
      user_id       TEXT    NOT NULL DEFAULT 'default',
      badge_colour  TEXT    NOT NULL DEFAULT ''
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      content     TEXT    NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 10,
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

vi.mock('@/modules/rag/embedding-client', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  EmbeddingError: class EmbeddingError extends Error {},
}));

vi.mock('@/modules/graph/graph-service', () => ({
  writeChunkNodes: vi.fn().mockResolvedValue(undefined),
  rerankWithGraph: vi.fn().mockImplementation((_sid: string, candidates: unknown[]) =>
    Promise.resolve(candidates),
  ),
  createCrossDocumentEdges: vi.fn().mockResolvedValue(undefined),
}));

import { retrieveAndRerank } from '@/modules/rag/retrieval-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearTables() {
  testSqlite.prepare('DELETE FROM vec_document_chunks').run();
  testSqlite.prepare('DELETE FROM document_chunks').run();
  testSqlite.prepare('DELETE FROM documents').run();
}

function seedDocWithChunk(docName: string, content: string, fillValue: number): number {
  const docId = Number(
    testSqlite.prepare(
      `INSERT INTO documents (original_name, status) VALUES (?, 'ready')`,
    ).run(docName).lastInsertRowid,
  );

  const chunkId = Number(
    testSqlite.prepare(
      `INSERT INTO document_chunks (document_id, page_number, content) VALUES (?, 1, ?)`,
    ).run(docId, content).lastInsertRowid,
  );

  testSqlite.prepare(
    `INSERT INTO vec_document_chunks (chunk_id, embedding) VALUES (?, ?)`,
  ).run(BigInt(chunkId), new Float32Array(768).fill(fillValue));

  return docId;
}

// ---------------------------------------------------------------------------
// T034: multi-document retrieval integration
// ---------------------------------------------------------------------------

describe('retrieveAndRerank — T034: multi-document retrieval (F004)', () => {
  beforeEach(clearTables);

  it('returns chunks from both documents when two are indexed', async () => {
    seedDocWithChunk('paper-a.pdf', 'Attention mechanisms in transformers.', 0.1);
    seedDocWithChunk('report-b.pdf', 'BERT uses bidirectional attention.', 0.2);

    const results = await retrieveAndRerank('session-multi', 'attention mechanisms');

    const docNames = results.map((r) => r.documentName);
    expect(docNames).toContain('paper-a.pdf');
    expect(docNames).toContain('report-b.pdf');
  });

  it('filters to only specified documents when documentIds provided', async () => {
    const docAId = seedDocWithChunk('doc-a.pdf', 'Content from A', 0.1);
    seedDocWithChunk('doc-b.pdf', 'Content from B', 0.2);

    const results = await retrieveAndRerank('session-filter', 'query', [docAId]);

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.documentName).toBe('doc-a.pdf');
    }
  });

  it('returns empty array when no documents are indexed', async () => {
    const results = await retrieveAndRerank('session-empty', 'any query');
    expect(results).toEqual([]);
  });

  it('each result chunk has documentId and similarityScore populated', async () => {
    const docId = seedDocWithChunk('test.pdf', 'Test content', 0.1);

    const results = await retrieveAndRerank('session-shape', 'test');

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(typeof r.documentId).toBe('number');
      expect(r.documentId).toBe(docId);
      expect(typeof r.similarityScore).toBe('number');
      expect(r.similarityScore).toBeGreaterThanOrEqual(0);
      expect(r.similarityScore).toBeLessThanOrEqual(1);
    }
  });
});
