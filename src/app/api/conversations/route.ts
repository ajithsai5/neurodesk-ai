export const dynamic = 'force-dynamic';

// File: src/app/api/conversations/route.ts
/**
 * Conversations API Route Handler
 * GET  /api/conversations — List conversations filtered by status (active/archived)
 * POST /api/conversations — Create a new conversation with optional persona/provider
 * (Why: manages conversation lifecycle — the top-level container for chat messages)
 */

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/modules/shared/db';
import { conversations, personas, providerConfigs } from '@/modules/shared/db/schema';
import { createConversationSchema } from '@/modules/shared/validation';
import { config } from '@/lib/config';
import { logger } from '@/modules/shared/logger';

// List conversations filtered by status, ordered by most recently updated
// @param req - Request with optional ?status=active|archived query parameter
// @returns - JSON array of conversations
export async function GET(req: NextRequest) {
  // Default to 'active' if no status filter provided
  const status = req.nextUrl.searchParams.get('status') || 'active';

  // Query conversations ordered by most recent activity for sidebar display
  const result = db
    .select()
    .from(conversations)
    .where(eq(conversations.status, status as 'active' | 'archived'))
    .orderBy(desc(conversations.updatedAt))
    .all();

  return Response.json({ conversations: result });
}

// Create a new conversation with optional persona and provider selection
// If persona/provider not specified, defaults to the first available of each
// @param req - Request with optional { personaId?, providerId? } body
// @returns - The created conversation object (201)
export async function POST(req: NextRequest) {
  try {
    // Parse body with fallback to empty object for requests with no body
    // (Why: allows creating a conversation with just POST and no body — uses all defaults)
    const body = await req.json().catch(() => ({}));
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Resolve persona ID — use provided or fall back to first persona by sort order
    // (Why: every conversation needs a persona for its system prompt)
    let personaId = parsed.data.personaId;
    if (!personaId) {
      const defaultPersona = db.select().from(personas).orderBy(personas.sortOrder).limit(1).get();
      if (!defaultPersona) {
        return Response.json({ error: 'No personas configured' }, { status: 500 });
      }
      personaId = defaultPersona.id;
    }

    // Resolve provider ID — use provided or fall back to first available provider
    // (Why: every conversation needs a provider to know which LLM to call)
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

    // Create the conversation with a default title
    // (Why: title will be auto-replaced by the first user message in chat-service)
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

    // Re-read from DB to return the full record with any DB-generated defaults
    const created = db.select().from(conversations).where(eq(conversations.id, id)).get();

    logger.info('Conversation created', { conversationId: id });

    return Response.json(created, { status: 201 });
  } catch (err) {
    logger.error('Failed to create conversation', { error: String(err) });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
