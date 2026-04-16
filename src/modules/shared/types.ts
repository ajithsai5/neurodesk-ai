// File: src/modules/shared/types.ts
/**
 * Shared Type Definitions
 * Core TypeScript interfaces and types used across all modules.
 * Maps 1:1 with database schema tables for type-safe data access.
 * (Why: centralized types prevent duplication and ensure consistency between modules)
 */

// ============================================
// Enum Types
// String literal unions for status and role fields.
// Must match the enum values defined in the database schema.
// ============================================

// Conversation lifecycle states — controls visibility in sidebar
export type ConversationStatus = 'active' | 'archived';

// Message author — distinguishes user input from AI responses
export type MessageRole = 'user' | 'assistant';

// ============================================
// Core Data Interfaces
// Direct representations of database table rows.
// Used in API responses, service layer, and component props.
// ============================================

// Represents a single chat conversation with its settings
// @field personaId - Links to the persona defining the AI's system prompt
// @field providerId - Links to the provider config determining which LLM to use
export interface Conversation {
  id: string;
  title: string;
  status: ConversationStatus;
  personaId: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}

// Represents a single message within a conversation
// @field role - Whether this message is from the user or the AI assistant
// @field content - The message text (user input or AI response)
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

// Full persona definition including system prompt (used internally by chat service)
// @field systemPrompt - The LLM system prompt that defines the AI's behavior
export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon: string | null;
  sortOrder: number;
}

// Public-facing persona without systemPrompt (used in API responses)
// (Why: systemPrompt is excluded from API responses to keep it internal to the chat service)
export interface PersonaListItem {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  sortOrder: number;
}

// LLM provider configuration — defines available AI models
// @field providerName - Maps to SDK instances in llm-client.ts ('openai', 'anthropic')
// @field isAvailable - Allows disabling a provider without deleting its config
export interface ProviderConfig {
  id: string;
  providerName: string;
  modelId: string;
  displayName: string;
  isAvailable: boolean;
  sortOrder: number;
}

// Conversation with its full message history — used by the single-conversation API endpoint
export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
