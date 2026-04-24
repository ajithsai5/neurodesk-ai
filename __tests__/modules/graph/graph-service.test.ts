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
