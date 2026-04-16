import { describe, it, expect } from 'vitest';
import { applyContextWindow } from '@/modules/chat/context-window';
import type { ChatMessage } from '@/modules/chat/types';

function makeMessages(count: number, contentSize = 10): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `Message ${i}: ${'x'.repeat(contentSize)}`,
  }));
}

describe('applyContextWindow', () => {
  it('should return all messages when under both limits', () => {
    const messages = makeMessages(5);
    const result = applyContextWindow(messages, { maxMessages: 20, maxTokens: 100_000 });
    expect(result).toHaveLength(5);
  });

  it('should trim to maxMessages when exceeded', () => {
    const messages = makeMessages(30);
    const result = applyContextWindow(messages, { maxMessages: 20, maxTokens: 100_000 });
    expect(result).toHaveLength(20);
    // Should keep the most recent messages
    expect(result[result.length - 1].content).toBe(messages[messages.length - 1].content);
  });

  it('should keep most recent messages when trimming by count', () => {
    const messages = makeMessages(10);
    const result = applyContextWindow(messages, { maxMessages: 3, maxTokens: 100_000 });
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe(messages[7].content);
    expect(result[2].content).toBe(messages[9].content);
  });

  it('should trim oldest messages when token cap exceeded', () => {
    // Each message ~30 tokens. 50 messages = ~1500 tokens total
    const messages = makeMessages(50, 100);
    const result = applyContextWindow(messages, { maxMessages: 50, maxTokens: 500 });
    expect(result.length).toBeLessThan(50);
    // Most recent message should always be retained
    expect(result[result.length - 1].content).toBe(messages[messages.length - 1].content);
  });

  it('should enforce minimum window of 1 message', () => {
    const messages = makeMessages(5, 100);
    const result = applyContextWindow(messages, { maxMessages: 20, maxTokens: 1 });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[result.length - 1].content).toBe(messages[messages.length - 1].content);
  });

  it('should handle empty messages array', () => {
    const result = applyContextWindow([], { maxMessages: 20, maxTokens: 100_000 });
    expect(result).toHaveLength(0);
  });

  it('should enforce minimum maxMessages of 1', () => {
    const messages = makeMessages(5);
    const result = applyContextWindow(messages, { maxMessages: 0, maxTokens: 100_000 });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should apply message count limit before token limit', () => {
    const messages = makeMessages(30, 10);
    const result = applyContextWindow(messages, { maxMessages: 10, maxTokens: 100_000 });
    expect(result).toHaveLength(10);
  });
});
