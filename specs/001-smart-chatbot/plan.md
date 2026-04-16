# Implementation Plan: Smart Chatbot

**Branch**: `001-smart-chatbot` | **Date**: 2026-04-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-smart-chatbot/spec.md`

## Summary

Build a full-featured conversational UI powered by LLM APIs with
streaming responses, a hybrid sliding context window (message count +
token cap), switchable bot personas, and multi-provider model selection.
The chat module establishes the shared LLM client, conversation
persistence, and chat UI that all subsequent NeuroDesk AI features
extend. Technology stack: Next.js App Router + Drizzle/SQLite + Vercel
AI SDK + Tailwind CSS.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)
**Framework**: Next.js 14+ (App Router)
**Primary Dependencies**: Vercel AI SDK (`ai`, `@ai-sdk/openai`,
`@ai-sdk/anthropic`), Drizzle ORM, `better-sqlite3`, `js-tiktoken`,
`react-markdown`, `remark-gfm`, `rehype-highlight`
**Storage**: SQLite (WAL mode) via Drizzle ORM — file-based, no
external server
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web — modern desktop browsers (Chrome, Firefox,
Safari, Edge; last 2 major versions)
**Project Type**: Full-stack web application (Next.js)
**Performance Goals**: First token within 2 seconds (SC-001); error
recovery within 3 seconds (SC-006)
**Constraints**: 10,000 character max per message; hybrid context
window (20 messages + 100K token cap)
**Scale/Scope**: Single-user v1; ~4 UI regions (sidebar, chat panel,
persona selector, model switcher)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1
design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Modular Architecture | Feature organized in bounded modules (`chat`, `shared`) with explicit public APIs via `index.ts` | PASS |
| II. Test-First | Plan follows TDD: tests written and failing before implementation in every phase | PASS |
| III. Security-First | Input validation on all API routes (Zod); API keys from env vars only; AI SDK handles prompt sanitization | PASS |
| IV. API-First Design | All 4 API route groups defined before UI components; typed request/response contracts via Zod | PASS |
| V. Simplicity & YAGNI | Single package.json; Drizzle+SQLite (no external DB); Tailwind (no component library); no premature abstractions | PASS |
| VI. Observability & Documentation | Module entry files documented; structured JSON logging on API routes; request metadata logging | PASS |
| VII. Incremental Delivery | 4 user stories each independently deployable; MVP = P1 (streaming chat) alone | PASS |

No gate violations. No complexity tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-smart-chatbot/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── chat-api.md
│   ├── conversations-api.md
│   ├── personas-api.md
│   └── providers-api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/                              # Next.js App Router
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts             # POST /api/chat (streaming)
│   │   ├── conversations/
│   │   │   ├── route.ts             # GET (list) + POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts         # GET + PATCH + DELETE
│   │   │       └── archive/
│   │   │           └── route.ts     # POST (archive/unarchive)
│   │   ├── personas/
│   │   │   └── route.ts             # GET /api/personas
│   │   └── providers/
│   │       └── route.ts             # GET /api/providers
│   ├── layout.tsx                   # Root layout (sidebar + main)
│   ├── page.tsx                     # Main chat page
│   └── globals.css                  # Tailwind + global styles
├── modules/
│   ├── chat/                        # Chat module
│   │   ├── index.ts                 # Public API exports
│   │   ├── chat-service.ts          # Core chat + streaming logic
│   │   ├── context-window.ts        # Hybrid sliding window
│   │   ├── llm-client.ts            # Multi-provider LLM client
│   │   └── types.ts                 # Chat-specific types
│   └── shared/                      # Shared module
│       ├── index.ts                 # Public API exports
│       ├── db/
│       │   ├── index.ts             # Drizzle client singleton
│       │   ├── schema.ts            # Table definitions
│       │   └── seed.ts              # Default personas + providers
│       ├── logger.ts                # Structured JSON logging
│       ├── validation.ts            # Zod schemas for API input
│       └── types.ts                 # Shared types
├── components/
│   ├── chat/
│   │   ├── ChatPanel.tsx            # Main chat area
│   │   ├── MessageList.tsx          # Scrollable message display
│   │   ├── MessageInput.tsx         # Input + char counter + send
│   │   └── StreamingMessage.tsx     # Token-by-token renderer
│   ├── sidebar/
│   │   ├── Sidebar.tsx              # Conversation list + actions
│   │   └── ConversationItem.tsx     # Single conversation row
│   ├── PersonaSelector.tsx          # Persona dropdown
│   └── ModelSwitcher.tsx            # Provider/model dropdown
└── lib/
    └── config.ts                    # App-level configuration

__tests__/
├── modules/
│   ├── chat/
│   │   ├── chat-service.test.ts
│   │   ├── context-window.test.ts
│   │   └── llm-client.test.ts
│   └── shared/
│       ├── validation.test.ts
│       └── db.test.ts
└── integration/
    ├── chat-api.test.ts
    └── conversations-api.test.ts

e2e/
└── chat-flow.spec.ts

drizzle/
├── migrations/                      # Auto-generated migrations
└── drizzle.config.ts               # Drizzle Kit configuration

data/
└── neurodesk.db                    # SQLite database file (gitignored)
```

**Structure Decision**: Single-project Next.js App Router structure
with `src/modules/` for bounded business logic (Constitution I) and
`src/app/api/` for API-first route handlers (Constitution IV). No
monorepo, no backend/frontend split — Next.js serves both from a
single process. The `modules/` directory enforces the module boundary
pattern required by the constitution.

## Complexity Tracking

No violations to justify. All design decisions align with
constitutional principles.
