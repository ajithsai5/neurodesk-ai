// File: src/modules/chat/index.ts
/**
 * Chat Module Public API
 * Barrel export for the chat module — exposes chat service, LLM client, and context window.
 * API routes import from here rather than reaching into internal files.
 * (Why: single entry point enforces module boundaries and keeps imports clean)
 */

export { handleChatMessage } from './chat-service';
export { getLLMModel, streamChatResponse } from './llm-client';
export { applyContextWindow } from './context-window';
export type { ChatRequest, ChatMessage, StreamChatParams } from './types';
