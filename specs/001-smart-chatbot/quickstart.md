# Quickstart: Smart Chatbot

Get the Smart Chatbot running locally in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- At least one LLM provider API key:
  - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  - Anthropic: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

## Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure environment variables**:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your API key(s):

   ```env
   # At least one is required
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Initialize the database**:

   ```bash
   npx drizzle-kit push
   ```

   This creates the SQLite database at `data/neurodesk.db` with all
   tables and seed data (default personas + provider configurations).

4. **Start the development server**:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## First Chat

1. The app opens with an empty chat panel and a sidebar on the left.
2. Click **New Conversation** in the sidebar (or just start typing).
3. Type a message like "Explain what a Promise is in JavaScript" and
   press Enter or click Send.
4. Watch the AI response stream in token by token.
5. Ask a follow-up: "Can you show me an example with async/await?"
   The AI will reference the prior context.

## Switching Personas

1. Click the persona selector (top of the chat panel).
2. Choose **Code Reviewer** or **Tutor**.
3. Send a message — the AI's response style changes to match the
   selected persona.

## Switching Models

1. Click the model switcher (top-right of the chat panel).
2. Select a different provider/model combination.
3. Your next message will use the new model. Conversation history and
   persona are preserved.

## Managing Conversations

- **Rename**: Right-click (or use the context menu) on a conversation
  in the sidebar and select "Rename."
- **Archive**: Right-click → "Archive." The conversation disappears
  from the main list.
- **View archived**: Click "Archived" at the bottom of the sidebar to
  see hidden conversations. Click "Restore" to bring one back.
- **Delete**: Right-click → "Delete." This is permanent.

## Project Structure

```text
src/
├── app/api/          # API routes (chat, conversations, personas, providers)
├── modules/chat/     # Chat business logic (streaming, context window, LLM client)
├── modules/shared/   # Database, logging, validation, shared types
├── components/       # React UI components
└── lib/              # App configuration
```

## Common Issues

| Issue | Solution |
|-------|---------|
| "AI service unavailable" | Check that your API key is set in `.env.local` and the provider is available |
| Database errors on startup | Run `npx drizzle-kit push` to ensure the schema is up to date |
| Streaming not working | Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge) |
| Context seems lost | Check if the conversation has exceeded 20 messages — oldest messages are trimmed by the context window |
