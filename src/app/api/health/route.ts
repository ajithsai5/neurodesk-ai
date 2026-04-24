export const dynamic = 'force-dynamic';

// File: src/app/api/health/route.ts
/**
 * Health Check API Route Handler
 * GET /api/health — Liveness probe confirming the Next.js application process is running.
 * Returns { status: 'ok', timestamp, graph } on 200.
 * - `graph` contains nodeCount, edgeCount, lastUpdated from the knowledge graph.
 * - `graph` is null when the graph store is unreachable (silent degradation — FR-017).
 * (Why: infrastructure-level liveness probe + graph health observability for ops dashboards)
 */

import { getGraphStats } from '@/modules/graph/graph-client';

export async function GET() {
  let graph = null;

  try {
    graph = await getGraphStats();
  } catch {
    // Graph store unreachable — degrade silently, health endpoint stays green
  }

  return Response.json({
    status: 'ok',
    timestamp: Date.now(),
    graph,
  });
}
