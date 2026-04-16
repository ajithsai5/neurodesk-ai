import { v4 as uuidv4 } from 'uuid';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/modules/shared/db';
import { conversations, messages, personas, providerConfigs } from '@/modules/shared/db/schema';
import { streamChatResponse } from './llm-client';
import { applyContextWindow } from './context-window';
import { config } from '@/lib/config';
import { logger } from '@/modules/shared/logger';
import type { ChatRequest, ChatMessage } from './types';

export async function handleChatMessage(input: ChatRequest) {
  const { conversationId, message } = input;

  // Load conversation
  const conversation = db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.status === 'archived') {
    throw new Error('Conversation not found');
  }

  // Load persona for system prompt
  const persona = db
    .select()
    .from(personas)
    .where(eq(personas.id, conversation.personaId))
    .get();

  if (!persona) {
    // Fallback: use a default system prompt
    logger.warn('Persona not found, using default', { personaId: conversation.personaId });
  }

  const systemPrompt = persona?.systemPrompt ?? 'You are a helpful AI assistant.';

  // Load provider config
  const provider = db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.id, conversation.providerId))
    .get();

  if (!provider) {
    throw new Error('Provider not found');
  }

  if (!provider.isAvailable) {
    throw new Error(`AI service unavailable: ${provider.providerName}`);
  }

  // Save user message
  const userMessageId = uuidv4();
  db.insert(messages).values({
    id: userMessageId,
    conversationId,
    role: 'user',
    content: message,
  }).run();

  // Auto-generate title from first message if it's the default
  if (conversation.title === 'New Conversation') {
    const title = message.slice(0, 200);
    db.update(conversations)
      .set({ title })
      .where(eq(conversations.id, conversationId))
      .run();
  }

  // Load conversation history for context
  const history = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .all();

  const allMessages: ChatMessage[] = history.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Apply hybrid context window (message count + token cap)
  const chatMessages = applyContextWindow(allMessages, {
    maxMessages: config.contextWindowSize,
    maxTokens: config.contextTokenCap,
  });

  logger.info('Streaming chat response', {
    conversationId,
    provider: provider.providerName,
    model: provider.modelId,
    totalMessages: allMessages.length,
    contextMessages: chatMessages.length,
  });

  // Stream response from LLM
  const result = await streamChatResponse({
    providerName: provider.providerName,
    modelId: provider.modelId,
    systemPrompt,
    messages: chatMessages,
  });

  // Save assistant message once streaming completes (in background)
  const assistantMessageId = uuidv4();
  result.text.then((fullText) => {
    db.insert(messages).values({
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      content: fullText,
    }).run();

    db.update(conversations)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(conversations.id, conversationId))
      .run();
  }).catch((err) => {
    logger.error('Failed to save assistant message', {
      conversationId,
      error: String(err),
    });
  });

  return result;
}
