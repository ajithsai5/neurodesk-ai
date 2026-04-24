# API Contract: GET /api/graph/query

**Date**: 2026-04-23  
**Status**: Draft  
**Implemented in**: `src/app/api/graph/query/route.ts`

---

## Overview

Returns graph nodes and edges matching a text query, scoped to the authenticated user's session. Requires an active session cookie identical to all other `/api/*` routes.

---

## Request

```
GET /api/graph/query?q={query}&limit={limit}
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | — | Search term matched against node labels and properties |
| `limit` | integer | No | 50 | Maximum number of nodes to return (1–200) |

### Headers

| Header | Value | Notes |
|--------|-------|-------|
| `Cookie` | session cookie | Set automatically by browser; same auth as all `/api/*` routes |

### Authentication

Requires a valid session. If no valid session exists, responds with `401 Unauthorized`. Session is read from the standard Next.js session mechanism used by all other API routes.

---

## Response

### 200 OK

```json
{
  "nodes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "conversationId": "conv-abc123",
      "sessionId": "sess-xyz789",
      "type": "MESSAGE",
      "label": "Explain the context window algorithm",
      "properties": {
        "role": "user",
        "messageId": "msg-001"
      },
      "createdAt": 1745388000000
    }
  ],
  "edges": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "sourceId": "550e8400-e29b-41d4-a716-446655440000",
      "targetId": "770e8400-e29b-41d4-a716-446655440002",
      "relationship": "FOLLOWS",
      "weight": 1.0,
      "createdAt": 1745388001000
    }
  ]
}
```

When no nodes match (including an empty graph store), returns `200 OK` with empty arrays — not an error:

```json
{ "nodes": [], "edges": [] }
```

### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| `400 Bad Request` | `{ "error": "Missing required parameter: q" }` | `q` parameter absent |
| `400 Bad Request` | `{ "error": "limit must be between 1 and 200" }` | `limit` out of range |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | No valid session |
| `500 Internal Server Error` | `{ "error": "Graph query failed" }` | Unexpected graph store error |

---

## Constraints

- Query is matched case-insensitively against `graph_nodes.label` and the JSON value of `graph_nodes.properties`.
- Results are scoped to the current user's `sessionId` — nodes from other sessions are never returned.
- Response includes only edges where both `source_id` and `target_id` are present in the returned `nodes` array.
- `limit` applies to nodes only; edges are returned for all matching nodes up to the node limit.
