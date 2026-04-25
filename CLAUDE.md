# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all Vitest tests
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright E2E tests
npx drizzle-kit push # Apply schema to SQLite database
npm run db:seed      # Seed default personas and providers
```

Run a single test file: `npx vitest run __tests__/modules/chat/context-window.test.ts`

## Architecture

Next.js 14 App Router full-stack application. TypeScript strict mode. No monorepo — single process serves both API and UI.

### Module Boundary Pattern

```
src/modules/shared/  →  Database, types, validation, logging (used by all modules)
src/modules/chat/    →  LLM client, chat service, context window (depends on shared)
src/app/api/         →  Route handlers (depend on chat module)
src/components/      →  React client components (depend on API routes via fetch)
```

Dependencies flow one way: **Components → API Routes → Chat Module → Shared Module**. No circular imports. Each module exposes its public API through `index.ts`.

### Data Flow (Chat Request)

1. `ChatPanel` uses Vercel AI SDK `useChat` hook → POST `/api/chat`
2. Route validates input with Zod, calls `handleChatMessage()`
3. Chat service loads conversation's persona (system prompt) and provider config from DB
4. Context window trims message history (last 20 messages, then by 100K token cap)
5. `streamText()` streams from the configured LLM provider
6. `toDataStreamResponse()` returns SSE stream to client
7. On stream completion, assistant message is saved to DB asynchronously

### Database

SQLite via Drizzle ORM + better-sqlite3. Database file at `data/neurodesk.db` (gitignored). WAL mode and foreign keys enabled.

Four tables: `conversations`, `messages` (cascade-deletes with conversation), `personas`, `provider_configs`. Schema defined in `src/modules/shared/db/schema.ts`.

`better-sqlite3` is marked as a server external package in `next.config.mjs` — it must never be imported from client components.

### LLM Provider Abstraction

`src/modules/chat/llm-client.ts` wraps Vercel AI SDK. `getLLMModel()` maps provider name strings ("openai", "anthropic") to SDK instances. Adding a new provider requires: adding a case to this switch, installing the `@ai-sdk/<provider>` package, and adding a seed entry in `db/seed.ts`.

### Context Window

Hybrid approach in `src/modules/chat/context-window.ts`: first trim to N messages (default 20), then trim oldest messages until under token cap (default 100K). Token counting uses `js-tiktoken` with `gpt-4o` encoding (cl100k_base). Config values live in `src/lib/config.ts`.

## Testing

- **Unit tests**: `__tests__/modules/` — test modules in isolation with `vi.mock()`
- **Integration tests**: `__tests__/integration/` — test API routes
- **E2E tests**: `e2e/` — Playwright against running dev server
- **DB tests** use in-memory SQLite (`:memory:`) with manually created tables, not the app's DB singleton

Path alias `@/*` resolves to `./src/*` in both app and tests (configured in `vitest.config.ts`).

## Environment

- **OS**: Windows 11 — shell is Git Bash (bash on Windows). Use bash syntax for all commands; do NOT use PowerShell cmdlets (`Get-ChildItem`, `Set-Location`, etc.) unless explicitly asked.
- **Path separators**: Use forward slashes (`/`) in all shell commands. Double-quote paths that contain spaces.
- **Line endings**: Repository uses LF (`\n`). Git is configured with `core.autocrlf=true`; CRLF warnings on checkout are expected and harmless.

## Session Handoff

At the end of every session (on user request or approaching token limit), update
`memory/f015_session_handoff.md` (or the relevant handoff file for the active feature)
with: what was completed this session, what files were changed, and the exact next task
to start with in the next session. Keep it under 60 lines so it loads fast.

## General Behavior

- When the user says to ONLY do X (e.g., "only add to .gitignore"), do exactly that and nothing more. Do not perform additional operations like committing, pushing, or modifying other files unless explicitly asked.
- When the user references a file or asks "what do you think", always read the referenced files FIRST before responding. Do not ask the user to clarify what they want you to look at if files are clearly referenced in context.
- When given a scoped instruction, confirm what you will do before doing it if the scope is ambiguous.
- **Clarification echo-back**: After the user answers a clarification question, always confirm what you heard before acting. Format: "Got it — [restate the decision in one sentence]. Proceeding." This prevents acting on misheard answers.

## Git Operations

- Before any `git push`, always verify a remote is configured (`git remote -v`). If no remote exists, inform the user and offer to help set one up — do not attempt the push.
- Before committing, run `git status` to verify which files are staged. Never commit files that match `.gitignore` patterns.
- Do not add, commit, or push files beyond what the user explicitly requested.

## BMad Workflow

Follow the BMad workflow order strictly: **constitution → specify → clarify → plan → commit**. Do not skip steps or run them out of order unless the user explicitly requests it. If the user attempts to run a step out of order, inform them of the correct sequence.

## Key Constraints

- AI SDK versions must stay compatible: `ai@^4.3` requires `@ai-sdk/openai@^1.3` and `@ai-sdk/anthropic@^1.2` (v3.x providers use LanguageModelV3, incompatible with v4's LanguageModelV1)
- User messages capped at 10,000 characters (validated by Zod schema and UI)
- Conversation titles max 200 characters
- Personas are admin-managed, read-only for users in v1 — no CRUD API, only GET
- `systemPrompt` field is excluded from the personas API response (internal to chat service)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
