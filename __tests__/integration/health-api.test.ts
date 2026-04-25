import { describe, it, expect, vi } from 'vitest';

// Mock the graph-client so getGraphStats doesn't hit the real SQLite DB
vi.mock('@/modules/graph/graph-client', () => ({
  getGraphStats: vi.fn().mockResolvedValue({
    nodeCount: 0,
    edgeCount: 0,
    lastUpdated: null,
  }),
}));

import { GET } from '@/app/api/health/route';

// Health check route — now includes graph stats in the response (FR-017)

describe('GET /api/health', () => {
  // T013 — liveness probe returns 200 with { status: 'ok' }
  it('returns 200 with { status: "ok" }', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('includes graph stats in the response body', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty('graph');
    expect(body.graph).toMatchObject({
      nodeCount: expect.any(Number),
      edgeCount: expect.any(Number),
    });
  });

  it('includes a timestamp in the response body', async () => {
    const res = await GET();
    const body = await res.json();
    expect(typeof body.timestamp).toBe('number');
  });

  it('returns graph: null when graph store throws (silent degradation)', async () => {
    const { getGraphStats } = await import('@/modules/graph/graph-client');
    vi.mocked(getGraphStats).mockRejectedValueOnce(new Error('DB unavailable'));

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.graph).toBeNull();
  });

  it('returns a JSON Content-Type header', async () => {
    const res = await GET();
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns a fresh response on every call', async () => {
    const res1 = await GET();
    const res2 = await GET();
    expect(res1).not.toBe(res2);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
