// File: src/modules/shared/db/schema.ts
/**
 * Database Schema Definitions
 * Defines all SQLite tables using Drizzle ORM for the NeuroDesk AI application.
 * Four tables: conversations, messages, personas, provider_configs.
 * (Why: Drizzle provides type-safe schema definitions that map directly to TypeScript types)
 */

import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================
// Core Tables — Conversations & Messages
// These tables store the chat history. Messages cascade-delete
// with their parent conversation to prevent orphaned records.
// ============================================

// Conversations table — each conversation has a persona (system prompt) and provider (LLM model)
// (Why: conversations are the top-level container that groups messages and tracks settings)
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  // Status controls visibility: 'active' shows in sidebar, 'archived' is hidden by default
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  // Foreign key to personas — determines the system prompt used for this conversation
  personaId: text('persona_id').notNull().references(() => personas.id),
  // Foreign key to provider_configs — determines which LLM model to use
  providerId: text('provider_id').notNull().references(() => providerConfigs.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  // Composite index for listing conversations by status sorted by most recent
  index('idx_conv_status_updated').on(table.status, table.updatedAt),
]);

// Messages table — stores individual chat messages within a conversation
// (Why: messages are separated from conversations to allow efficient querying and context windowing)
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  // Cascade delete: when a conversation is deleted, all its messages are removed automatically
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  // Role distinguishes user input from AI responses for proper message rendering
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  // Composite index for loading conversation history in chronological order
  index('idx_msg_conv_created').on(table.conversationId, table.createdAt),
]);

// ============================================
// Configuration Tables — Personas & Providers
// Admin-managed lookup tables that define available AI behaviors
// and LLM provider options. Read-only for end users in v1.
// ============================================

// Personas table — defines AI personality profiles with system prompts
// (Why: personas allow users to switch the AI's behavior without changing the conversation)
export const personas = sqliteTable('personas', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  // systemPrompt is the actual LLM system prompt — excluded from API responses for security
  systemPrompt: text('system_prompt').notNull(),
  icon: text('icon'),
  // sortOrder controls display order in the persona selector dropdown
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('idx_persona_sort').on(table.sortOrder),
]);

// Provider configs table — defines available LLM providers and models
// (Why: allows runtime model switching without code changes or redeployment)
export const providerConfigs = sqliteTable('provider_configs', {
  id: text('id').primaryKey(),
  // providerName maps to SDK instances in llm-client.ts (e.g., 'openai', 'anthropic')
  providerName: text('provider_name').notNull(),
  modelId: text('model_id').notNull(),
  displayName: text('display_name').notNull(),
  // isAvailable allows disabling a provider without removing it from the database
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  // Unique constraint prevents duplicate provider+model combinations
  uniqueIndex('idx_provider_model').on(table.providerName, table.modelId),
  index('idx_provider_sort').on(table.sortOrder),
]);
