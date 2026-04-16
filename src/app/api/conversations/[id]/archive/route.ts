import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/modules/shared/db';
import { conversations } from '@/modules/shared/db/schema';
import { archiveToggleSchema } from '@/modules/shared/validation';
import { logger } from '@/modules/shared/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const conversation = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = archiveToggleSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const newStatus = parsed.data.archived ? 'archived' : 'active';

  db.update(conversations)
    .set({ status: newStatus, updatedAt: new Date().toISOString() })
    .where(eq(conversations.id, id))
    .run();

  const updated = db.select().from(conversations).where(eq(conversations.id, id)).get();

  logger.info('Conversation archive toggled', { conversationId: id, status: newStatus });

  return Response.json(updated);
}
