export const dynamic = 'force-dynamic';

// File: src/app/api/chat/route.ts
/**
 * Chat API Route Handler
 * POST /api/chat — Accepts a user message, streams an AI response via SSE.
 * Validates input with Zod, delegates to chat service, and maps errors to HTTP status codes.
 * (Why: thin route handler keeps business logic in the chat service module)
 */

import { NextRequest } from 'next/server';
import { chatInputSchema } from '@/modules/shared/validation';
import { handleChatMessage } from '@/modules/chat';
import { logger } from '@/modules/shared/logger';

// Handle incoming chat messages and return a streaming AI response
// Validates the request body, delegates to the chat service, and returns SSE stream
// @param req - Next.js request containing { conversationId, message }
// @returns - SSE data stream response or JSON error
export async function POST(req: NextRequest) {
  try {
    // Parse and validate the request body against the chat input schema
    // (Why: validates at the system boundary before any business logic runs)
    const body = await req.json();
    const parsed = chatInputSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Delegate to chat service which handles DB operations, context window, and LLM streaming
    const result = await handleChatMessage(parsed.data);
    // Convert the AI SDK stream result to an SSE response for the useChat hook
    return result.toDataStreamResponse();
  } catch (err) {
    // Map known error messages to appropriate HTTP status codes
    // (Why: provides meaningful error responses instead of generic 500s)
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message === 'Conversation not found') {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (message.startsWith('AI service unavailable')) {
      logger.error('Provider error', { error: message });
      return Response.json(
        { error: 'AI service unavailable', provider: message.split(': ')[1] },
        { status: 500 }
      );
    }

    // Catch-all for unexpected errors — log details but don't expose internals
    logger.error('Chat API error', { error: message });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
