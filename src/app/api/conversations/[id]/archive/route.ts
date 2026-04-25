export const dynamic = 'force-dynamic';

// File: src/app/api/conversations/[id]/archive/route.ts
/**
 * Archive Toggle API Route Handler
 * POST /api/conversations/[id]/archive — Toggle a conversation between active and archived
 * Archived conversations are hidden from the default sidebar view but not deleted.
 * (Why: soft-delete pattern lets users restore conversations instead of permanently losing them)
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/modules/shared/db';
import { conversations } from '@/modules/shared/db/schema';
import { archiveToggleSchema } from '@/modules/shared/validation';
import { logger } from '@/modules/shared/logger';

// Next.js 14 dynamic route params are async — wrapped in Promise
interface RouteParams {
  params: Promise<{ id: string }>;
}

// Toggle a conversation's archive status between 'active' and 'archived'
// @param req - Request with { archived: boolean } — true to archive, false to restore
// @param params - Route params containing the conversation ID
// @returns - Updated conversation object, or 404/400
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Verify conversation exists before toggling
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

  // Map boolean to status string — true = archive, false = restore to active
  // (Why: boolean is simpler for the client than sending a status string)
  const newStatus = parsed.data.archived ? 'archived' : 'active';

  // Update status and refresh timestamp
  db.update(conversations)
    .set({ status: newStatus, updatedAt: new Date().toISOString() })
    .where(eq(conversations.id, id))
    .run();

  // Re-read to return the full updated record
  const updated = db.select().from(conversations).where(eq(conversations.id, id)).get();

  logger.info('Conversation archive toggled', { conversationId: id, status: newStatus });

  return Response.json(updated);
}
