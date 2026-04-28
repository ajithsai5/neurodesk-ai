// File: __tests__/modules/code/code-service.test.ts
/**
 * Unit tests for the code-service module (T012, T018, T024).
 * Mocks DB, LLM client, and graph service so no real connections are needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock LLM infrastructure ──────────────────────────────────────────────────

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@/modules/chat/llm-client', () => ({
  getLLMModel: vi.fn(() => 'mock-model'),
}));

// ─── Mock DB (provider config lookup) ────────────────────────────────────────

vi.mock('@/modules/shared/db', () => {
  const m: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'from', 'where', 'limit', 'orderBy'].forEach(
    (k) => { m[k] = vi.fn(() => m); }
  );
  m.get = vi.fn(() => ({
    providerName: 'ollama',
    modelId: 'llama3.1:8b',
    isAvailable: true,
  }));
  return {
    db: m,
    schema: { providerConfigs: {} },
  };
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((_col: unknown, _val: unknown) => ({ _type: 'eq' })),
  };
});

// ─── Mock graph service ───────────────────────────────────────────────────────

vi.mock('@/modules/graph/graph-service', () => ({
  queryCodeEntities: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/modules/shared/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateText } from 'ai';
import { getLLMModel } from '@/modules/chat/llm-client';
import { queryCodeEntities } from '@/modules/graph/graph-service';
import { generateCode, explainCode } from '@/modules/code';

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;
const mockGetLLMModel = getLLMModel as ReturnType<typeof vi.fn>;
const mockQueryCodeEntities = queryCodeEntities as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLLMModel.mockReturnValue('mock-model');
  mockGenerateText.mockResolvedValue({ text: 'generated content' });
  mockQueryCodeEntities.mockResolvedValue([]);
});

// ─── generateCode (T012) ─────────────────────────────────────────────────────

describe('generateCode', () => {
  it('returns generated code string for a valid request', async () => {
    mockGenerateText.mockResolvedValue({ text: 'function hello() {}' });
    const result = await generateCode({ language: 'typescript', description: 'A hello function' });
    expect(result).toBe('function hello() {}');
  });

  it('calls getLLMModel to resolve the provider', async () => {
    await generateCode({ language: 'python', description: 'a sort function' });
    expect(mockGetLLMModel).toHaveBeenCalled();
  });

  it('calls generateText with the language in the system prompt', async () => {
    await generateCode({ language: 'rust', description: 'a Vec sum function' });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('rust'),
        prompt: 'a Vec sum function',
      }),
    );
  });

  it('throws if LLM call fails (no silent degradation for primary flow)', async () => {
    mockGenerateText.mockRejectedValue(new Error('LLM error'));
    await expect(
      generateCode({ language: 'typescript', description: 'anything' }),
    ).rejects.toThrow('LLM error');
  });
});

// ─── explainCode (T018) ───────────────────────────────────────────────────────

describe('explainCode', () => {
  it('returns explanation string', async () => {
    mockGenerateText.mockResolvedValue({ text: 'This function adds two numbers.' });
    const result = await explainCode({ code: 'const add = (a, b) => a + b;' });
    expect(result).toBe('This function adds two numbers.');
  });

  it('includes language in system prompt when provided', async () => {
    await explainCode({ code: 'fn main() {}', language: 'rust' });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('rust'),
      }),
    );
  });

  it('defaults to "code" in system prompt when language is omitted', async () => {
    await explainCode({ code: 'x = 1' });
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('code'),
      }),
    );
  });

  it('throws if LLM call fails', async () => {
    mockGenerateText.mockRejectedValue(new Error('timeout'));
    await expect(explainCode({ code: 'anything' })).rejects.toThrow('timeout');
  });
});

// ─── Graph-aware generation (T024) ────────────────────────────────────────────

describe('graph-aware code generation', () => {
  it('injects CODE_ENTITY context into system prompt when entities exist', async () => {
    mockQueryCodeEntities.mockResolvedValue([
      { id: 'e1', label: 'MyService', properties: '{"kind":"class","filePath":"src/my-service.ts"}' },
    ]);

    await generateCode({ language: 'typescript', description: 'use MyService', sessionId: 'sess-1' });

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('MyService'),
      }),
    );
  });

  it('proceeds without context when graph returns empty array', async () => {
    mockQueryCodeEntities.mockResolvedValue([]);

    await generateCode({ language: 'python', description: 'a function', sessionId: 'sess-1' });

    // Should still call generateText without error
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0][0] as { system: string };
    expect(callArgs.system).not.toContain('CODEBASE CONTEXT');
  });

  it('falls back gracefully when queryCodeEntities throws', async () => {
    mockQueryCodeEntities.mockRejectedValue(new Error('graph error'));

    // Should NOT throw — graph enrichment is best-effort
    const result = await generateCode({
      language: 'typescript',
      description: 'a function',
      sessionId: 'sess-1',
    });
    expect(result).toBe('generated content');
  });
});
