// File: src/modules/shared/db/schema.ts
/**
 * Database Schema Definitions
 * Defines all SQLite tables using Drizzle ORM for the NeuroDesk AI application.
 * Six tables: conversations, messages, personas, provider_configs, documents, document_chunks.
 * The vec_document_chunks virtual table (sqlite-vec) is created separately in db/index.ts.
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
  // F004: properties stores optional JSON metadata for the edge (e.g. shared token count for SIMILAR_TO)
  // Nullable — only populated when additional context is useful for downstream consumers
  properties: text('properties'),
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
  // providerName maps to SDK instances in llm-client.ts (e.g., 'openai', 'anthropic', 'ollama')
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

// ============================================
// RAG Tables — Document Library
// Stores uploaded documents and their text chunks for retrieval-augmented generation.
// The vector embeddings live in the sqlite-vec virtual table (vec_document_chunks)
// created in db/index.ts — Drizzle does not manage virtual tables.
// ============================================

// Documents table — user-global document library accessible from all conversations
// (Why: documents persist across sessions and are available to any conversation)
export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // originalName is the filename shown in the UI (never used for filesystem paths)
  originalName: text('original_name').notNull(),
  // storedName is the UUID-based filename used on disk (prevents path traversal)
  storedName: text('stored_name').notNull(),
  filePath: text('file_path').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  // pageCount is null while pending; populated after text extraction completes
  pageCount: integer('page_count'),
  // status drives the processing lifecycle: pending → ready | failed
  status: text('status', { enum: ['pending', 'ready', 'failed'] }).notNull().default('pending'),
  // contentHash (SHA-256) is the deduplication key — UNIQUE enforced at DB level
  contentHash: text('content_hash').notNull().unique(),
  // errorMessage is populated when status = 'failed'; null otherwise
  errorMessage: text('error_message'),
  // F004: userId scopes documents to a user — fixed 'default' in v1, reserved for F006 multi-user
  // (Why: column added now so schema is forward-compatible without a future breaking migration)
  userId: text('user_id').notNull().default('default'),
  // F004: badgeColour is a hex colour assigned once at upload time (e.g. '#E86C3A')
  // Persisted in the DB so the colour is stable across server restarts.
  // (Why: colour is derived from palette[existingDocCount % palette.length] at upload time)
  badgeColour: text('badge_colour').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_doc_status').on(table.status),
  index('idx_doc_created').on(table.createdAt),
  // F004: index for per-user document queries (critical for library usage stats)
  index('idx_doc_user').on(table.userId),
]);

// Document chunks table — text segments extracted and split from each document
// (Why: chunks are the unit of retrieval; each chunk maps to a vec_document_chunks embedding)
export const documentChunks = sqliteTable('document_chunks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Cascade delete: removing a document removes all its chunks automatically
  documentId: integer('document_id').notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull(),
  // F004: userId mirrors documents.user_id for efficient per-user queries without a JOIN
  // (Why: avoids JOIN to documents table in hot retrieval path)
  userId: text('user_id').notNull().default('default'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_chunk_doc').on(table.documentId),
  // Composite index used when loading chunks in order for a document
  index('idx_chunk_doc_order').on(table.documentId, table.chunkIndex),
]);
