# API Contract: Conversations

## GET /api/conversations

List conversations for the sidebar.

**Query parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | `active` \| `archived` | `active` | Filter by conversation status |

**Response** (`200`):

```typescript
{
  conversations: Array<{
    id: string;
    title: string;
    status: "active" | "archived";
    personaId: string;
    providerId: string;
    createdAt: string;   // ISO 8601
    updatedAt: string;   // ISO 8601
  }>;
}
```

Sorted by `updatedAt` descending (most recent first).

---

## POST /api/conversations

Create a new conversation.

**Request**:

```typescript
{
  personaId?: string;   // UUID, defaults to General Assistant
  providerId?: string;  // UUID, defaults to first available provider
}
```

**Response** (`201`):

```typescript
{
  id: string;
  title: string;          // "New Conversation"
  status: "active";
  personaId: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## GET /api/conversations/:id

Get a single conversation with its messages.

**Response** (`200`):

```typescript
{
  id: string;
  title: string;
  status: "active" | "archived";
  personaId: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
}
```

Messages are sorted by `createdAt` ascending (chronological).

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 404 | Conversation not found | `{ "error": "Conversation not found" }` |

---

## PATCH /api/conversations/:id

Update a conversation (rename, change persona, change provider).

**Request** (all fields optional):

```typescript
{
  title?: string;       // 1–200 chars
  personaId?: string;   // UUID
  providerId?: string;  // UUID
}
```

**Response** (`200`): Updated conversation object (same shape as GET).

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid title (empty/too long) or invalid ID references | `{ "error": "Invalid input", "details": [...] }` |
| 404 | Conversation not found | `{ "error": "Conversation not found" }` |

---

## DELETE /api/conversations/:id

Permanently delete a conversation and all its messages.

**Response** (`204`): No content.

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 404 | Conversation not found | `{ "error": "Conversation not found" }` |

---

## POST /api/conversations/:id/archive

Archive or unarchive a conversation.

**Request**:

```typescript
{
  archived: boolean;  // true = archive, false = unarchive (restore)
}
```

**Response** (`200`): Updated conversation object.

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 404 | Conversation not found | `{ "error": "Conversation not found" }` |
