import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Chainable Drizzle mock — every method returns the same object so the fluent
// chain (select().from().where().orderBy().all()) resolves without errors
vi.mock('@/modules/shared/db', () => {
  const m: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'from', 'where', 'orderBy', 'all', 'get', 'insert', 'values',
    'run', 'update', 'set', 'limit', 'delete'].forEach(k => { m[k] = vi.fn(() => m); });
  m.all = vi.fn(() => []);
  m.get = vi.fn(() => undefined);
  m.run = vi.fn();
  return {
    db: m,
    conversations: {},
    messages: {},
    personas: {},
    providerConfigs: {},
  };
});

// uuid is used to generate conversation IDs in the POST handler
vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-conv-uuid') }));

import { GET as listGET, POST as listPOST } from '@/app/api/conversations/route';
import { GET as convGET, PATCH as convPATCH, DELETE as convDELETE } from '@/app/api/conversations/[id]/route';
import { POST as archivePOST } from '@/app/api/conversations/[id]/archive/route';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// Build a request whose nextUrl mirrors a real NextRequest (needed by GET /api/conversations)
function makeListReq(queryString = '') {
  const url = `http://localhost/api/conversations${queryString ? `?${queryString}` : ''}`;
  const req = new Request(url) as any;
  req.nextUrl = new URL(url);
  return req;
}

function makeJsonReq(url: string, method: string, body: unknown) {
  const req = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
  req.nextUrl = new URL(url);
  return req;
}

// Async params as Next.js 14 App Router provides them
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// Fake data shapes
const fakeConv = {
  id: 'conv-1',
  title: 'Test Chat',
  status: 'active',
  personaId: 'p-1',
  providerId: 'pr-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};
const fakePersona = { id: 'p-1', name: 'Tutor', sortOrder: 0 };
const fakeProvider = { id: 'pr-1', providerName: 'openai', isAvailable: true, sortOrder: 0 };

describe('GET /api/conversations', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  // T014 — empty list
  it('should return empty list when no conversations exist', async () => {
    const req = makeListReq();
    const res = await listGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ conversations: [] });
  });

  // T015 — list with data
  it('should return active conversations sorted by updatedAt DESC', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce([fakeConv]);
    const req = makeListReq();
    const res = await listGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].id).toBe('conv-1');
  });

  // T016 — filter by archived status
  it('should filter by archived status', async () => {
    const { db } = await import('@/modules/shared/db');
    const req = makeListReq('status=archived');
    await listGET(req);
    // The where clause should have been invoked (status filter applied)
    expect(db.where).toHaveBeenCalled();
  });
});

describe('POST /api/conversations', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  // T017 — create with defaults
  it('should create a new conversation with defaults', async () => {
    const { db } = await import('@/modules/shared/db');
    // First .get() = defaultPersona lookup, second = defaultProvider lookup,
    // third = re-read created conversation
    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakePersona)
      .mockReturnValueOnce(fakeProvider)
      .mockReturnValueOnce({ ...fakeConv, id: 'test-conv-uuid' });

    const req = makeJsonReq('http://localhost/api/conversations', 'POST', {});
    const res = await listPOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('test-conv-uuid');
  });

  // T018 — create with specified persona and provider
  it('should create a conversation with specified persona and provider', async () => {
    const { db } = await import('@/modules/shared/db');
    // Only one .get() needed — for re-reading the created record
    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ ...fakeConv, id: 'test-conv-uuid', personaId: 'p-1', providerId: 'pr-1' });

    const req = makeJsonReq('http://localhost/api/conversations', 'POST', {
      personaId: 'a0000000-0000-4000-a000-000000000001',
      providerId: 'b0000000-0000-4000-b000-000000000001',
    });
    const res = await listPOST(req);
    expect(res.status).toBe(201);
  });
});

describe('GET /api/conversations/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  // T019 — return conversation with messages
  it('should return conversation with messages', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakeConv);
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { id: 'm-1', conversationId: 'conv-1', role: 'user', content: 'Hello', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const req = new Request('http://localhost/api/conversations/conv-1') as any;
    const res = await convGET(req, makeParams('conv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('conv-1');
    expect(body.messages).toHaveLength(1);
  });

  // T020 — 404 for nonexistent conversation
  it('should return 404 for nonexistent conversation', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);
    const req = new Request('http://localhost/api/conversations/bad-id') as any;
    const res = await convGET(req, makeParams('bad-id'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Conversation not found');
  });
});

describe('PATCH /api/conversations/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  // T021 — rename a conversation
  it('should rename a conversation', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeConv)
      .mockReturnValueOnce({ ...fakeConv, title: 'New Title' });
    const req = makeJsonReq('http://localhost/api/conversations/conv-1', 'PATCH', { title: 'New Title' });
    const res = await convPATCH(req, makeParams('conv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('New Title');
  });

  // T022 — reject empty title
  it('should reject empty title', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakeConv);
    const req = makeJsonReq('http://localhost/api/conversations/conv-1', 'PATCH', { title: '' });
    const res = await convPATCH(req, makeParams('conv-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
  });

  // T023 — reject title > 200 characters
  it('should reject title exceeding 200 characters', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakeConv);
    const req = makeJsonReq('http://localhost/api/conversations/conv-1', 'PATCH', {
      title: 'x'.repeat(201),
    });
    const res = await convPATCH(req, makeParams('conv-1'));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/conversations/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  // T024 — delete conversation (cascade to messages)
  it('should delete conversation and cascade to messages', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakeConv);
    const req = new Request('http://localhost/api/conversations/conv-1', { method: 'DELETE' }) as any;
    const res = await convDELETE(req, makeParams('conv-1'));
    expect(res.status).toBe(204);
    expect(db.delete).toHaveBeenCalled();
  });

  // T025 — 404 for nonexistent conversation on DELETE
  it('should return 404 for nonexistent conversation', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);
    const req = new Request('http://localhost/api/conversations/bad-id', { method: 'DELETE' }) as any;
    const res = await convDELETE(req, makeParams('bad-id'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Conversation not found');
  });
});

describe('POST /api/conversations/:id/archive', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  // Archive: archive a conversation
  it('should archive a conversation', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeConv)
      .mockReturnValueOnce({ ...fakeConv, status: 'archived' });
    const req = makeJsonReq('http://localhost/api/conversations/conv-1/archive', 'POST', { archived: true });
    const res = await archivePOST(req, makeParams('conv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('archived');
  });

  // Archive: unarchive a conversation
  it('should unarchive a conversation', async () => {
    const { db } = await import('@/modules/shared/db');
    (db.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ ...fakeConv, status: 'archived' })
      .mockReturnValueOnce({ ...fakeConv, status: 'active' });
    const req = makeJsonReq('http://localhost/api/conversations/conv-1/archive', 'POST', { archived: false });
    const res = await archivePOST(req, makeParams('conv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('active');
  });
});
