// File: src/modules/shared/db/schema.ts
/**
 * Database Schema Definitions
 * Defines all SQLite tables using Drizzle ORM for the NeuroDesk AI application.
 * Four tables: conversations, messages, personas, provider_configs.
 * (Why: Drizzle provides type-safe schema definitions that map directly to TypeScript types)
 */

import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
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

// ============================================
// Graph Store Tables — Knowledge Graph
// Two tables store the knowledge graph nodes and edges built from
// conversation messages, RAG document chunks, and code entities.
// Nodes are session-scoped; edges cascade-delete with their source/target node.
// ============================================

// Graph nodes table — each node represents a MESSAGE, CHUNK (RAG), or CODE_ENTITY
// (Why: a flat node table is simpler than a dedicated graph DB while satisfying SC-005 for ≤50 nodes)
export const graphNodes = sqliteTable('graph_nodes', {
  id: text('id').primaryKey(),
  // conversationId is nullable: MESSAGE nodes reference a conversation; CODE_ENTITY nodes do not
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  // type distinguishes node categories: MESSAGE (chat turns), CHUNK (RAG docs), CODE_ENTITY (AST symbols)
  type: text('type', { enum: ['MESSAGE', 'CHUNK', 'CODE_ENTITY'] }).notNull(),
  label: text('label').notNull(),
  // properties stores arbitrary JSON metadata (e.g. role, filePath, kind, lineStart, lineEnd)
  properties: text('properties').notNull().default('{}'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('idx_graph_nodes_conv').on(table.conversationId),
  index('idx_graph_nodes_session').on(table.sessionId),
  index('idx_graph_nodes_type').on(table.type),
]);

// Graph edges table — directed relationships between nodes
// (Why: edges encode context (FOLLOWS = sequential messages, PART_OF = chunk hierarchy, etc.))
export const graphEdges = sqliteTable('graph_edges', {
  id: text('id').primaryKey(),
  // Both FKs cascade-delete so removing a node automatically cleans up its incident edges
  sourceId: text('source_id').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
  relationship: text('relationship', { enum: ['FOLLOWS', 'REFERENCES', 'PART_OF', 'SIMILAR_TO'] }).notNull(),
  // weight is used for graph-based RAG re-ranking (higher = stronger connection)
  weight: real('weight').notNull().default(1.0),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('idx_graph_edges_source').on(table.sourceId),
  index('idx_graph_edges_target').on(table.targetId),
  index('idx_graph_edges_rel').on(table.relationship),
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
