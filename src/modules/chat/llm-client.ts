import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { StreamChatParams } from './types';

const openai = createOpenAI({});
const anthropic = createAnthropic({});

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

export async function streamChatResponse(params: StreamChatParams) {
  const model = getLLMModel(params.providerName, params.modelId);

  const result = streamText({
    model,
    system: params.systemPrompt,
    messages: params.messages,
  });

  return result;
}
