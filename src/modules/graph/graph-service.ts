// File: src/modules/graph/graph-service.ts
/**
 * Graph Service — business-logic layer for the knowledge graph.
 *
 * Writes MESSAGE, CHUNK, and CODE_ENTITY nodes; queries nodes scoped to a
 * session; re-ranks RAG candidates by edge weight; cascades conversation deletes.
 *
 * All write operations are wrapped in try/catch for silent degradation so that
 * a graph store failure never disrupts the primary chat or RAG flows.
 * (Why: FR-017 requires graceful degradation when the graph store is unavailable)
 */

import { eq, and, like, desc, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db, schema } from '../shared/db';
import { logger } from '../shared/logger';
import type { GraphQueryResult } from './types';

// ─── Write Operations ─────────────────────────────────────────────────────────

/**
 * Write a MESSAGE node for a conversation turn.
 * Creates a FOLLOWS edge from the previous node in the session to this one,
 * encoding the temporal ordering of messages in the graph.
 */
export async function writeConversationNode(
  conversationId: string,
  sessionId: string,
  label: string
): Promise<void> {
  try {
    const nodeId = uuidv4();
    const now = Date.now();

    // Insert the MESSAGE node
    db.insert(schema.graphNodes).values({
      id: nodeId,
      conversationId,
      sessionId,
      type: 'MESSAGE',
      label,
      properties: JSON.stringify({ conversationId }),
      createdAt: now,
    }).run();

    // Find the most recent previous node in this session to create a FOLLOWS edge
    const [prev] = db
      .select({ id: schema.graphNodes.id })
      .from(schema.graphNodes)
      .where(
        and(
          eq(schema.graphNodes.sessionId, sessionId),
          eq(schema.graphNodes.type, 'MESSAGE')
        )
      )
      .orderBy(desc(schema.graphNodes.createdAt))
      .limit(2)
      .all()
      // Skip the node we just inserted (it has the highest createdAt)
      .filter((n) => n.id !== nodeId);

    if (prev) {
      db.insert(schema.graphEdges).values({
        id: uuidv4(),
        sourceId: prev.id,
        targetId: nodeId,
        relationship: 'FOLLOWS',
        weight: 1.0,
        createdAt: now,
      }).run();
    }
  } catch (err) {
    logger.warn('[GraphService] writeConversationNode failed (degraded)', { err: String(err) });
  }
}

/**
 * Write CHUNK nodes and PART_OF edges for a set of RAG document chunks.
 * Each chunk becomes a CHUNK node; a PART_OF edge links it to the first
 * MESSAGE node in the session (as a logical parent anchor).
 *
 * F004: accepts optional `documentTitle` per chunk — persisted to node properties
 * so the graph can surface human-readable document names alongside chunk IDs.
 */
export async function writeChunkNodes(
  sessionId: string,
  chunks: {
    id: string;
    text: string;
    documentId?: string;
    /** F004: human-readable document title stored in node properties */
    documentTitle?: string;
    pageNumber?: number;
    similarityScore?: number;
    retrievedAt?: number;
  }[]
): Promise<void> {
  if (chunks.length === 0) return;

  try {
    const now = Date.now();

    // Find a session anchor node (the earliest MESSAGE in this session) to attach chunks to
    const [anchor] = db
      .select({ id: schema.graphNodes.id })
      .from(schema.graphNodes)
      .where(
        and(
          eq(schema.graphNodes.sessionId, sessionId),
          eq(schema.graphNodes.type, 'MESSAGE')
        )
      )
      .orderBy(schema.graphNodes.createdAt)
      .limit(1)
      .all();

    for (const chunk of chunks) {
      const nodeId = uuidv4();
      db.insert(schema.graphNodes).values({
        id: nodeId,
        conversationId: null,
        sessionId,
        type: 'CHUNK',
        label: chunk.text.slice(0, 200), // truncate label for storage efficiency
        properties: JSON.stringify({
          chunkId: chunk.id,
          ...(chunk.documentId    !== undefined && { documentId:    chunk.documentId }),
          ...(chunk.documentTitle !== undefined && { documentTitle: chunk.documentTitle }),
          ...(chunk.pageNumber    !== undefined && { pageNumber:    chunk.pageNumber }),
          ...(chunk.similarityScore !== undefined && { similarityScore: chunk.similarityScore }),
          ...(chunk.retrievedAt   !== undefined && { retrievedAt:   chunk.retrievedAt }),
        }),
        createdAt: now,
      }).run();

      // Link chunk to session anchor via PART_OF edge if one exists
      if (anchor) {
        db.insert(schema.graphEdges).values({
          id: uuidv4(),
          sourceId: nodeId,
          targetId: anchor.id,
          relationship: 'PART_OF',
          weight: 1.0,
          createdAt: now,
        }).run();
      }
    }
  } catch (err) {
    logger.warn('[GraphService] writeChunkNodes failed (degraded)', { err: String(err) });
  }
}

// ─── F004: Cross-Document Edge Detection ─────────────────────────────────────

/**
 * 50-word English stop-word set used by extractSignificantTokens.
 * Inlined to avoid a dependency on an NLP library.
 * (Why: token-overlap on non-stop-words is sufficient precision for tech documents)
 */
export const STOPWORDS: Set<string> = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'can', 'it', 'its', 'that',
  'this', 'these', 'those', 'not', 'no', 'as', 'if', 'so', 'then', 'than',
]);

/**
 * Extract significant (non-stop-word) tokens from a text string.
 * Splits on non-word characters, lowercases, filters short/stop-words.
 * (Why: longer vocabulary tokens are more discriminative for cross-doc similarity)
 */
export function extractSignificantTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/**
 * Create `SIMILAR_TO` edges between chunks from different documents that share
 * ≥ 3 non-stop-word tokens (token-overlap / Jaccard threshold).
 *
 * This is a fire-and-forget operation: errors are caught and logged, never thrown.
 * Called from `retrieveAndRerank` after `writeChunkNodes`.
 *
 * @param sessionId - Current session identifier
 * @param chunks    - Candidate chunks with id, text, and numeric documentId
 */
export async function createCrossDocumentEdges(
  sessionId: string,
  chunks: Array<{ id: string; text: string; documentId: number }>,
): Promise<void> {
  if (chunks.length < 2) return;

  try {
    const now = Date.now();
    // Pre-compute significant token sets per chunk
    const tokenSets = chunks.map((c) => extractSignificantTokens(c.text));

    // Check every pair (O(n²) — pool is bounded at 100, so max 4950 pairs)
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const chunkA = chunks[i]!;
        const chunkB = chunks[j]!;

        // Skip same-document pairs (no cross-document signal)
        if (chunkA.documentId === chunkB.documentId) continue;

        // Count shared significant tokens
        const setA = tokenSets[i]!;
        const setB = tokenSets[j]!;
        let sharedCount = 0;
        for (const token of setA) {
          if (setB.has(token)) sharedCount++;
        }

        if (sharedCount < 3) continue;

        // Insert SIMILAR_TO edge with metadata
        db.insert(schema.graphEdges).values({
          id: uuidv4(),
          sourceId: chunkA.id,
          targetId: chunkB.id,
          relationship: 'SIMILAR_TO',
          weight: sharedCount / Math.max(setA.size, setB.size, 1), // Jaccard weight
          properties: JSON.stringify({ isCrossDocument: true, sharedTokenCount: sharedCount }),
          createdAt: now,
        }).run();
      }
    }
  } catch (err) {
    // Fire-and-forget: log but never surface errors to the caller
    logger.warn('[GraphService] createCrossDocumentEdges failed (degraded)', {
      sessionId,
      err: String(err),
    });
  }
}

// ─── Query Operations ─────────────────────────────────────────────────────────

/**
 * Query graph nodes scoped to a session.
 * Performs a case-insensitive substring match on `label`.
 * Returns matching nodes and their incident edges, up to `limit` nodes.
 */
export async function queryGraph(
  sessionId: string,
  q: string,
  limit = 50
): Promise<GraphQueryResult> {
  try {
    const pattern = `%${q}%`;

    const nodes = db
      .select()
      .from(schema.graphNodes)
      .where(
        and(
          eq(schema.graphNodes.sessionId, sessionId),
          like(schema.graphNodes.label, pattern)
        )
      )
      .limit(limit)
      .all();

    if (nodes.length === 0) return { nodes: [], edges: [] };

    const nodeIds = nodes.map((n) => n.id);

    // Fetch edges where both source and target are in the result set
    const edges = db
      .select()
      .from(schema.graphEdges)
      .all()
      .filter(
        (e) => nodeIds.includes(e.sourceId) && nodeIds.includes(e.targetId)
      );

    // Parse the properties JSON blob before returning (DB stores it as a string)
    const parsedNodes = nodes.map((n) => ({
      ...n,
      properties: (() => { try { return JSON.parse(n.properties) as Record<string, unknown>; } catch { return {}; } })(),
    }));

    return { nodes: parsedNodes, edges };
  } catch (err) {
    logger.warn('[GraphService] queryGraph failed (degraded)', { err: String(err) });
    return { nodes: [], edges: [] };
  }
}

/**
 * Retrieve CODE_ENTITY nodes whose label or properties match the query term.
 * Used by chat-service to enrich the system prompt with codebase context.
 */
export async function queryCodeEntities(
  _sessionId: string,
  query: string,
  limit = 10
): Promise<{ id: string; label: string; properties: string }[]> {
  try {
    const pattern = `%${query}%`;
    return db
      .select({
        id: schema.graphNodes.id,
        label: schema.graphNodes.label,
        properties: schema.graphNodes.properties,
      })
      .from(schema.graphNodes)
      .where(
        and(
          eq(schema.graphNodes.type, 'CODE_ENTITY'),
          or(
            like(schema.graphNodes.label, pattern),
            like(schema.graphNodes.properties, pattern)
          )
        )
      )
      .limit(limit)
      .all();
  } catch (err) {
    logger.warn('[GraphService] queryCodeEntities failed (degraded)', { err: String(err) });
    return [];
  }
}

/**
 * Re-rank RAG candidates using graph edge weights.
 * Candidates that have a corresponding CHUNK node with higher-weight edges
 * are promoted. Falls back to the original order when the graph is empty
 * or the query fails.
 */
export async function rerankWithGraph<T extends { id?: string }>(
  _sessionId: string,
  candidates: T[]
): Promise<T[]> {
  if (candidates.length === 0) return candidates;

  try {
    // Build a weight map: chunkId → sum of edge weights
    const weightMap = new Map<string, number>();

    const edges = db
      .select({
        sourceId: schema.graphEdges.sourceId,
        weight: schema.graphEdges.weight,
      })
      .from(schema.graphEdges)
      .all();

    const nodeProps = db
      .select({ id: schema.graphNodes.id, properties: schema.graphNodes.properties })
      .from(schema.graphNodes)
      .where(eq(schema.graphNodes.type, 'CHUNK'))
      .all();

    // Map node IDs back to chunk IDs via the properties JSON blob
    const nodeToChunk = new Map<string, string>();
    for (const node of nodeProps) {
      try {
        const p = JSON.parse(node.properties) as { chunkId?: string };
        if (p.chunkId) nodeToChunk.set(node.id, p.chunkId);
      } catch { /* skip malformed properties */ }
    }

    for (const edge of edges) {
      const chunkId = nodeToChunk.get(edge.sourceId);
      if (chunkId) {
        weightMap.set(chunkId, (weightMap.get(chunkId) ?? 0) + (edge.weight ?? 1));
      }
    }

    if (weightMap.size === 0) return candidates; // empty graph — original order

    return [...candidates].sort((a, b) => {
      const wa = weightMap.get(a.id ?? '') ?? 0;
      const wb = weightMap.get(b.id ?? '') ?? 0;
      return wb - wa; // descending by weight
    });
  } catch (err) {
    logger.warn('[GraphService] rerankWithGraph failed (degraded)', { err: String(err) });
    return candidates;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Delete all graph nodes for a conversation.
 * Edges cascade-delete automatically via FK ON DELETE CASCADE.
 */
export async function cascadeDeleteConversation(
  conversationId: string
): Promise<void> {
  try {
    db.delete(schema.graphNodes)
      .where(eq(schema.graphNodes.conversationId, conversationId))
      .run();
  } catch (err) {
    logger.warn('[GraphService] cascadeDeleteConversation failed (degraded)', {
      err: String(err),
      conversationId,
    });
  }
}
