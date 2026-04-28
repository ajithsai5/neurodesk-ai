// File: __tests__/api/code/explain.test.ts
/**
 * Integration tests for POST /api/code/explain (T019).
 * Mocks the code-service so the route handler is tested in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/modules/code', () => ({
  generateCode: vi.fn().mockResolvedValue('// code'),
  explainCode: vi.fn().mockResolvedValue('This code does X.'),
}));

import { POST } from '@/app/api/code/explain/route';
import { explainCode } from '@/modules/code';

const mockExplainCode = explainCode as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/code/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExplainCode.mockResolvedValue('This code does X.');
});

describe('POST /api/code/explain', () => {
  it('returns 200 with { explanation } for valid body { code }', async () => {
    const res = await POST(makeRequest({ code: 'const x = 1;' }) as any);
    expect(res.status).toBe(200);
    const data = await res.json() as { explanation: string };
    expect(data.explanation).toBe('This code does X.');
  });

  it('passes code, language, and sessionId to explainCode', async () => {
    await POST(makeRequest({ code: 'fn main() {}', language: 'rust', sessionId: 's1' }) as any);
    expect(mockExplainCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'fn main() {}', language: 'rust', sessionId: 's1' }),
    );
  });

  it('returns 400 when code is missing', async () => {
    const res = await POST(makeRequest({ language: 'python' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when code exceeds maxLength (10000 chars)', async () => {
    const res = await POST(makeRequest({ code: 'x'.repeat(10001) }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/code/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad{json',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 when explainCode throws', async () => {
    mockExplainCode.mockRejectedValue(new Error('LLM error'));
    const res = await POST(makeRequest({ code: 'x = 1' }) as any);
    expect(res.status).toBe(500);
  });
});
