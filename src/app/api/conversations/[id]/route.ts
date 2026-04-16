// File: src/app/api/conversations/[id]/route.ts
/**
 * Single Conversation API Route Handler
 * GET    /api/conversations/[id] — Fetch a conversation with its full message history
 * PATCH  /api/conversations/[id] — Update conversation title, persona, or provider
 * DELETE /api/conversations/[id] — Delete a conversation and all its messages (cascade)
 * (Why: provides full CRUD for individual conversations, separate from the list endpoint)
 */

import { NextRequest } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/modules/shared/db';
import { conversations, messages } from '@/modules/shared/db/schema';
import { updateConversationSchema } from '@/modules/shared/validation';
import { logger } from '@/modules/shared/logger';

// Next.js 14 dynamic route params are async — wrapped in Promise
interface RouteParams {
  params: Promise<{ id: string }>;
}

// Fetch a single conversation with its full message history in chronological order
// @param _req - Unused request object
// @param params - Route params containing the conversation ID
// @returns - Conversation object merged with messages array, or 404
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const conversation = db.select().from(conversations).where(eq(conversations.id, id)).get();

  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Load messages sorted chronologically for display in the chat panel
  const msgs = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .all();

  return Response.json({ ...conversation, messages: msgs });
}

// Update a conversation's title, persona, or provider (partial update)
// Only provided fields are updated; updatedAt is always refreshed
// @param req - Request with partial update body { title?, personaId?, providerId? }
// @param params - Route params containing the conversation ID
// @returns - Updated conversation object, or 404/400
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Verify conversation exists before attempting update
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

  // Build the update object — always refresh updatedAt, conditionally include changed fields
  // (Why: partial updates allow changing one field without resending the entire object)
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.personaId !== undefined) updates.personaId = parsed.data.personaId;
  if (parsed.data.providerId !== undefined) updates.providerId = parsed.data.providerId;

  db.update(conversations).set(updates).where(eq(conversations.id, id)).run();

  // Re-read to return the full updated record
  const updated = db.select().from(conversations).where(eq(conversations.id, id)).get();

  logger.info('Conversation updated', { conversationId: id, fields: Object.keys(parsed.data) });

  return Response.json(updated);
}

// Delete a conversation and all its messages (messages cascade-delete via schema FK)
// @param _req - Unused request object
// @param params - Route params containing the conversation ID
// @returns - 204 No Content on success, or 404
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Verify conversation exists before deleting
  // (Why: return 404 instead of silently succeeding on non-existent IDs)
  const conversation = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Delete conversation — messages are cascade-deleted by the FK constraint in schema
  db.delete(conversations).where(eq(conversations.id, id)).run();

  logger.info('Conversation deleted', { conversationId: id });

  return new Response(null, { status: 204 });
}
