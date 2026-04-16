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
});
