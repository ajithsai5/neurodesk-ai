# Data Model: Platform Hardening (002.5)

**Date**: 2026-04-23

---

## Existing Tables (unchanged)

- `conversations` — id, title, persona_id, created_at, updated_at
- `messages` — id, conversation_id (FK → conversations, cascade delete), role, content, created_at
- `personas` — id, name, system_prompt, created_at
- `provider_configs` — id, name, model, api_key, base_url, created_at

---

## New Tables: Graph Store

Two tables are added to `src/modules/shared/db/schema.ts`. If the Graphify library manages its own storage internally (determined during implementation), these Drizzle tables serve as the persistence layer that Graphify's SQLite adapter reads from; otherwise they are used directly.

### `graph_nodes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID assigned at write time |
| `conversation_id` | TEXT | FK → conversations(id) ON DELETE CASCADE, nullable | Owning conversation; null for RAG chunk nodes |
| `session_id` | TEXT | NOT NULL | User session identifier for personal graph scoping |
| `type` | TEXT | NOT NULL | Node type label: `MESSAGE`, `CHUNK`, `CODE_ENTITY` |
| `label` | TEXT | NOT NULL | Human-readable label (message excerpt, chunk title, symbol name) |
| `properties` | TEXT | NOT NULL | JSON blob of arbitrary key–value metadata |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (milliseconds) |

**Indexes**: `(conversation_id)`, `(session_id)`, `(type)`

**Cascade delete**: `conversation_id` references `conversations(id)` with `ON DELETE CASCADE` — when a conversation is deleted, all its `MESSAGE`-type nodes are automatically removed.

### `graph_edges`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID assigned at write time |
| `source_id` | TEXT | FK → graph_nodes(id) ON DELETE CASCADE | Origin node |
| `target_id` | TEXT | FK → graph_nodes(id) ON DELETE CASCADE | Destination node |
| `relationship` | TEXT | NOT NULL | Relationship type: `FOLLOWS`, `REFERENCES`, `PART_OF`, `SIMILAR_TO` |
| `weight` | REAL | DEFAULT 1.0 | Numeric weight used for graph re-ranking |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (milliseconds) |

**Indexes**: `(source_id)`, `(target_id)`, `(relationship)`

**Cascade delete**: Both `source_id` and `target_id` reference `graph_nodes(id)` with `ON DELETE CASCADE` — deleting a node automatically removes all edges incident to it.

---

## Entity Definitions

### GraphNode

```typescript
// src/modules/graph/types.ts
export interface GraphNode {
  id: string;
  conversationId: string | null;
  sessionId: string;
  type: 'MESSAGE' | 'CHUNK' | 'CODE_ENTITY';
  label: string;
  properties: Record<string, unknown>;
  createdAt: number;
}
```

### GraphEdge

```typescript
export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: 'FOLLOWS' | 'REFERENCES' | 'PART_OF' | 'SIMILAR_TO';
  weight: number;
  createdAt: number;
}
```

### GraphQueryResult

```typescript
export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

### GraphStats

Returned by `getGraphStats()` and included in `GET /api/health` response.

```typescript
export interface GraphStats {
  nodeCount: number;   // total rows in graph_nodes
  edgeCount: number;   // total rows in graph_edges
  lastUpdated: number | null; // max(created_at) across graph_nodes; null when store is empty
}
```

### CodeEntity

Properties embedded in the `properties` JSON blob of a `CODE_ENTITY` graph node.

```typescript
export interface CodeEntity {
  name: string;        // symbol name (e.g. "handleChatMessage")
  kind: 'function' | 'class' | 'interface' | 'import';
  filePath: string;    // relative to project root (e.g. "src/modules/chat/chat-service.ts")
  lineStart: number;   // 1-based line number where the declaration begins
  lineEnd: number;     // 1-based line number where the declaration ends
}
```

---

## State Transitions

| Entity | Trigger | Transition |
|--------|---------|-----------|
| `graph_nodes` (MESSAGE) | Chat stream completes | Created; silent-degradation on failure |
| `graph_nodes` (MESSAGE) | Conversation deleted | Cascade-deleted via FK (`conversation_id` FK) |
| `graph_edges` | Node created | Created linking new node to prior node in conversation (`FOLLOWS`) |
| `graph_edges` | Source or target node deleted | Cascade-deleted via FK |
| `graph_nodes` (CHUNK) | Document ingested via RAG | Created with `PART_OF` edges to document root node |
| `graph_nodes` (CODE_ENTITY) | App startup — Graphify tree-sitter AST analysis of `src/` | Created best-effort; on failure, warning logged and app starts with empty graph |
| `graph_nodes` (CODE_ENTITY) | Conversation deleted | **Not** cascade-deleted — `conversation_id` is NULL for CODE_ENTITY nodes; persists until next AST re-analysis |
| `graph_nodes` (CODE_ENTITY) | Source file removed or renamed | Stale nodes remain; re-running AST analysis refreshes the graph |

---

## Data Volume Assumptions

- Average conversation: ≤50 messages → ≤50 `MESSAGE` nodes, ≤49 `FOLLOWS` edges
- SC-005 performance target (2 s query) validated against this size
- No hard cap on total nodes; growth bounded by conversation deletion (cascade)
- RAG chunk nodes: one per ingested chunk; typical document produces 20–200 chunks
