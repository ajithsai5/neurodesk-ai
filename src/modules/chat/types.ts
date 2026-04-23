// File: src/modules/chat/types.ts
/**
 * Chat Module Type Definitions
 * Interfaces specific to the chat module's internal operations.
 * Separate from shared types to keep chat-specific concerns isolated.
 * (Why: chat module types differ from DB types — these represent runtime message formats)
 */

// Incoming chat request from the API route
// @field conversationId - UUID of the target conversation
// @field message - The user's message content (already validated by Zod)
// @field ragContext - Optional pre-formatted document context block injected by the RAG pipeline
export interface ChatRequest {
  conversationId: string;
  message: string;
  ragContext?: string;
}

// Parameters for streaming a response from an LLM provider
// @field providerName - Provider key used to resolve the SDK instance ('openai', 'anthropic')
// @field modelId - Specific model identifier (e.g., 'gpt-4o', 'claude-sonnet-4-20250514')
// @field systemPrompt - The persona's system prompt that shapes the AI's behavior
// @field messages - Trimmed conversation history to include as context
export interface StreamChatParams {
  providerName: string;
  modelId: string;
  systemPrompt: string;
  messages: ChatMessage[];
}

// Simplified message format for LLM context (stripped of DB metadata like id, timestamps)
// (Why: LLMs only need role + content, not database fields)
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
