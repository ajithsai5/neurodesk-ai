import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the chat module so we never hit the real LLM or database
vi.mock('@/modules/chat', () => ({
  handleChatMessage: vi.fn(async () => ({
    toDataStreamResponse: vi.fn(() => new Response('stream-data', { status: 200 })),
  })),
}));

// Mock the db module to prevent better-sqlite3 native bindings from loading
vi.mock('@/modules/shared/db', () => {
  const m: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'from', 'where', 'orderBy', 'all', 'get', 'insert', 'values',
    'run', 'update', 'set', 'limit', 'delete'].forEach(k => { m[k] = vi.fn(() => m); });
  m.all = vi.fn(() => []);
  m.get = vi.fn(() => undefined);
  m.run = vi.fn();
  return { db: m, conversations: {}, messages: {}, personas: {}, providerConfigs: {} };
});

import { POST } from '@/app/api/chat/route';

// chatInputSchema requires a valid UUID for conversationId
const VALID_CONV_ID = '00000000-0000-4000-a000-000000000001';

// Helper — build a minimal NextRequest-compatible Request
function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // T006 — happy path: valid input returns 200 streaming response
  it('should return a streaming response for valid input', async () => {
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'Hello' });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  // T007 — missing conversationId → 400
  it('should return 400 for missing conversationId', async () => {
    const req = makeRequest({ message: 'Hi' });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  // T008 — empty message → 400
  it('should return 400 for empty message', async () => {
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: '' });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  // T009 — message > 10,000 characters → 400
  it('should return 400 for message exceeding 10,000 characters', async () => {
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'x'.repeat(10001) });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  // T010 — conversation not found → 404
  it('should return 404 for nonexistent conversation', async () => {
    const { handleChatMessage } = await import('@/modules/chat');
    (handleChatMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Conversation not found')
    );
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'Hi' });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Conversation not found');
  });

  // T011 — LLM provider error → 500 with "AI service unavailable" message
  it('should return 500 when AI provider throws', async () => {
    const { handleChatMessage } = await import('@/modules/chat');
    (handleChatMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AI service unavailable: openai')
    );
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'Hi' });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('AI service unavailable');
  });

  // T012 — verify handleChatMessage is called with correct arguments
  it('should call handleChatMessage with conversationId and message', async () => {
    const { handleChatMessage } = await import('@/modules/chat');
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'Hello world' });
    await POST(req as any);
    expect(handleChatMessage).toHaveBeenCalledWith({
      conversationId: VALID_CONV_ID,
      message: 'Hello world',
    });
  });
});
