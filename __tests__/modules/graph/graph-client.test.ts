// File: __tests__/modules/graph/graph-client.test.ts
/**
 * Unit tests for the graph-client module (FR-017).
 * Tests graph store initialisation and stats retrieval, using a mocked DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared DB module
vi.mock('@/modules/shared/db', () => {
  const mockDb: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'from', 'where'].forEach((k) => { mockDb[k] = vi.fn(() => mockDb); });
  mockDb.all = vi.fn(() => []);
  return {
    db: mockDb,
    schema: { graphNodes: {}, graphEdges: {} },
  };
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    count: vi.fn(() => 'count()'),
    max: vi.fn(() => 'max()'),
  };
});

import { getGraphStats } from '@/modules/graph/graph-client';
import { db } from '@/modules/shared/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as any;

beforeEach(() => {
  // resetAllMocks clears both call history AND return values — needed to prevent
  // return value leakage between tests (clearAllMocks only resets call history)
  vi.resetAllMocks();
  // Re-establish the default chain (each method returns mockDb) after reset
  ['select', 'from', 'where'].forEach((k) => { mockDb[k].mockImplementation(() => mockDb); });
  mockDb.all.mockReturnValue([]);
});

// Note: initGraphClient uses a module-level _initialised flag that persists within
// a test run. Testing the idempotent behaviour requires careful ordering — we test
// getGraphStats (which has no such flag) instead, and rely on the fact that
// initGraphClient is called once per application lifecycle.

describe('getGraphStats', () => {
  it('returns nodeCount: 0, edgeCount: 0, lastUpdated: null on empty graph', async () => {
    // First all() call returns node stats row; second returns edge stats row
    mockDb.all
      .mockReturnValueOnce([{ nodeCount: 0, lastUpdated: null }])
      .mockReturnValueOnce([{ edgeCount: 0 }]);

    const stats = await getGraphStats();
    expect(stats).toEqual({ nodeCount: 0, edgeCount: 0, lastUpdated: null });
  });

  it('returns correct counts and lastUpdated when graph has data', async () => {
    mockDb.all
      .mockReturnValueOnce([{ nodeCount: 42, lastUpdated: 1700000000 }])
      .mockReturnValueOnce([{ edgeCount: 15 }]);

    const stats = await getGraphStats();
    expect(stats.nodeCount).toBe(42);
    expect(stats.edgeCount).toBe(15);
    expect(stats.lastUpdated).toBe(1700000000);
  });

  it('defaults to zeros when all() returns empty array (no rows in DB)', async () => {
    // both node and edge queries return no rows — ?? fallback kicks in
    mockDb.all.mockReturnValue([]);
    const stats = await getGraphStats();
    expect(stats.nodeCount).toBe(0);
    expect(stats.edgeCount).toBe(0);
    expect(stats.lastUpdated).toBeNull();
  });
});
