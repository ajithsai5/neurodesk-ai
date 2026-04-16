// File: src/modules/chat/context-window.ts
/**
 * Context Window Management
 * Hybrid sliding window: keeps last N messages (default 20)
 * plus enforces max token cap (default 100K) for safety.
 * Uses js-tiktoken with GPT-4o encoding for token counting.
 * (Why: prevents exceeding LLM context limits while preserving recent conversation context)
 */

import { encodingForModel } from 'js-tiktoken';
import type { ChatMessage } from './types';

// Initialize tiktoken encoder once at module load
// (Why: encoder initialization is expensive; reusing it avoids per-call overhead)
const encoder = encodingForModel('gpt-4o');

// Configuration options for the context window trimming
// @field maxMessages - Maximum number of recent messages to retain
// @field maxTokens - Maximum total token count across all retained messages
interface ContextWindowOptions {
  maxMessages: number;
  maxTokens: number;
}

// Count the number of tokens in a text string using tiktoken encoding
// @param text - The text to tokenize and count
// @returns - Number of tokens in the text
function countTokens(text: string): number {
  return encoder.encode(text).length;
}

// Trim messages to fit within hybrid context window (message count + token cap)
// If > maxMessages OR > maxTokens, removes oldest messages until both constraints met
// @param messages - Full array of messages in the conversation
// @param options - maxMessages and maxTokens constraints from config
// @returns - Trimmed array of messages that fit both constraints
export function applyContextWindow(
  messages: ChatMessage[],
  options: ContextWindowOptions
): ChatMessage[] {
  // Return empty array for empty conversations
  if (messages.length === 0) return [];

  // Ensure at least 1 message is always kept
  // (Why: sending zero messages to the LLM would produce a meaningless response)
  const maxMessages = Math.max(1, options.maxMessages);
  const maxTokens = options.maxTokens;

  // Step 1: Trim by message count (keep most recent)
  // (Why: recent messages are more relevant than older ones for conversational context)
  let trimmed = messages.length > maxMessages
    ? messages.slice(-maxMessages)
    : [...messages];

  // Step 2: Trim by token count (remove oldest until within cap)
  // (Why: even within message limit, very long messages could exceed the LLM's token window)
  let totalTokens = trimmed.reduce((sum, msg) => sum + countTokens(msg.content), 0);

  // Remove oldest messages one at a time until under token cap
  // (Why: preserves the most recent context which is most relevant to the current question)
  while (totalTokens > maxTokens && trimmed.length > 1) {
    const removed = trimmed.shift()!;
    totalTokens -= countTokens(removed.content);
  }

  return trimmed;
}
