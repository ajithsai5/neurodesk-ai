import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the chat module so we never hit the real LLM or database
// Default: text resolves to '' so the streamData.close() finally-handler runs cleanly.
vi.mock('@/modules/chat', () => ({
  handleChatMessage: vi.fn(async () => ({
    toDataStreamResponse: vi.fn(() => new Response('stream-data', { status: 200 })),
    text: Promise.resolve(''),
  })),
}));

// Mock the RAG module — by default returns no docs so the RAG branch short-circuits
// (Why: most existing tests don't exercise RAG; we override per-test for the
//  RAG-context cases.)
vi.mock('@/modules/rag', () => ({
  listDocuments: vi.fn(async () => []),
  retrieveChunks: vi.fn(async () => []),
  retrieveAndRerank: vi.fn(async () => []),
  formatRagContext: vi.fn(() => null),
  formatCitations: vi.fn(() => []),
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

  // T011b — generic unexpected error → 500 "Internal server error" (covers route.ts lines 54-56)
  it('should return 500 with generic message for unexpected errors', async () => {
    const { handleChatMessage } = await import('@/modules/chat');
    (handleChatMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Database connection failed')
    );
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'Hi' });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
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

  // ───────────────────────────────────────────────────────────────────────
  // Coverage backfill — the SDK's `messages` array fallback (lines 33-35),
  // the RAG context + citations branch (lines 51-66), and the streamData
  // close-after-text path (lines 78-80). These were uncovered when the
  // route was first written; this block lifts route.ts past 95%.
  // ───────────────────────────────────────────────────────────────────────

  // The Vercel useChat hook posts { messages: [...] } not { message: '...' }.
  // Verify the route extracts the last message.content as the user message.
  it('extracts message from messages[] array (Vercel SDK shape)', async () => {
    const { handleChatMessage } = await import('@/modules/chat');
    const req = makeRequest({
      conversationId: VALID_CONV_ID,
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'latest message' },
      ],
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(handleChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: VALID_CONV_ID,
        message: 'latest message',
      })
    );
  });

  // Covers the `?.content` optional-chain (line 35) returning undefined when
  // messages[] is present but empty — the schema validation then rejects it with 400.
  it('returns 400 when messages array is empty (no last message to extract)', async () => {
    const req = makeRequest({ conversationId: VALID_CONV_ID, messages: [] });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('builds RAG context and attaches citations when ready docs exist', async () => {
    const { listDocuments, retrieveAndRerank, formatRagContext, formatCitations } =
      await import('@/modules/rag');
    (listDocuments as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'd1', status: 'ready' },
    ]);
    (retrieveAndRerank as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { chunkId: 1, content: 'snippet', pageNumber: 1, documentName: 'doc.pdf', distance: 0.1 },
    ]);
    (formatRagContext as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      'CONTEXT BLOCK'
    );
    (formatCitations as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { documentName: 'doc.pdf', pageNumber: 1, excerpt: 'snippet' },
    ]);

    const { handleChatMessage } = await import('@/modules/chat');
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'query' });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    // ragContext propagates to chat service
    expect(handleChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ ragContext: 'CONTEXT BLOCK' })
    );
    expect(formatCitations).toHaveBeenCalled();
  });

  it('skips RAG quietly when listDocuments throws (Ollama unreachable)', async () => {
    const { listDocuments } = await import('@/modules/rag');
    (listDocuments as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('ECONNREFUSED')
    );
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'hi' });
    const res = await POST(req as any);
    // Chat must still succeed — RAG is best-effort
    expect(res.status).toBe(200);
  });

  it('does not build RAG context when no docs are ready', async () => {
    const { listDocuments, retrieveAndRerank } = await import('@/modules/rag');
    (listDocuments as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'd1', status: 'pending' },
    ]);
    const { handleChatMessage } = await import('@/modules/chat');
    const req = makeRequest({ conversationId: VALID_CONV_ID, message: 'hi' });
    await POST(req as any);
    // retrieveAndRerank should never be called when no doc is ready
    expect(retrieveAndRerank).not.toHaveBeenCalled();
    expect(handleChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ ragContext: undefined })
    );
  });
});
