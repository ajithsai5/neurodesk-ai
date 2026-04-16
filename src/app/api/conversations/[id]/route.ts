import { NextRequest } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/modules/shared/db';
import { conversations, messages } from '@/modules/shared/db/schema';
import { updateConversationSchema } from '@/modules/shared/validation';
import { logger } from '@/modules/shared/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const conversation = db.select().from(conversations).where(eq(conversations.id, id)).get();

  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const msgs = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .all();

  return Response.json({ ...conversation, messages: msgs });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const conversation = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateConversationSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.personaId !== undefined) updates.personaId = parsed.data.personaId;
  if (parsed.data.providerId !== undefined) updates.providerId = parsed.data.providerId;

  db.update(conversations).set(updates).where(eq(conversations.id, id)).run();

  const updated = db.select().from(conversations).where(eq(conversations.id, id)).get();

  logger.info('Conversation updated', { conversationId: id, fields: Object.keys(parsed.data) });

  return Response.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const conversation = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  db.delete(conversations).where(eq(conversations.id, id)).run();

  logger.info('Conversation deleted', { conversationId: id });

  return new Response(null, { status: 204 });
}
