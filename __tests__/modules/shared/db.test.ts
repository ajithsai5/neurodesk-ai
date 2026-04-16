import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import * as schema from '@/modules/shared/db/schema';

const { conversations, messages, personas, providerConfigs } = schema;

let sqlite: ReturnType<typeof Database>;
let db: ReturnType<typeof drizzle<typeof schema>>;

// Seed IDs for FK references
const personaId = uuidv4();
const providerId = uuidv4();

beforeAll(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  db = drizzle(sqlite, { schema });

  // Create tables manually for in-memory DB
  sqlite.exec(`
    CREATE TABLE personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE provider_configs (
      id TEXT PRIMARY KEY,
      provider_name TEXT NOT NULL,
      model_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      persona_id TEXT NOT NULL REFERENCES personas(id),
      provider_id TEXT NOT NULL REFERENCES provider_configs(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_conv_status_updated ON conversations(status, updated_at);
    CREATE INDEX idx_msg_conv_created ON messages(conversation_id, created_at);
    CREATE INDEX idx_persona_sort ON personas(sort_order);
    CREATE INDEX idx_provider_sort ON provider_configs(sort_order);
    CREATE UNIQUE INDEX idx_provider_model ON provider_configs(provider_name, model_id);
  `);

  // Seed required reference data
  db.insert(personas).values({
    id: personaId,
    name: 'General Assistant',
    description: 'Test persona',
    systemPrompt: 'You are helpful.',
    icon: 'assistant',
    sortOrder: 0,
  }).run();

  db.insert(providerConfigs).values({
    id: providerId,
    providerName: 'openai',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    isAvailable: true,
    sortOrder: 0,
  }).run();
});

afterAll(() => {
  sqlite.close();
});

describe('Database schema', () => {
  it('should create and retrieve a conversation', () => {
    const id = uuidv4();
    db.insert(conversations).values({
      id,
      title: 'Test Conversation',
      status: 'active',
      personaId,
      providerId,
    }).run();

    const result = db.select().from(conversations).where(eq(conversations.id, id)).get();
    expect(result).toBeDefined();
    expect(result!.title).toBe('Test Conversation');
    expect(result!.status).toBe('active');
  });

  it('should create and retrieve messages in a conversation', () => {
    const convId = uuidv4();
    db.insert(conversations).values({
      id: convId,
      title: 'Message Test',
      personaId,
      providerId,
    }).run();

    const msgId = uuidv4();
    db.insert(messages).values({
      id: msgId,
      conversationId: convId,
      role: 'user',
      content: 'Hello',
    }).run();

    const result = db.select().from(messages).where(eq(messages.conversationId, convId)).all();
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Hello');
  });

  it('should cascade delete messages when conversation is deleted', () => {
    const convId = uuidv4();
    db.insert(conversations).values({
      id: convId,
      title: 'Cascade Test',
      personaId,
      providerId,
    }).run();

    db.insert(messages).values([
      { id: uuidv4(), conversationId: convId, role: 'user', content: 'msg1' },
      { id: uuidv4(), conversationId: convId, role: 'assistant', content: 'msg2' },
    ]).run();

    // Verify messages exist
    let msgs = db.select().from(messages).where(eq(messages.conversationId, convId)).all();
    expect(msgs).toHaveLength(2);

    // Delete conversation
    db.delete(conversations).where(eq(conversations.id, convId)).run();

    // Messages should be gone
    msgs = db.select().from(messages).where(eq(messages.conversationId, convId)).all();
    expect(msgs).toHaveLength(0);
  });

  it('should enforce unique persona names', () => {
    db.insert(personas).values({
      id: uuidv4(),
      name: 'Unique Name Test',
      description: 'First',
      systemPrompt: 'prompt',
      sortOrder: 10,
    }).run();

    expect(() => {
      db.insert(personas).values({
        id: uuidv4(),
        name: 'Unique Name Test',
        description: 'Duplicate',
        systemPrompt: 'prompt',
        sortOrder: 11,
      }).run();
    }).toThrow();
  });

  it('should enforce unique provider+model combination', () => {
    db.insert(providerConfigs).values({
      id: uuidv4(),
      providerName: 'test-provider',
      modelId: 'test-model',
      displayName: 'Test',
      sortOrder: 10,
    }).run();

    expect(() => {
      db.insert(providerConfigs).values({
        id: uuidv4(),
        providerName: 'test-provider',
        modelId: 'test-model',
        displayName: 'Duplicate',
        sortOrder: 11,
      }).run();
    }).toThrow();
  });
});
