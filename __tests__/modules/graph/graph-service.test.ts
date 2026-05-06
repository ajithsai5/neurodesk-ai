// File: __tests__/modules/graph/graph-service.test.ts
/**
 * Unit tests for the graph-service module (FR-017, FR-019).
 * Mocks the shared DB module so no real SQLite connection is needed.
 * Each test verifies the business-logic contract without hitting disk.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the shared DB ───────────────────────────────────────────────────────
// Chainable Drizzle mock — returns the same object for every fluent method call
vi.mock('@/modules/shared/db', () => {
  const mockDb: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'from', 'where', 'and', 'orderBy', 'limit', 'insert', 'values',
    'delete', 'update', 'set', 'like', 'eq', 'or'].forEach(
    (k) => { mockDb[k] = vi.fn(() => mockDb); }
  );
  mockDb.all = vi.fn(() => []);
  mockDb.run = vi.fn();
  mockDb.get = vi.fn(() => undefined);
  return {
    db: mockDb,
    schema: {
      graphNodes: {},
      graphEdges: {},
    },
  };
});

// Mock drizzle operators so the service can call them without crashing
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((_col: unknown, _val: unknown) => ({ _type: 'eq' })),
    and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
    like: vi.fn((_col: unknown, _val: unknown) => ({ _type: 'like' })),
    or: vi.fn((...args: unknown[]) => ({ _type: 'or', args })),
    desc: vi.fn((_col: unknown) => ({ _type: 'desc' })),
  };
});

vi.mock('@/modules/shared/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import the real implementation (uses the mocked DB above)
import {
  writeConversationNode,
  writeChunkNodes,
  queryGraph,
  queryCodeEntities,
  rerankWithGraph,
  cascadeDeleteConversation,
  createCrossDocumentEdges,
} from '@/modules/graph/graph-service';
import { db } from '@/modules/shared/db';

// Typed access to the mock DB for assertion
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as any;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all().returns [] (empty graph)
  mockDb.all.mockReturnValue([]);
});

// ─── writeConversationNode ────────────────────────────────────────────────────

describe('writeConversationNode', () => {
  it('calls db.insert to create a MESSAGE node', async () => {
    await writeConversationNode('conv-1', 'sess-1', 'Hello world');
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MESSAGE', label: 'Hello world' })
    );
  });

  it('does not throw when db.insert throws (graceful degradation)', async () => {
    mockDb.run.mockImplementationOnce(() => { throw new Error('DB error'); });
    await expect(writeConversationNode('conv-1', 'sess-1', 'Hi')).resolves.toBeUndefined();
  });

  it('creates a FOLLOWS edge when a previous MESSAGE node exists in session', async () => {
    // First all() call returns a previous node (for the FOLLOWS edge lookup)
    mockDb.all.mockReturnValueOnce([{ id: 'prev-node-id' }]).mockReturnValue([]);
    await writeConversationNode('conv-1', 'sess-1', 'Second message');
    // insert is called twice: once for the node, once for the edge
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});

// ─── writeChunkNodes ─────────────────────────────────────────────────────────

describe('writeChunkNodes', () => {
  it('inserts a CHUNK node for each chunk in the array', async () => {
    const chunks = [
      { id: 'chunk-1', text: 'First chunk text' },
      { id: 'chunk-2', text: 'Second chunk text' },
    ];
    await writeChunkNodes('sess-1', chunks);
    // values() should be called twice (one per chunk)
    expect(mockDb.values).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the chunks array is empty', async () => {
    await writeChunkNodes('sess-1', []);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('silently degrades when db.run throws', async () => {
    mockDb.run.mockImplementation(() => { throw new Error('DB write error'); });
    const chunks = [{ id: 'c1', text: 'some text' }];
    await expect(writeChunkNodes('sess-1', chunks)).resolves.toBeUndefined();
  });

  it('stores rich metadata in node properties when provided', async () => {
    mockDb.run.mockReset();
    const chunks = [{
      id: 'chunk-1',
      text: 'Some chunk text',
      documentId: 'doc-abc',
      pageNumber: 3,
      similarityScore: 0.87,
      retrievedAt: 1700000000000,
    }];
    await writeChunkNodes('sess-1', chunks);
    const allValuesCalls = mockDb.values.mock.calls.map((c: unknown[][]) => c[0]);
    const chunkNode = allValuesCalls.find(
      (v: Record<string, unknown>) => v.type === 'CHUNK'
    );
    expect(chunkNode).toBeDefined();
    const props = JSON.parse(chunkNode.properties as string) as Record<string, unknown>;
    expect(props.documentId).toBe('doc-abc');
    expect(props.pageNumber).toBe(3);
    expect(props.similarityScore).toBeCloseTo(0.87);
    expect(props.retrievedAt).toBe(1700000000000);
  });

  it('still works when only id and text are provided (backward compat)', async () => {
    mockDb.run.mockReset();
    const chunks = [{ id: 'chunk-x', text: 'plain chunk' }];
    await expect(writeChunkNodes('sess-1', chunks)).resolves.toBeUndefined();
  });

  it('creates a PART_OF edge linking each chunk to the session anchor when one exists', async () => {
    // The prior "silently degrades" test leaves mockDb.run as a throwing fn.
    // clearAllMocks() only resets call history — we must explicitly restore run.
    mockDb.run.mockReset();
    // The session anchor lookup (all()) returns a node with a known id
    mockDb.all.mockReturnValueOnce([{ id: 'anchor-node-id' }]);
    const chunks = [{ id: 'c1', text: 'first' }, { id: 'c2', text: 'second' }];
    await writeChunkNodes('sess-1', chunks);
    // insert is called: 2 chunk nodes + 2 PART_OF edges = 4 total
    expect(mockDb.insert).toHaveBeenCalledTimes(4);
    const allValuesCalls = mockDb.values.mock.calls.map((c: unknown[][]) => c[0]);
    const edgeCalls = allValuesCalls.filter(
      (v: Record<string, unknown>) => v.relationship === 'PART_OF'
    );
    expect(edgeCalls).toHaveLength(2);
    expect(edgeCalls[0].targetId).toBe('anchor-node-id');
  });
});

// ─── queryGraph ──────────────────────────────────────────────────────────────

describe('queryGraph', () => {
  it('returns { nodes: [], edges: [] } when no matching nodes found', async () => {
    mockDb.all.mockReturnValue([]);
    const result = await queryGraph('sess-1', 'anything', 50);
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('returns parsed nodes when matches are found', async () => {
    const rawNode = {
      id: 'node-1',
      conversationId: 'conv-1',
      sessionId: 'sess-1',
      type: 'MESSAGE',
      label: 'Hello world',
      properties: '{"role":"user"}',
      createdAt: 1000,
    };
    mockDb.all.mockReturnValueOnce([rawNode]).mockReturnValue([]); // nodes, then edges
    const result = await queryGraph('sess-1', 'hello', 50);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].properties).toEqual({ role: 'user' }); // JSON parsed
    expect(result.edges).toHaveLength(0);
  });

  it('returns original order and empty result on DB error', async () => {
    mockDb.all.mockImplementationOnce(() => { throw new Error('DB read error'); });
    const result = await queryGraph('sess-1', 'test', 50);
    expect(result).toEqual({ nodes: [], edges: [] });
  });
});

// ─── queryCodeEntities ────────────────────────────────────────────────────────

describe('queryCodeEntities', () => {
  it('returns an empty array when no CODE_ENTITY nodes match', async () => {
    mockDb.all.mockReturnValue([]);
    const result = await queryCodeEntities('sess-1', 'handleChatMessage');
    expect(result).toEqual([]);
  });

  it('returns matching CODE_ENTITY nodes', async () => {
    const entity = { id: 'e-1', label: 'handleChatMessage', properties: '{"kind":"function"}' };
    mockDb.all.mockReturnValue([entity]);
    const result = await queryCodeEntities('sess-1', 'handleChat');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'e-1', label: 'handleChatMessage' });
  });

  it('returns empty array on DB error (graceful degradation)', async () => {
    mockDb.all.mockImplementationOnce(() => { throw new Error('DB error'); });
    const result = await queryCodeEntities('sess-1', 'anything');
    expect(result).toEqual([]);
  });

  it('uses default limit of 10 when no limit arg is passed', async () => {
    mockDb.all.mockReturnValue([]);
    await queryCodeEntities('sess-1', 'fn');
    // The last .limit() call before .all() should be 10
    const limitCalls = mockDb.limit.mock.calls;
    expect(limitCalls[limitCalls.length - 1][0]).toBe(10);
  });

  it('uses custom limit when third arg is provided', async () => {
    mockDb.all.mockReturnValue([]);
    await queryCodeEntities('sess-1', 'fn', 20);
    const limitCalls = mockDb.limit.mock.calls;
    expect(limitCalls[limitCalls.length - 1][0]).toBe(20);
  });
});

// ─── rerankWithGraph ─────────────────────────────────────────────────────────

describe('rerankWithGraph', () => {
  it('returns the original order when the graph is empty', async () => {
    mockDb.all.mockReturnValue([]); // empty edges + nodes
    const candidates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = await rerankWithGraph('sess-1', candidates);
    expect(result).toEqual(candidates);
  });

  it('returns the original array when candidates is empty', async () => {
    const result = await rerankWithGraph('sess-1', []);
    expect(result).toEqual([]);
  });

  it('returns original order on DB error (graceful degradation)', async () => {
    mockDb.all.mockImplementationOnce(() => { throw new Error('DB error'); });
    const candidates = [{ id: 'x' }, { id: 'y' }];
    const result = await rerankWithGraph('sess-1', candidates);
    expect(result).toEqual(candidates);
  });

  it('reranks candidates by graph edge weight (highest first)', async () => {
    // First all() — edges; second all() — chunk nodes (with chunkId in properties)
    mockDb.all
      .mockReturnValueOnce([
        { sourceId: 'node-A', weight: 1 },
        { sourceId: 'node-B', weight: 5 },
        { sourceId: 'node-B', weight: 2 }, // duplicate increases B's total to 7
        { sourceId: 'node-C', weight: 3 },
      ])
      .mockReturnValueOnce([
        { id: 'node-A', properties: '{"chunkId":"chunk-A"}' },
        { id: 'node-B', properties: '{"chunkId":"chunk-B"}' },
        { id: 'node-C', properties: '{"chunkId":"chunk-C"}' },
        { id: 'node-D', properties: 'not-json{' }, // malformed — try/catch swallows
      ]);

    const candidates = [
      { id: 'chunk-A' },
      { id: 'chunk-B' },
      { id: 'chunk-C' },
    ];
    const result = await rerankWithGraph('sess-1', candidates);
    // chunk-B (weight 7) > chunk-C (3) > chunk-A (1)
    expect(result.map((c) => c.id)).toEqual(['chunk-B', 'chunk-C', 'chunk-A']);
  });

  it('skips edges whose sourceId has no matching chunk node', async () => {
    mockDb.all
      .mockReturnValueOnce([{ sourceId: 'unknown-node', weight: 99 }])
      .mockReturnValueOnce([
        { id: 'node-A', properties: '{"chunkId":"chunk-A"}' },
      ]);
    const candidates = [{ id: 'chunk-A' }, { id: 'chunk-B' }];
    const result = await rerankWithGraph('sess-1', candidates);
    // No matching chunk for the edge → weightMap is empty → original order
    expect(result.map((c) => c.id)).toEqual(['chunk-A', 'chunk-B']);
  });
});

// ─── cascadeDeleteConversation ───────────────────────────────────────────────

describe('cascadeDeleteConversation', () => {
  it('calls db.delete with the conversation ID', async () => {
    await cascadeDeleteConversation('conv-1');
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('silently degrades when db.delete throws', async () => {
    mockDb.run.mockImplementationOnce(() => { throw new Error('FK error'); });
    await expect(cascadeDeleteConversation('conv-bad')).resolves.toBeUndefined();
  });
});

// ─── F004 T042: writeChunkNodes with documentTitle ───────────────────────────

describe('writeChunkNodes — T042: documentTitle (F004)', () => {
  it('persists documentTitle in node properties JSON when provided', async () => {
    await writeChunkNodes('sess-1', [
      {
        id: 'chunk-1',
        text: 'Some text',
        documentId: 'doc-a.pdf',
        documentTitle: 'Research Paper A.pdf',
        pageNumber: 3,
        similarityScore: 0.9,
        retrievedAt: Date.now(),
      },
    ]);

    expect(mockDb.insert).toHaveBeenCalled();
    const insertCall = (mockDb.values as ReturnType<typeof vi.fn>).mock.calls
      .find((call: unknown[]) => {
        const arg = call[0] as { type?: string };
        return arg?.type === 'CHUNK';
      });
    expect(insertCall).toBeDefined();
    const nodeProps = JSON.parse((insertCall![0] as { properties: string }).properties) as Record<string, unknown>;
    expect(nodeProps.documentTitle).toBe('Research Paper A.pdf');
  });

  it('does not include documentTitle key when not provided', async () => {
    await writeChunkNodes('sess-1', [
      { id: 'chunk-2', text: 'Other text', documentId: 'doc-b.pdf' },
    ]);

    const insertCall = (mockDb.values as ReturnType<typeof vi.fn>).mock.calls
      .find((call: unknown[]) => {
        const arg = call[0] as { type?: string };
        return arg?.type === 'CHUNK';
      });
    expect(insertCall).toBeDefined();
    const nodeProps = JSON.parse((insertCall![0] as { properties: string }).properties) as Record<string, unknown>;
    expect(nodeProps).not.toHaveProperty('documentTitle');
  });
});

// ─── F004 T043–T045: createCrossDocumentEdges ────────────────────────────────

describe('createCrossDocumentEdges — T043: creates SIMILAR_TO edge for cross-doc pairs (F004)', () => {
  it('inserts a SIMILAR_TO edge for two chunks from different docs sharing ≥ 3 tokens', async () => {
    const chunks = [
      { id: 'chunk-a', text: 'attention mechanism transformer architecture model', documentId: 1 },
      { id: 'chunk-b', text: 'attention mechanism transformer model learning',  documentId: 2 },
    ];

    await createCrossDocumentEdges('sess-x', chunks);

    // insert should have been called at least once for the SIMILAR_TO edge
    expect(mockDb.insert).toHaveBeenCalled();
    const edgeCall = (mockDb.values as ReturnType<typeof vi.fn>).mock.calls
      .find((call: unknown[]) => {
        const arg = call[0] as { relationship?: string };
        return arg?.relationship === 'SIMILAR_TO';
      });
    expect(edgeCall).toBeDefined();
    expect((edgeCall![0] as { relationship: string }).relationship).toBe('SIMILAR_TO');
  });

  it('includes isCrossDocument=true and sharedTokenCount in edge properties', async () => {
    const chunks = [
      { id: 'chunk-a', text: 'attention mechanism transformer architecture model', documentId: 1 },
      { id: 'chunk-b', text: 'attention mechanism transformer model learning',  documentId: 2 },
    ];

    await createCrossDocumentEdges('sess-x', chunks);

    const edgeCall = (mockDb.values as ReturnType<typeof vi.fn>).mock.calls
      .find((call: unknown[]) => {
        const arg = call[0] as { relationship?: string };
        return arg?.relationship === 'SIMILAR_TO';
      });
    const edgeProps = JSON.parse((edgeCall![0] as { properties: string }).properties ?? '{}') as Record<string, unknown>;
    expect(edgeProps.isCrossDocument).toBe(true);
    expect(typeof edgeProps.sharedTokenCount).toBe('number');
    expect(Number(edgeProps.sharedTokenCount)).toBeGreaterThanOrEqual(3);
  });
});

describe('createCrossDocumentEdges — T044: no edges for same-document pairs (F004)', () => {
  it('does NOT create SIMILAR_TO edges between chunks from the same document', async () => {
    const chunks = [
      { id: 'chunk-a', text: 'attention mechanism transformer architecture model', documentId: 1 },
      { id: 'chunk-b', text: 'attention mechanism transformer model learning',  documentId: 1 }, // same doc
    ];

    await createCrossDocumentEdges('sess-x', chunks);

    const edgeCall = (mockDb.values as ReturnType<typeof vi.fn>).mock.calls
      .find((call: unknown[]) => {
        const arg = call[0] as { relationship?: string };
        return arg?.relationship === 'SIMILAR_TO';
      });
    expect(edgeCall).toBeUndefined();
  });
});

describe('createCrossDocumentEdges — T045: error handling (F004)', () => {
  it('does not propagate errors — resolves without throwing even when insert fails', async () => {
    mockDb.run.mockImplementationOnce(() => { throw new Error('DB write error'); });

    const chunks = [
      { id: 'chunk-a', text: 'attention mechanism transformer architecture model', documentId: 1 },
      { id: 'chunk-b', text: 'attention mechanism transformer model learning',  documentId: 2 },
    ];

    // Should resolve without throwing (fire-and-forget error handling)
    await expect(createCrossDocumentEdges('sess-x', chunks)).resolves.toBeUndefined();
  });
});
