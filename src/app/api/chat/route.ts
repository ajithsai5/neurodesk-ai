export const dynamic = 'force-dynamic';

// File: src/app/api/chat/route.ts
/**
 * Chat API Route Handler
 * POST /api/chat — Accepts a user message, streams an AI response via SSE.
 * Validates input with Zod, delegates to chat service, and maps errors to HTTP status codes.
 * (Why: thin route handler keeps business logic in the chat service module)
 */

import { NextRequest } from 'next/server';
import { StreamData } from 'ai';
import { chatInputSchema } from '@/modules/shared/validation';
import { handleChatMessage } from '@/modules/chat';
import { listDocuments, retrieveAndRerank, formatRagContext, formatCitations } from '@/modules/rag';
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

    // The Vercel AI SDK useChat hook sends `messages` (array) rather than a single
    // `message` string. Extract the last user message content so both the browser SDK
    // and direct API calls (curl / tests) are handled by the same schema.
    const messageText: unknown =
      body.message ??
      (Array.isArray(body.messages)
        ? body.messages[body.messages.length - 1]?.content
        : undefined);

    const parsed = chatInputSchema.safeParse({ conversationId: body.conversationId, message: messageText });

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Build RAG context and collect citations if any ready documents exist (FR-017: skip gracefully when none)
    let ragContext: string | undefined;
    let streamData: StreamData | undefined;
    try {
      const docs = await listDocuments();
      const hasReady = docs.some((d) => d.status === 'ready');
      if (hasReady) {
        const chunks = await retrieveAndRerank(parsed.data.conversationId, parsed.data.message);
        ragContext = formatRagContext(chunks) ?? undefined;
        // Attach citations as a message annotation so the client can render a Sources panel
        // (Why: StreamData annotations travel alongside the SSE stream and are attached to the
        //  assistant message by the useChat hook — keeping UI and text in sync)
        if (chunks.length > 0) {
          streamData = new StreamData();
          // JSON.parse/stringify ensures the value satisfies JSONValue (which requires an index
          // signature that the Citation interface intentionally omits for clean typing)
          streamData.appendMessageAnnotation(
            JSON.parse(JSON.stringify({ citations: formatCitations(chunks) }))
          );
        }
      }
    } catch (ragErr) {
      // Ollama unreachable or other retrieval error — proceed without RAG context
      // (Why: chat must never fail due to an optional RAG step)
      logger.warn('RAG retrieval skipped', { error: String(ragErr) });
    }

    // Delegate to chat service which handles DB operations, context window, and LLM streaming
    const result = await handleChatMessage({ ...parsed.data, ragContext });

    // Close the StreamData after the full response has streamed so the SSE data channel ends cleanly
    if (streamData) {
      const data = streamData;
      result.text.finally(() => data.close());
    }

    // Convert the AI SDK stream result to an SSE response for the useChat hook
    return result.toDataStreamResponse(streamData ? { data: streamData } : undefined);
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
