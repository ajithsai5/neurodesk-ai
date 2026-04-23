import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

// Health check route has no DB or external dependencies — no mocks needed

describe('GET /api/health', () => {
  // T013 — liveness probe returns 200 with { status: 'ok' }
  it('returns 200 with { status: "ok" }', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('returns a JSON Content-Type header', () => {
    const res = GET();
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns a fresh response on every call', () => {
    const res1 = GET();
    const res2 = GET();
    // Each call produces an independent Response object
    expect(res1).not.toBe(res2);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
