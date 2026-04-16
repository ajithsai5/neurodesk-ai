import { describe, it, expect, vi } from 'vitest';

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
