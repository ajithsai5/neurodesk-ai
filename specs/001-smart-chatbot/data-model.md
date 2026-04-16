# Data Model: Smart Chatbot

**Branch**: `001-smart-chatbot` | **Date**: 2026-04-15
**Source**: [spec.md](spec.md) Key Entities + Clarifications

## Entities

### Conversation

Represents a single chat thread owned by a user.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | string (UUID) | Primary key | Auto-generated on creation |
| title | string | Max 200 chars, not null | Auto-generated from first message; user-editable (FR-012c) |
| status | enum | `active` \| `archived` | Default: `active`. Archived hides from main sidebar (FR-012e) |
| personaId | string (UUID) | Foreign key → Persona.id, not null | Default: General Assistant persona ID |
| providerId | string (UUID) | Foreign key → ProviderConfig.id, not null | Default: first available provider |
| createdAt | datetime | Not null | ISO 8601, set on creation |
| updatedAt | datetime | Not null | ISO 8601, updated on every new message |

**Validation rules**:
- Title MUST NOT be empty or whitespace-only when user-edited
- Title MUST be truncated to 200 characters maximum

**State transitions**:

```text
[created] → active → archived → active (restore)
                   → [deleted] (permanent, FR-012d)
            active → [deleted] (permanent)
```

- `active → archived`: User archives from sidebar. Conversation hidden
  from main list but accessible via archive view.
- `archived → active`: User restores from archive view.
- `active → deleted` / `archived → deleted`: Permanent removal.
  All associated messages are cascade-deleted.

---

### Message

A single exchange within a conversation.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | string (UUID) | Primary key | Auto-generated on creation |
| conversationId | string (UUID) | Foreign key → Conversation.id, not null | Cascade delete when conversation is deleted |
| role | enum | `user` \| `assistant` | Indicates who sent the message |
| content | text | Not null, max 10,000 chars for user role | Assistant messages have no enforced max (model-determined) |
| createdAt | datetime | Not null | ISO 8601, set on creation |

**Validation rules**:
- User messages: MUST NOT be empty/whitespace; MUST NOT exceed
  10,000 characters (FR-014)
- Assistant messages: Content is whatever the model returns; no
  length validation applied
- Messages are append-only within a conversation (no edits, no
  deletes of individual messages)

**Ordering**: Messages within a conversation are ordered by
`createdAt` ascending (chronological).

---

### Persona

A predefined AI behavior profile that shapes response style.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | string (UUID) | Primary key | Auto-generated; seeded on first run |
| name | string | Max 100 chars, unique, not null | Display name (e.g., "Code Reviewer") |
| description | string | Max 500 chars, not null | Brief description shown in persona selector |
| systemPrompt | text | Not null | System-level instruction sent with every request |
| icon | string | Max 50 chars, nullable | Emoji or icon identifier for UI display |
| sortOrder | integer | Not null, default 0 | Controls display order in persona selector |

**Validation rules**:
- Name MUST be unique across all personas
- System prompt MUST NOT be empty

**Seed data** (FR-007 minimum set):

| Name | Description | Icon |
|------|-------------|------|
| General Assistant | Helpful all-purpose AI assistant for development tasks | `assistant` |
| Tutor | Patient teacher that explains concepts step-by-step with examples | `tutor` |
| Code Reviewer | Strict reviewer focused on bugs, best practices, and improvements | `reviewer` |

**Notes**: Personas are admin-managed, read-only for end users in v1.
No CRUD API for personas — only a GET endpoint to list them.

---

### ProviderConfig

A supported AI model/provider pairing.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | string (UUID) | Primary key | Auto-generated; seeded on first run |
| providerName | string | Max 50 chars, not null | Provider identifier (e.g., "openai", "anthropic") |
| modelId | string | Max 100 chars, not null | Model identifier (e.g., "gpt-4o", "claude-sonnet-4-20250514") |
| displayName | string | Max 100 chars, not null | Human-readable name shown in model switcher |
| isAvailable | boolean | Not null, default true | Can be toggled if a provider is down or unconfigured |
| sortOrder | integer | Not null, default 0 | Controls display order in model switcher |

**Validation rules**:
- Combination of (providerName, modelId) MUST be unique
- Display name MUST NOT be empty

**Seed data** (FR-016 minimum 2 providers):

| Provider | Model | Display Name |
|----------|-------|--------------|
| openai | gpt-4o | GPT-4o (OpenAI) |
| anthropic | claude-sonnet-4-20250514 | Claude Sonnet 4 (Anthropic) |

**Notes**: Provider configs are admin-managed, read-only for end users
in v1. `isAvailable` is checked before sending a request; if false, the
UI shows the provider as disabled.

## Relationships

```text
Conversation 1 ──── * Message
Conversation * ──── 1 Persona
Conversation * ──── 1 ProviderConfig
```

- A Conversation has many Messages (one-to-many, cascade delete).
- A Conversation references exactly one Persona (many-to-one).
- A Conversation references exactly one ProviderConfig (many-to-one).
- Personas and ProviderConfigs exist independently and are not deleted
  when a Conversation is deleted.

## Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| Conversation | idx_conv_status_updated | (status, updatedAt DESC) | Sidebar query: list active conversations sorted by recency |
| Message | idx_msg_conv_created | (conversationId, createdAt ASC) | Load messages for a conversation in order |
| Persona | idx_persona_sort | (sortOrder ASC) | Persona selector display order |
| ProviderConfig | idx_provider_sort | (sortOrder ASC) | Model switcher display order |
