import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  personaId: text('persona_id').notNull().references(() => personas.id),
  providerId: text('provider_id').notNull().references(() => providerConfigs.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_conv_status_updated').on(table.status, table.updatedAt),
]);

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_msg_conv_created').on(table.conversationId, table.createdAt),
]);

export const personas = sqliteTable('personas', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('idx_persona_sort').on(table.sortOrder),
]);

export const providerConfigs = sqliteTable('provider_configs', {
  id: text('id').primaryKey(),
  providerName: text('provider_name').notNull(),
  modelId: text('model_id').notNull(),
  displayName: text('display_name').notNull(),
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  uniqueIndex('idx_provider_model').on(table.providerName, table.modelId),
  index('idx_provider_sort').on(table.sortOrder),
]);
