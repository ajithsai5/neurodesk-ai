/**
 * Unit tests for retrieval-service.ts — T041 + T030 (US3 multi-turn context)
 *
 * retrieveChunks() depends on an in-process sqlite-vec query, so we mock
 * the shared db module (sqlite raw connection) and the embedding client to
 * keep tests hermetic. formatRagContext() is pure and tested directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Set up an in-memory SQLite with sqlite-vec for the vec query mock.
// ---------------------------------------------------------------------------
const { testSqlite } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Database = require('better-sqlite3') as any;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqliteVec = require('sqlite-vec') as typeof import('sqlite-vec');

  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqliteVec.load(sqlite);

  // Minimal tables needed for the JOIN in retrieveChunks
  sqlite.exec(`
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready'
    )
  `);
  sqlite.exec(`
    CREATE TABLE document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      page_number INTEGER NOT NULL,
      content TEXT NOT NULL
    )
  `);
  sqlite.exec(`
    CREATE VIRTUAL TABLE vec_document_chunks USING vec0(
      chunk_id INTEGER PRIMARY KEY,
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

// Mock generateEmbedding to return a deterministic 768-dim zero vector
vi.mock('@/modules/rag/embedding-client', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  EmbeddingError: class EmbeddingError extends Error {},
}));

import { retrieveChunks, formatRagContext, formatCitations, retrieveAndRerank } from '@/modules/rag/retrieval-service';
import type { RetrievedChunk } from '@/modules/rag/retrieval-service';
import { config } from '@/lib/config';

// ---------------------------------------------------------------------------
// Mocks for graph-service (used by retrieveAndRerank)
// ---------------------------------------------------------------------------

vi.mock('@/modules/graph/graph-service', () => ({
  writeChunkNodes: vi.fn().mockResolvedValue(undefined),
  rerankWithGraph: vi.fn().mockImplementation((_sessionId: string, candidates: unknown[]) =>
    Promise.resolve(candidates)
  ),
}));

import { writeChunkNodes, rerankWithGraph } from '@/modules/graph/graph-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Insert a document + chunk + vec entry into the test DB. */
function seedChunk(docName: string, content: string, page: number, fillValue: number): number {
  // Number() converts bigint lastInsertRowid → number so sqlite-vec accepts it as integer PK
  const docId = Number(testSqlite.prepare(
    `INSERT INTO documents (original_name, status) VALUES (?, 'ready')`,
  ).run(docName).lastInsertRowid);

  const chunkId = Number(testSqlite.prepare(
    `INSERT INTO document_chunks (document_id, page_number, content) VALUES (?, ?, ?)`,
  ).run(docId, page, content).lastInsertRowid);

  // sqlite-vec v0.1.x requires BigInt for the primary key column
  const embedding = new Float32Array(768).fill(fillValue);
  testSqlite.prepare(
    `INSERT INTO vec_document_chunks (chunk_id, embedding) VALUES (?, ?)`,
  ).run(BigInt(chunkId), embedding);

  return chunkId;
}

function clearTables() {
  testSqlite.prepare('DELETE FROM vec_document_chunks').run();
  testSqlite.prepare('DELETE FROM document_chunks').run();
  testSqlite.prepare('DELETE FROM documents').run();
}

// ---------------------------------------------------------------------------
// formatRagContext — pure function, no DB
// ---------------------------------------------------------------------------

describe('formatRagContext', () => {
  it('returns null for an empty chunk array (T030: multi-turn graceful fallback)', () => {
    expect(formatRagContext([])).toBeNull();
  });

  it('returns a context block with source headers for non-empty chunks', () => {
    const chunks: RetrievedChunk[] = [
      { chunkId: 1, content: 'The sky is blue.', pageNumber: 2, documentName: 'report.pdf', distance: 0.1 },
      { chunkId: 2, content: 'Water is wet.',    pageNumber: 5, documentName: 'notes.txt',  distance: 0.2 },
    ];
    const result = formatRagContext(chunks)!;

    expect(result).toContain('[DOCUMENT CONTEXT]');
    expect(result).toContain('Source: report.pdf, Page 2');
    expect(result).toContain('The sky is blue.');
    expect(result).toContain('Source: notes.txt, Page 5');
    expect(result).toContain('Water is wet.');
    expect(result).toContain('[END DOCUMENT CONTEXT]');
  });

  it('includes citation instructions (SC-003 compliance)', () => {
    const chunks: RetrievedChunk[] = [
      { chunkId: 1, content: 'Fact.', pageNumber: 1, documentName: 'doc.pdf', distance: 0.05 },
    ];
    const result = formatRagContext(chunks)!;
    expect(result).toMatch(/cite.*DocumentName.*Page/i);
  });

  it('instructs the LLM to decline when information is not in the documents', () => {
    const chunks: RetrievedChunk[] = [
      { chunkId: 1, content: 'Something.', pageNumber: 1, documentName: 'doc.pdf', distance: 0.1 },
    ];
    const result = formatRagContext(chunks)!;
    expect(result).toMatch(/not in the documents/i);
  });
});

// ---------------------------------------------------------------------------
// formatCitations — pure function, no DB (T033)
// ---------------------------------------------------------------------------

describe('formatCitations', () => {
  it('returns an empty array for empty chunks', () => {
    expect(formatCitations([])).toEqual([]);
  });

  it('maps each chunk to a Citation with documentName, pageNumber, and excerpt', () => {
    const chunks: RetrievedChunk[] = [
      { chunkId: 1, content: 'Quantum computing uses qubits.', pageNumber: 3, documentName: 'quantum.pdf', distance: 0.1 },
      { chunkId: 2, content: 'Superposition allows parallel states.', pageNumber: 5, documentName: 'quantum.pdf', distance: 0.2 },
    ];
    const result = formatCitations(chunks);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ documentName: 'quantum.pdf', pageNumber: 3, excerpt: 'Quantum computing uses qubits.' });
    expect(result[1]).toEqual({ documentName: 'quantum.pdf', pageNumber: 5, excerpt: 'Superposition allows parallel states.' });
  });

  it('produces [DocumentName, Page N] label strings from each citation', () => {
    const chunks: RetrievedChunk[] = [
      { chunkId: 1, content: 'Content here.', pageNumber: 7, documentName: 'report.pdf', distance: 0.05 },
    ];
    const [citation] = formatCitations(chunks);
    expect(`[${citation!.documentName}, Page ${citation!.pageNumber}]`).toBe('[report.pdf, Page 7]');
  });
});

// ---------------------------------------------------------------------------
// retrieveChunks — requires DB + sqlite-vec (T041)
// ---------------------------------------------------------------------------

describe('retrieveChunks', () => {
  beforeEach(clearTables);

  it('returns empty array when vec table has rows but all docs are failed/pending', async () => {
    // Insert a document with non-ready status and a chunk so there are vec rows to query
    const docId = Number(testSqlite.prepare(
      `INSERT INTO documents (original_name, status) VALUES ('bad.pdf', 'failed')`,
    ).run().lastInsertRowid);
    const chunkId = Number(testSqlite.prepare(
      `INSERT INTO document_chunks (document_id, page_number, content) VALUES (?, 1, 'orphan')`,
    ).run(docId).lastInsertRowid);
    testSqlite.prepare(
      `INSERT INTO vec_document_chunks (chunk_id, embedding) VALUES (?, ?)`,
    ).run(BigInt(chunkId), new Float32Array(768).fill(0.5));

    // The JOIN filters out non-ready docs, so result should be empty
    const results = await retrieveChunks('query', 5);
    expect(results).toEqual([]);
  });

  it('returns results ordered by ascending distance (most similar first)', async () => {
    seedChunk('a.pdf', 'Close match.',    1, 0.1);
    seedChunk('b.pdf', 'Less close.',     1, 0.5);
    seedChunk('c.pdf', 'Least similar.',  1, 0.9);

    const results = await retrieveChunks('query', 3);
    expect(results.length).toBe(3);
    // Results should be in ascending distance order
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i]!.distance).toBeLessThanOrEqual(results[i + 1]!.distance);
    }
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 8; i++) {
      seedChunk('doc.pdf', `Chunk ${i}`, i + 1, i * 0.1);
    }
    const results = await retrieveChunks('query', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns the correct RetrievedChunk shape', async () => {
    seedChunk('manual.pdf', 'Important content.', 7, 0.05);

    const results = await retrieveChunks('query', 1);
    expect(results.length).toBe(1);
    const chunk = results[0]!;
    expect(typeof chunk.chunkId).toBe('number');
    expect(chunk.content).toBe('Important content.');
    expect(chunk.pageNumber).toBe(7);
    expect(chunk.documentName).toBe('manual.pdf');
    expect(typeof chunk.distance).toBe('number');
  });

  it('T030: multi-turn — no RAG context when library is empty (ragContext stays undefined)', async () => {
    // This mirrors what the chat route does before calling handleChatMessage
    const docs: { status: string }[] = []; // empty library
    const hasReady = docs.some((d) => d.status === 'ready');
    expect(hasReady).toBe(false);

    // formatRagContext with no chunks returns null → route converts to undefined → no injection
    const ragContext = formatRagContext([]) ?? undefined;
    expect(ragContext).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// retrieveAndRerank — T006: graph-reranked retrieval pipeline
// ---------------------------------------------------------------------------

describe('retrieveAndRerank', () => {
  beforeEach(() => {
    clearTables();
    vi.clearAllMocks();
    // Default: rerankWithGraph returns candidates unchanged
    (rerankWithGraph as ReturnType<typeof vi.fn>).mockImplementation(
      (_sessionId: string, candidates: unknown[]) => Promise.resolve(candidates)
    );
  });

  it('calls retrieveChunks with ragCandidatePoolSize', async () => {
    // Seed 3 chunks so retrieveChunks can return results
    seedChunk('a.pdf', 'Chunk A', 1, 0.1);
    seedChunk('b.pdf', 'Chunk B', 2, 0.2);
    seedChunk('c.pdf', 'Chunk C', 3, 0.3);

    await retrieveAndRerank('session-1', 'test query');

    // writeChunkNodes should have been called — proof that retrieveChunks was called internally
    // We verify pool size indirectly: the mock writeChunkNodes receives the retrieved chunks
    // (the real retrieveChunks is used, seeded with 3 docs and called with ragCandidatePoolSize=20)
    expect(writeChunkNodes).toHaveBeenCalled();
    const [, chunksArg] = (writeChunkNodes as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { id: string }[]];
    // All 3 seeded chunks should be in the pool (pool=20, we only have 3)
    expect(chunksArg.length).toBe(3);
  });

  it('calls writeChunkNodes with the retrieved chunks in the correct shape', async () => {
    seedChunk('doc.pdf', 'Hello world', 5, 0.1);

    await retrieveAndRerank('session-abc', 'query');

    expect(writeChunkNodes).toHaveBeenCalledTimes(1);
    const [sessionId, chunks] = (writeChunkNodes as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { id: string; text: string; documentId: string; pageNumber: number; similarityScore: number; retrievedAt: number }[]];
    expect(sessionId).toBe('session-abc');
    expect(chunks.length).toBe(1);
    const c = chunks[0]!;
    expect(typeof c.id).toBe('string');
    expect(c.text).toBe('Hello world');
    expect(c.documentId).toBe('doc.pdf');
    expect(c.pageNumber).toBe(5);
    expect(typeof c.similarityScore).toBe('number');
    expect(typeof c.retrievedAt).toBe('number');
  });

  it('calls rerankWithGraph with sessionId and chunks', async () => {
    seedChunk('doc.pdf', 'Content', 1, 0.1);

    await retrieveAndRerank('session-xyz', 'query');

    expect(rerankWithGraph).toHaveBeenCalledTimes(1);
    const [sessionId, candidates] = (rerankWithGraph as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { id: string }[]];
    expect(sessionId).toBe('session-xyz');
    expect(candidates.length).toBe(1);
    expect(typeof candidates[0]!.id).toBe('string');
  });

  it('returns only ragFinalContextSize chunks when pool is larger', async () => {
    // Seed more chunks than ragFinalContextSize (5)
    for (let i = 0; i < 8; i++) {
      seedChunk('doc.pdf', `Chunk ${i}`, i + 1, i * 0.05);
    }
    // Make rerankWithGraph return all 8 candidates so slicing is what limits the result
    (rerankWithGraph as ReturnType<typeof vi.fn>).mockImplementation(
      (_sid: string, candidates: unknown[]) => Promise.resolve(candidates)
    );

    const result = await retrieveAndRerank('session-1', 'query');
    expect(result.length).toBeLessThanOrEqual(config.ragFinalContextSize);
  });

  it('returns empty array when retrieveChunks returns empty', async () => {
    // No seeded chunks → retrieveChunks returns []
    const result = await retrieveAndRerank('session-1', 'query');
    expect(result).toEqual([]);
    expect(writeChunkNodes).not.toHaveBeenCalled();
    expect(rerankWithGraph).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// formatCitations graphScore — T007
// ---------------------------------------------------------------------------

describe('formatCitations graphScore', () => {
  it('includes graphScore when present on the chunk', () => {
    const chunks = [
      { chunkId: 1, content: 'Some text.', pageNumber: 1, documentName: 'doc.pdf', distance: 0.1, graphScore: 0.8 },
    ] as RetrievedChunk[];
    const [citation] = formatCitations(chunks);
    expect(citation!.graphScore).toBe(0.8);
  });

  it('omits graphScore key when not present on the chunk', () => {
    const chunks: RetrievedChunk[] = [
      { chunkId: 1, content: 'Some text.', pageNumber: 1, documentName: 'doc.pdf', distance: 0.1 },
    ];
    const [citation] = formatCitations(chunks);
    expect(citation).not.toHaveProperty('graphScore');
  });
});
