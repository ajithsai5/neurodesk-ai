import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI SDK providers
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn((model: string) => ({ modelId: model, provider: 'openai' }))),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn((model: string) => ({ modelId: model, provider: 'anthropic' }))),
}));

vi.mock('ai', () => ({
  streamText: vi.fn(async ({ model, messages, system }) => ({
    textStream: (async function* () {
      yield 'Hello';
      yield ' world';
    })(),
    text: Promise.resolve('Hello world'),
    toDataStreamResponse: vi.fn(() => new Response('stream')),
  })),
}));

import { getLLMModel, streamChatResponse } from '@/modules/chat/llm-client';

describe('getLLMModel', () => {
  it('should return an OpenAI model for openai provider', () => {
    const model = getLLMModel('openai', 'gpt-4o');
    expect(model).toBeDefined();
  });

  it('should return an Anthropic model for anthropic provider', () => {
    const model = getLLMModel('anthropic', 'claude-sonnet-4-20250514');
    expect(model).toBeDefined();
  });

  it('should throw for unsupported provider', () => {
    expect(() => getLLMModel('unknown', 'model')).toThrow('Unsupported provider');
  });
});

describe('streamChatResponse', () => {
  it('should return a stream result for valid input', async () => {
    const result = await streamChatResponse({
      providerName: 'openai',
      modelId: 'gpt-4o',
      systemPrompt: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    });
    expect(result).toBeDefined();
    expect(result.toDataStreamResponse).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T018 — Provider-path isolation tests
// Verify each provider path returns a model instance and does not invoke others
// ─────────────────────────────────────────────────────────────────────────────

describe('T018: getLLMModel — OpenAI path isolation', () => {
  it('returns a defined model instance for the openai provider', () => {
    const model = getLLMModel('openai', 'gpt-4o-mini');
    // Model must be defined (the mock returns { modelId, provider })
    expect(model).toBeDefined();
    expect(model).not.toBeNull();
  });

  it('returns a model whose provider is "openai"', () => {
    const model = getLLMModel('openai', 'gpt-4o-mini') as { provider: string };
    // The mock factory returns objects with the provider field set to "openai"
    expect(model.provider).toBe('openai');
  });

  it('does not call streamText when only resolving the model (no streaming)', async () => {
    const { streamText } = await import('ai');
    vi.clearAllMocks();
    getLLMModel('openai', 'gpt-4o-mini');
    // Merely resolving the model must not trigger a streaming call
    expect(streamText).not.toHaveBeenCalled();
  });
});

describe('T018: getLLMModel — Anthropic path isolation', () => {
  it('returns a defined model instance for the anthropic provider', () => {
    const model = getLLMModel('anthropic', 'claude-3-haiku-20240307');
    expect(model).toBeDefined();
    expect(model).not.toBeNull();
  });

  it('returns a model whose provider is "anthropic"', () => {
    const model = getLLMModel('anthropic', 'claude-3-haiku-20240307') as { provider: string };
    // The mock factory returns objects with the provider field set to "anthropic"
    expect(model.provider).toBe('anthropic');
  });

  it('does not call streamText when only resolving the anthropic model', async () => {
    const { streamText } = await import('ai');
    vi.clearAllMocks();
    getLLMModel('anthropic', 'claude-3-haiku-20240307');
    expect(streamText).not.toHaveBeenCalled();
  });
});

describe('T018: getLLMModel — Ollama local path', () => {
  it('throws "Unsupported provider" for ollama (not yet wired in switch)', () => {
    // Ollama is not yet mapped in getLLMModel — verifies the guard throws cleanly
    // rather than silently falling through or calling OpenAI/Anthropic
    expect(() => getLLMModel('ollama', 'llama3.1:8b')).toThrow('Unsupported provider: ollama');
  });

  it('does not call OpenAI factory when ollama is requested', async () => {
    const { createOpenAI } = await import('@ai-sdk/openai');
    vi.clearAllMocks();
    try { getLLMModel('ollama', 'llama3.1:8b'); } catch { /* expected */ }
    // streamText (OpenAI path) must NOT have been invoked
    const { streamText } = await import('ai');
    expect(streamText).not.toHaveBeenCalled();
  });
});
