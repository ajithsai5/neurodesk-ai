// File: __tests__/integration/graph-api.test.ts
/**
 * Integration tests for GET /api/graph/query and GET /api/health graph stats (FR-017).
 * Mocks the graph-service and graph-client so no real DB is needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock graph-service so no real SQLite is touched
vi.mock('@/modules/graph/graph-service', () => ({
  queryGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
}));

vi.mock('@/modules/graph/graph-client', () => ({
  getGraphStats: vi.fn().mockResolvedValue({ nodeCount: 0, edgeCount: 0, lastUpdated: null }),
}));

import { GET as graphQueryGET } from '@/app/api/graph/query/route';
import { GET as healthGET } from '@/app/api/health/route';
import { queryGraph } from '@/modules/graph/graph-service';

function makeReq(url: string) {
  const req = new Request(url) as Request & { nextUrl: URL };
  req.nextUrl = new URL(url) as URL;
  return req as import('next/server').NextRequest;
}

describe('GET /api/graph/query', () => {
  beforeEach(() => {
    vi.mocked(queryGraph).mockResolvedValue({ nodes: [], edges: [] });
  });

  it('returns 401 when conversationId is absent', async () => {
    const res = await graphQueryGET(makeReq('http://localhost/api/graph/query?q=test'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when q parameter is absent', async () => {
    const res = await graphQueryGET(
      makeReq('http://localhost/api/graph/query?conversationId=conv-1')
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('q');
  });

  it('returns 400 when limit is out of range (0)', async () => {
    const res = await graphQueryGET(
      makeReq('http://localhost/api/graph/query?conversationId=conv-1&q=test&limit=0')
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('limit');
  });

  it('returns 400 when limit is out of range (201)', async () => {
    const res = await graphQueryGET(
      makeReq('http://localhost/api/graph/query?conversationId=conv-1&q=test&limit=201')
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with empty nodes/edges on empty graph', async () => {
    const res = await graphQueryGET(
      makeReq('http://localhost/api/graph/query?conversationId=conv-1&q=test')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ nodes: [], edges: [] });
  });

  it('returns 500 on unexpected graph store error', async () => {
    vi.mocked(queryGraph).mockRejectedValueOnce(new Error('DB error'));
    const res = await graphQueryGET(
      makeReq('http://localhost/api/graph/query?conversationId=conv-1&q=test')
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Graph query failed');
  });
});

describe('GET /api/health — graph stats', () => {
  it('includes graph key in response with nodeCount and edgeCount', async () => {
    const res = await healthGET();
    const body = await res.json();
    expect(body).toHaveProperty('graph');
    expect(typeof body.graph.nodeCount).toBe('number');
    expect(typeof body.graph.edgeCount).toBe('number');
  });
});
