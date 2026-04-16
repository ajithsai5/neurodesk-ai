import { NextRequest } from 'next/server';
import { chatInputSchema } from '@/modules/shared/validation';
import { handleChatMessage } from '@/modules/chat';
import { logger } from '@/modules/shared/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = chatInputSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await handleChatMessage(parsed.data);
    return result.toDataStreamResponse();
  } catch (err) {
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

    logger.error('Chat API error', { error: message });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
