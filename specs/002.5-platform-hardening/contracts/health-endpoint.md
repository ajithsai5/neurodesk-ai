# API Contract: GET /api/health

**Date**: 2026-04-24  
**Status**: Draft  
**Implemented in**: `src/app/api/health/route.ts`  
**FR**: FR-020b (graph stats addition)

---

## Overview

Returns a health check response for the application. Updated in Feature 002.5 to include graph store statistics (`nodeCount`, `edgeCount`, `lastUpdated`). No authentication required — this endpoint is used by uptime monitors and CI smoke tests.

---

## Request

```
GET /api/health
```

### Headers

No special headers required.

### Authentication

None — public endpoint.

---

## Response

### 200 OK — All systems healthy

```json
{
  "status": "ok",
  "timestamp": 1745388000000,
  "graph": {
    "nodeCount": 142,
    "edgeCount": 187,
    "lastUpdated": 1745387900000
  }
}
```

### 200 OK — Graph store empty (first run or no conversations yet)

```json
{
  "status": "ok",
  "timestamp": 1745388000000,
  "graph": {
    "nodeCount": 0,
    "edgeCount": 0,
    "lastUpdated": null
  }
}
```

### 200 OK — Graph store unreachable (degraded)

When the graph store cannot be reached (e.g. Graphify init failure), the health check still returns `200 ok` but the `graph` key is `null`:

```json
{
  "status": "ok",
  "timestamp": 1745388000000,
  "graph": null
}
```

### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| `500 Internal Server Error` | `{ "status": "error", "message": "..." }` | Unexpected server-side failure (e.g. database completely unreachable) |

---

## Field Reference

### Top-level

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` \| `"error"` | Application health status |
| `timestamp` | integer | Unix timestamp (ms) when the response was generated |
| `graph` | `GraphStats \| null` | Graph store statistics; `null` when the store is unreachable |

### `graph` object (when not null)

| Field | Type | Description |
|-------|------|-------------|
| `nodeCount` | integer | Total rows in `graph_nodes` table |
| `edgeCount` | integer | Total rows in `graph_edges` table |
| `lastUpdated` | integer \| null | `max(created_at)` across all `graph_nodes`; `null` when no nodes exist |

---

## Constraints

- Response time MUST be under 500 ms under normal load.
- The `graph` stats query MUST NOT block app startup — they are fetched lazily on each health check request.
- `graph: null` (store unreachable) is distinct from `graph: { nodeCount: 0, ... }` (store healthy but empty).
