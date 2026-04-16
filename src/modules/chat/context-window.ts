import { encodingForModel } from 'js-tiktoken';
import type { ChatMessage } from './types';

const encoder = encodingForModel('gpt-4o');

interface ContextWindowOptions {
  maxMessages: number;
  maxTokens: number;
}

function countTokens(text: string): number {
  return encoder.encode(text).length;
}

export function applyContextWindow(
  messages: ChatMessage[],
  options: ContextWindowOptions
): ChatMessage[] {
  if (messages.length === 0) return [];

  const maxMessages = Math.max(1, options.maxMessages);
  const maxTokens = options.maxTokens;

  // Step 1: Trim by message count (keep most recent)
  let trimmed = messages.length > maxMessages
    ? messages.slice(-maxMessages)
    : [...messages];

  // Step 2: Trim by token count (remove oldest until within cap)
  let totalTokens = trimmed.reduce((sum, msg) => sum + countTokens(msg.content), 0);

  while (totalTokens > maxTokens && trimmed.length > 1) {
    const removed = trimmed.shift()!;
    totalTokens -= countTokens(removed.content);
  }

  return trimmed;
}
