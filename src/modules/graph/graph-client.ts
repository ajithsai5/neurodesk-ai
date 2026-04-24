// File: src/modules/graph/graph-client.ts
/**
 * Graph Client — SQLite-backed knowledge graph store.
 *
 * Uses the shared Drizzle ORM connection (graph_nodes + graph_edges tables).
 * Exposes initGraphClient() and getGraphStats() for lifecycle management.
 *
 * (Why: a dedicated client module keeps the raw DB access separate from the
 * business-logic layer in graph-service.ts, matching the pattern used by the
 * shared DB module.)
 */

import { count, max, sql } from 'drizzle-orm';
import { db, schema } from '../shared/db';
import type { GraphStats } from './types';

/** Singleton initialisation flag — ensures we only run pragmas once. */
let _initialised = false;

/**
 * Initialise the SQLite-backed graph store.
 * Verifies the tables are accessible. Idempotent — safe to call multiple times.
 */
export async function initGraphClient(): Promise<void> {
  if (_initialised) return;

  // Warm up: run a cheap query to confirm the tables exist.
  // If the migration has not been applied, this throws early with a clear message.
  try {
    db.select({ n: count() }).from(schema.graphNodes).all();
    _initialised = true;
  } catch (err) {
    throw new Error(
      `[GraphClient] graph_nodes table not found. Run "npx drizzle-kit push" to apply migrations.\n${err}`
    );
  }
}

/**
 * Return aggregate counts and the most-recent node timestamp.
 *
 * Returns `{ nodeCount: 0, edgeCount: 0, lastUpdated: null }` on an empty graph.
 * Returns `null` from the health endpoint's perspective when the DB is unreachable
 * — callers should wrap this in try/catch for silent degradation.
 */
export async function getGraphStats(): Promise<GraphStats> {
  const [nodeRow] = db
    .select({
      nodeCount: count(),
      lastUpdated: max(schema.graphNodes.createdAt),
    })
    .from(schema.graphNodes)
    .all();

  const [edgeRow] = db
    .select({ edgeCount: count() })
    .from(schema.graphEdges)
    .all();

  return {
    nodeCount: nodeRow?.nodeCount ?? 0,
    edgeCount: edgeRow?.edgeCount ?? 0,
    lastUpdated: nodeRow?.lastUpdated ?? null,
  };
}
