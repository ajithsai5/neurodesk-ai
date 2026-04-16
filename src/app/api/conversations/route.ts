import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/modules/shared/db';
import { conversations, personas, providerConfigs } from '@/modules/shared/db/schema';
import { createConversationSchema } from '@/modules/shared/validation';
import { config } from '@/lib/config';
import { logger } from '@/modules/shared/logger';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'active';

  const result = db
    .select()
    .from(conversations)
    .where(eq(conversations.status, status as 'active' | 'archived'))
    .orderBy(desc(conversations.updatedAt))
    .all();

  return Response.json({ conversations: result });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Resolve persona ID (default to first persona)
    let personaId = parsed.data.personaId;
    if (!personaId) {
      const defaultPersona = db.select().from(personas).orderBy(personas.sortOrder).limit(1).get();
      if (!defaultPersona) {
        return Response.json({ error: 'No personas configured' }, { status: 500 });
      }
      personaId = defaultPersona.id;
    }

    // Resolve provider ID (default to first available)
    let providerId = parsed.data.providerId;
    if (!providerId) {
      const defaultProvider = db
        .select()
        .from(providerConfigs)
        .where(eq(providerConfigs.isAvailable, true))
        .orderBy(providerConfigs.sortOrder)
        .limit(1)
        .get();
      if (!defaultProvider) {
        return Response.json({ error: 'No providers available' }, { status: 500 });
      }
      providerId = defaultProvider.id;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.insert(conversations).values({
      id,
      title: config.defaultConversationTitle,
      status: 'active',
      personaId,
      providerId,
      createdAt: now,
      updatedAt: now,
    }).run();

    const created = db.select().from(conversations).where(eq(conversations.id, id)).get();

    logger.info('Conversation created', { conversationId: id });

    return Response.json(created, { status: 201 });
  } catch (err) {
    logger.error('Failed to create conversation', { error: String(err) });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
