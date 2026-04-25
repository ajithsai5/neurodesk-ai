export const dynamic = 'force-dynamic';

// File: src/app/api/graph/query/route.ts
/**
 * Graph Query API Route Handler
 * GET /api/graph/query?q={query}&conversationId={id}&limit={limit}
 *
 * Returns graph nodes and edges matching a text query, scoped to a conversation.
 * - 401 if `conversationId` is absent (acts as the session identifier for this local app)
 * - 400 if `q` is absent or `limit` is out of range (1–200)
 * - 200 with { nodes: [], edges: [] } when graph is empty (not an error)
 * - 500 on unexpected store error
 *
 * (Why: the graph query API exposes session-scoped knowledge graph data per the
 * contracts/graph-query.md spec; conversationId serves as the session token since
 * the app has no formal authentication layer in v1)
 */

import { NextRequest } from 'next/server';
import { queryGraph } from '@/modules/graph/graph-service';
import { logger } from '@/modules/shared/logger';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // conversationId acts as the session identifier — absent means "no session"
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = searchParams.get('q');
  if (!q) {
    return Response.json({ error: 'Missing required parameter: q' }, { status: 400 });
  }

  const limitParam = searchParams.get('limit');
  const limit = limitParam !== null ? parseInt(limitParam, 10) : 50;

  if (isNaN(limit) || limit < 1 || limit > 200) {
    return Response.json({ error: 'limit must be between 1 and 200' }, { status: 400 });
  }

  try {
    const result = await queryGraph(conversationId, q, limit);
    return Response.json(result);
  } catch (err) {
    logger.warn('[GraphQueryRoute] Unexpected error', { err: String(err) });
    return Response.json({ error: 'Graph query failed' }, { status: 500 });
  }
}
