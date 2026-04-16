// File: src/modules/chat/chat-service.ts
/**
 * Chat Service — Core Business Logic
 * Orchestrates the full chat flow: validates conversation state, persists messages,
 * applies context windowing, streams LLM responses, and saves results asynchronously.
 * This is the main entry point called by the POST /api/chat route handler.
 * (Why: centralizes chat logic so the API route stays thin and testable)
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/modules/shared/db';
import { conversations, messages, personas, providerConfigs } from '@/modules/shared/db/schema';
import { streamChatResponse } from './llm-client';
import { applyContextWindow } from './context-window';
import { config } from '@/lib/config';
import { logger } from '@/modules/shared/logger';
import type { ChatRequest, ChatMessage } from './types';

// Handle an incoming chat message: validate, persist, build context, stream LLM response
// Orchestrates the full request lifecycle from user input to streaming AI response
// @param input - Validated chat request containing conversationId and message text
// @returns - Vercel AI SDK stream result for SSE response to client
export async function handleChatMessage(input: ChatRequest) {
  const { conversationId, message } = input;

  // Load conversation from DB and verify it exists and is active
  // (Why: archived conversations should not accept new messages)
  const conversation = db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Reject messages to archived conversations
  // (Why: returns same error as "not found" to avoid leaking conversation existence)
  if (conversation.status === 'archived') {
    throw new Error('Conversation not found');
  }

  // Load persona for system prompt
  // (Why: persona defines the AI's behavior/personality for this conversation)
  const persona = db
    .select()
    .from(personas)
    .where(eq(personas.id, conversation.personaId))
    .get();

  if (!persona) {
    // Fallback to a generic system prompt if persona was deleted
    // (Why: graceful degradation — conversation still works even if persona is missing)
    logger.warn('Persona not found, using default', { personaId: conversation.personaId });
  }

  const systemPrompt = persona?.systemPrompt ?? 'You are a helpful AI assistant.';

  // Load provider config to determine which LLM to call
  // (Why: provider config maps to the specific AI SDK instance and model)
  const provider = db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.id, conversation.providerId))
    .get();

  if (!provider) {
    throw new Error('Provider not found');
  }

  // Check provider availability before making the API call
  // (Why: fail fast with a clear error instead of hitting a downstream API error)
  if (!provider.isAvailable) {
    throw new Error(`AI service unavailable: ${provider.providerName}`);
  }

  // Save user message to DB immediately (before streaming)
  // (Why: ensures the message is persisted even if the LLM stream fails)
  const userMessageId = uuidv4();
  db.insert(messages).values({
    id: userMessageId,
    conversationId,
    role: 'user',
    content: message,
  }).run();

  // Auto-generate conversation title from first user message if still default
  // (Why: replaces "New Conversation" with meaningful text for sidebar display)
  if (conversation.title === 'New Conversation') {
    const title = message.slice(0, 200);
    db.update(conversations)
      .set({ title })
      .where(eq(conversations.id, conversationId))
      .run();
  }

  // Load full conversation history for context building
  // (Why: context window needs all messages to decide which to keep/trim)
  const history = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .all();

  // Map DB messages to the simplified ChatMessage format for the LLM
  // (Why: LLM only needs role + content, not database metadata)
  const allMessages: ChatMessage[] = history.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Apply hybrid context window (message count + token cap)
  // (Why: prevents exceeding the LLM's context window while keeping recent messages)
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

  // Stream response from the configured LLM provider
  const result = await streamChatResponse({
    providerName: provider.providerName,
    modelId: provider.modelId,
    systemPrompt,
    messages: chatMessages,
  });

  // Save assistant message once streaming completes (in background)
  // (Why: async save avoids blocking the SSE stream — message is persisted after full response)
  const assistantMessageId = uuidv4();
  result.text.then((fullText) => {
    // Insert the complete assistant response into the messages table
    db.insert(messages).values({
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      content: fullText,
    }).run();

    // Update conversation timestamp so it sorts to the top of the sidebar
    db.update(conversations)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(conversations.id, conversationId))
      .run();
  }).catch((err) => {
    // Log but don't throw — the user already received the streamed response
    // (Why: failing to save shouldn't crash the response that already streamed)
    logger.error('Failed to save assistant message', {
      conversationId,
      error: String(err),
    });
  });

  return result;
}
