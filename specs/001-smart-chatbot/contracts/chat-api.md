# API Contract: Chat

## POST /api/chat

Send a message and receive a streamed AI response.

**Request**:

```typescript
{
  conversationId: string;  // UUID of the conversation
  message: string;         // User message (1–10,000 chars)
}
```

**Response**: Streaming (`text/x-unknown` via Vercel AI SDK data stream
protocol). Tokens are sent as they are generated.

The stream contains:
- Text tokens (incrementally appended to form the full response)
- A finish signal when generation completes

**Side effects**:
- Creates a user Message record in the database
- Creates an assistant Message record (populated as streaming completes)
- Updates the Conversation's `updatedAt` timestamp

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Missing/invalid `conversationId` or empty/too-long `message` | `{ "error": "Invalid input", "details": [...] }` |
| 404 | Conversation not found or archived | `{ "error": "Conversation not found" }` |
| 500 | LLM provider error (timeout, rate limit, etc.) | `{ "error": "AI service unavailable", "provider": "openai" }` |

**Notes**:
- The conversation's active persona and provider are read from the
  Conversation record at request time.
- The hybrid context window (last 20 messages + 100K token cap) is
  applied before sending to the LLM.
- User input is validated via Zod schema at the route handler level.
