// File: __tests__/api/code/generate.test.ts
/**
 * Integration tests for POST /api/code/generate (T013).
 * Mocks the code-service so the route handler is tested in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/modules/code', () => ({
  generateCode: vi.fn().mockResolvedValue('function hello() {}'),
  explainCode: vi.fn().mockResolvedValue('This code does X.'),
}));

import { POST } from '@/app/api/code/generate/route';
import { generateCode } from '@/modules/code';

const mockGenerateCode = generateCode as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/code/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateCode.mockResolvedValue('function hello() {}');
});

describe('POST /api/code/generate', () => {
  it('returns 200 with { code } for valid body { language, description }', async () => {
    const res = await POST(makeRequest({ language: 'typescript', description: 'a hello fn' }) as any);
    expect(res.status).toBe(200);
    const data = await res.json() as { code: string };
    expect(data.code).toBe('function hello() {}');
  });

  it('passes language, description, and sessionId to generateCode', async () => {
    await POST(makeRequest({ language: 'python', description: 'sort', sessionId: 'sess-x' }) as any);
    expect(mockGenerateCode).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'python', description: 'sort', sessionId: 'sess-x' }),
    );
  });

  it('returns 400 when language is missing', async () => {
    const res = await POST(makeRequest({ description: 'a function' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when description is missing', async () => {
    const res = await POST(makeRequest({ language: 'typescript' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when description exceeds maxLength (2000 chars)', async () => {
    const res = await POST(makeRequest({ language: 'js', description: 'x'.repeat(2001) }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/code/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 when generateCode throws', async () => {
    mockGenerateCode.mockRejectedValue(new Error('LLM down'));
    const res = await POST(makeRequest({ language: 'ts', description: 'fn' }) as any);
    expect(res.status).toBe(500);
  });
});
