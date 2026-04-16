# API Contract: Personas

## GET /api/personas

List all available personas.

**Response** (`200`):

```typescript
{
  personas: Array<{
    id: string;
    name: string;
    description: string;
    icon: string | null;
    sortOrder: number;
  }>;
}
```

Sorted by `sortOrder` ascending.

**Notes**:
- The `systemPrompt` field is intentionally excluded from the response.
  It is internal to the chat service and not exposed to the frontend.
- This is a read-only endpoint. Persona management is admin-only in v1.
