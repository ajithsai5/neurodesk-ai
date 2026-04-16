// File: src/modules/chat/llm-client.ts
/**
 * LLM Client & Provider Abstraction
 * Wraps the Vercel AI SDK to provide a unified interface for multiple LLM providers.
 * Maps provider name strings to SDK instances and handles streaming responses.
 * (Why: abstracts provider differences so the chat service doesn't need provider-specific code)
 */

import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { StreamChatParams } from './types';

// Initialize provider SDK instances once at module load
// (Why: SDK clients are stateless and reusable — no need to recreate per request)
const openai = createOpenAI({});
const anthropic = createAnthropic({});

// Resolve a provider name + model ID to a Vercel AI SDK model instance
// To add a new provider: add a case here, install @ai-sdk/<provider>, and add a seed entry
// @param providerName - Provider key from the database ('openai', 'anthropic')
// @param modelId - Model identifier passed to the provider SDK (e.g., 'gpt-4o')
// @returns - A Vercel AI SDK model instance ready for streaming
export function getLLMModel(providerName: string, modelId: string) {
  switch (providerName) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}

// Stream a chat response from the configured LLM provider
// Combines provider resolution, system prompt, and message history into a single stream call
// @param params - Provider name, model ID, system prompt, and trimmed message history
// @returns - Vercel AI SDK stream result (consumed by toDataStreamResponse in the API route)
export async function streamChatResponse(params: StreamChatParams) {
  // Resolve the provider+model to an SDK instance
  const model = getLLMModel(params.providerName, params.modelId);

  // Stream the response using Vercel AI SDK
  // (Why: streaming provides real-time token output to the client via SSE)
  const result = streamText({
    model,
    system: params.systemPrompt,
    messages: params.messages,
  });

  return result;
}
