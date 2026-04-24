// File: src/modules/graph/types.ts
/**
 * Graph Module — Shared Type Definitions
 *
 * Defines the TypeScript interfaces for graph nodes, edges, query results,
 * statistics, and code entities extracted from the codebase via AST analysis.
 * All types mirror the data-model.md specification exactly.
 */

// ─── Node ────────────────────────────────────────────────────────────────────

/** The three categories of knowledge-graph nodes. */
export type GraphNodeType = 'MESSAGE' | 'CHUNK' | 'CODE_ENTITY';

/**
 * A single node in the knowledge graph.
 *
 * - MESSAGE: a chat conversation turn
 * - CHUNK: a RAG document chunk
 * - CODE_ENTITY: a TypeScript symbol extracted via AST analysis (function, class, interface, import)
 *
 * conversationId is null for CODE_ENTITY and CHUNK nodes — only MESSAGE nodes
 * are owned by a conversation and cascade-delete with it.
 */
export interface GraphNode {
  id: string;
  conversationId: string | null;
  sessionId: string;
  type: GraphNodeType;
  label: string;
  /** Arbitrary JSON metadata. For CODE_ENTITY nodes this contains a CodeEntity object. */
  properties: Record<string, unknown>;
  createdAt: number; // Unix timestamp (ms)
}

// ─── Edge ────────────────────────────────────────────────────────────────────

/** The four supported relationship types between graph nodes. */
export type GraphRelationship = 'FOLLOWS' | 'REFERENCES' | 'PART_OF' | 'SIMILAR_TO';

/**
 * A directed relationship between two graph nodes.
 *
 * - FOLLOWS: sequential order (message N → message N+1)
 * - REFERENCES: one node mentions/uses another (e.g. code entity used in a message)
 * - PART_OF: chunk belongs to a document root node
 * - SIMILAR_TO: semantic similarity between chunks or code entities
 */
export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: GraphRelationship;
  /** Numeric weight used for graph-based RAG re-ranking (higher = stronger connection). */
  weight: number;
  createdAt: number; // Unix timestamp (ms)
}

// ─── Query Result ─────────────────────────────────────────────────────────────

/**
 * Response shape for GET /api/graph/query.
 * edges only contains edges where both source and target are in nodes.
 */
export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * Aggregate statistics returned by getGraphStats() and included in GET /api/health.
 * lastUpdated is null when the graph store is empty.
 */
export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  lastUpdated: number | null; // max(createdAt) across graph_nodes; null when empty
}

// ─── Code Entity ─────────────────────────────────────────────────────────────

/**
 * A structural element of the TypeScript codebase extracted by AST analysis.
 * Stored as the `properties` JSON blob of a CODE_ENTITY graph node.
 *
 * Extracted from src/ on application startup (best-effort — failure is non-fatal).
 * CODE_ENTITY nodes are NOT cascade-deleted when conversations are deleted;
 * they persist until the next AST re-analysis on the next cold startup.
 */
export interface CodeEntity {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'import';
  filePath: string;  // relative to project root, e.g. "src/modules/chat/chat-service.ts"
  lineStart: number; // 1-based
  lineEnd: number;   // 1-based
}
