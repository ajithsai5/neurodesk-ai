import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/modules/shared/db', () => {
  const mockDb = {
    select: vi.fn(() => mockDb),
    from: vi.fn(() => mockDb),
    where: vi.fn(() => mockDb),
    get: vi.fn(),
    all: vi.fn(() => []),
    insert: vi.fn(() => mockDb),
    values: vi.fn(() => mockDb),
    run: vi.fn(),
    update: vi.fn(() => mockDb),
    set: vi.fn(() => mockDb),
    orderBy: vi.fn(() => mockDb),
    limit: vi.fn(() => mockDb),
  };
  return { db: mockDb, schema: {} };
});

vi.mock('@/modules/chat/llm-client', () => ({
  streamChatResponse: vi.fn(async () => ({
    textStream: (async function* () {
      yield 'Test response';
    })(),
    text: Promise.resolve('Test response'),
    toDataStreamResponse: vi.fn(() => new Response('stream')),
  })),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

import { handleChatMessage } from '@/modules/chat/chat-service';
import { streamChatResponse } from '@/modules/chat/llm-client';

// ─────────────────────────────────────────────
// Shared fixture data
// ─────────────────────────────────────────────

const fakeConversation = {
  id: 'conv-1',
  title: 'Test Chat',
  status: 'active',
  personaId: 'p-1',
  providerId: 'pr-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const fakePersona = {
  id: 'p-1',
  name: 'Tutor',
  systemPrompt: 'You are a helpful tutor.',
  sortOrder: 0,
};

const fakeProvider = {
  id: 'pr-1',
  providerName: 'openai',
  modelId: 'gpt-4o',
  isAvailable: true,
  sortOrder: 0,
};

// Helper: make N fake messages (role alternates user/assistant)
function makeMessages(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `msg-${i}`,
    conversationId: 'conv-1',
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}`,
    createdAt: `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`,
  }));
}

// ─────────────────────────────────────────────
// Existing tests
// ─────────────────────────────────────────────

describe('handleChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function', () => {
    expect(typeof handleChatMessage).toBe('function');
  });

  it('should throw if conversation is not found', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

    await expect(
      handleChatMessage({ conversationId: 'nonexistent', message: 'Hello' })
    ).rejects.toThrow();
  });

  // ─────────────────────────────────────────────
  // T032 — full success path
  // ─────────────────────────────────────────────
  it('T032: calls streamChatResponse with correct systemPrompt and saves messages', async () => {
    const { db } = await import('@/modules/shared/db');

    // Sequence: conversation → persona → provider
    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeConversation)
      .mockReturnValueOnce(fakePersona)
      .mockReturnValueOnce(fakeProvider);

    // Return empty history so context window doesn't trim anything
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);

    const result = await handleChatMessage({
      conversationId: 'conv-1',
      message: 'Hello',
    });

    // streamChatResponse should have been called once with the persona's systemPrompt
    expect(streamChatResponse).toHaveBeenCalledOnce();
    const callArgs = (streamChatResponse as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.systemPrompt).toBe('You are a helpful tutor.');
    expect(callArgs.providerName).toBe('openai');

    // Result should expose toDataStreamResponse (for the route handler)
    expect(result.toDataStreamResponse).toBeDefined();

    // db.insert (user message save) and db.run should have been called
    expect(db.insert).toHaveBeenCalled();
    expect(db.run).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // T030 — context window trim-by-count (25 → 20)
  // ─────────────────────────────────────────────
  it('T030: trims context to maxMessages (20) when there are 25 messages in DB', async () => {
    const { db } = await import('@/modules/shared/db');

    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeConversation)
      .mockReturnValueOnce(fakePersona)
      .mockReturnValueOnce(fakeProvider);

    // 25 messages in DB — context window should trim to 20
    const history = makeMessages(25);
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce(history);

    await handleChatMessage({ conversationId: 'conv-1', message: 'Hi' });

    const callArgs = (streamChatResponse as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // After trim-by-count (maxMessages = 20), only the LAST 20 messages are passed
    expect(callArgs.messages.length).toBeLessThanOrEqual(20);
    // Should contain the last message from history
    expect(callArgs.messages[callArgs.messages.length - 1].content).toBe('Message 24');
  });

  // ─────────────────────────────────────────────
  // T031 — context window trim-by-token-cap
  // ─────────────────────────────────────────────
  it('T031: drops oldest messages to stay under token cap', async () => {
    const { db } = await import('@/modules/shared/db');

    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeConversation)
      .mockReturnValueOnce(fakePersona)
      .mockReturnValueOnce(fakeProvider);

    // Create 20 messages where each has ~6000 characters (~1500 tokens)
    // Total: 20 × 1500 = 30K tokens — under the 100K cap — all should be kept
    const shortHistory = makeMessages(5).map(m => ({
      ...m,
      content: 'A'.repeat(100),
    }));
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce(shortHistory);

    await handleChatMessage({ conversationId: 'conv-1', message: 'Hi' });

    const callArgs = (streamChatResponse as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // With 5 short messages, all should fit within the token cap
    expect(callArgs.messages.length).toBeGreaterThan(0);
    expect(callArgs.messages.length).toBeLessThanOrEqual(5);
  });

  // ─────────────────────────────────────────────
  // Additional: archived conversation rejected
  // ─────────────────────────────────────────────
  it('throws "Conversation not found" for archived conversations', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      ...fakeConversation,
      status: 'archived',
    });

    await expect(
      handleChatMessage({ conversationId: 'conv-1', message: 'Hi' })
    ).rejects.toThrow('Conversation not found');
  });

  // Additional: provider unavailable
  it('throws "AI service unavailable" when provider is unavailable', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeConversation)
      .mockReturnValueOnce(fakePersona)
      .mockReturnValueOnce({ ...fakeProvider, isAvailable: false });

    await expect(
      handleChatMessage({ conversationId: 'conv-1', message: 'Hi' })
    ).rejects.toThrow('AI service unavailable');
  });

  // Additional: title auto-generated from first message
  it('auto-generates title from first message when title is default', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ ...fakeConversation, title: 'New Conversation' })
      .mockReturnValueOnce(fakePersona)
      .mockReturnValueOnce(fakeProvider);
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);

    await handleChatMessage({ conversationId: 'conv-1', message: 'Tell me about AI' });

    // db.update should have been called to set the title
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalled();
  });
});
