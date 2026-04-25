import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Chainable Drizzle mock — prevents better-sqlite3 native bindings from loading
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

import { GET as personasGET } from '@/app/api/personas/route';
import { GET as providersGET } from '@/app/api/providers/route';

describe('GET /api/personas', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  it('returns 200 with empty personas array when no personas exist', async () => {
    const res = await personasGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ personas: [] });
  });

  it('returns personas list when personas exist in DB', async () => {
    const { db } = await import('@/modules/shared/db');
    const fakePersonas = [
      { id: 'p1', name: 'Tutor', description: 'Explains concepts', icon: null, sortOrder: 0 },
    ];
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakePersonas);

    const res = await personasGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.personas).toHaveLength(1);
    expect(body.personas[0].name).toBe('Tutor');
    // systemPrompt should NOT be present (excluded from response)
    expect(body.personas[0]).not.toHaveProperty('systemPrompt');
  });

  it('calls db.select and db.orderBy (sorted by sortOrder)', async () => {
    const { db } = await import('@/modules/shared/db');
    await personasGET();
    expect(db.select).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).orderBy).toHaveBeenCalled();
  });
});

describe('GET /api/providers', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.clearAllMocks(); });

  it('returns 200 with empty providers array when none exist', async () => {
    const res = await providersGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ providers: [] });
  });

  it('returns providers list when providers exist in DB', async () => {
    const { db } = await import('@/modules/shared/db');
    const fakeProviders = [
      { id: 'pr1', providerName: 'openai', displayName: 'GPT-4o', isAvailable: true, sortOrder: 0 },
    ];
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakeProviders);

    const res = await providersGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].providerName).toBe('openai');
  });

  it('includes unavailable providers in response', async () => {
    const { db } = await import('@/modules/shared/db');
    const mixedProviders = [
      { id: 'pr1', providerName: 'openai', displayName: 'GPT-4o', isAvailable: true, sortOrder: 0 },
      { id: 'pr2', providerName: 'anthropic', displayName: 'Claude', isAvailable: false, sortOrder: 1 },
    ];
    (db.all as ReturnType<typeof vi.fn>).mockReturnValueOnce(mixedProviders);

    const res = await providersGET();
    const body = await res.json();
    expect(body.providers).toHaveLength(2);
    // Both available and unavailable providers are returned
    expect(body.providers.some((p: { isAvailable: boolean }) => !p.isAvailable)).toBe(true);
  });
});
