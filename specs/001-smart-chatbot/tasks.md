# Tasks: Smart Chatbot

**Input**: Design documents from `/specs/001-smart-chatbot/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per constitution principle II (Test-First) and plan-defined test file structure.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root (Next.js App Router)
- **Tests**: `__tests__/` (Vitest), `e2e/` (Playwright)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Next.js project, install dependencies, and configure tooling

- [x] T001 Initialize Next.js 14 project with TypeScript strict mode and install all dependencies (ai, @ai-sdk/openai, @ai-sdk/anthropic, drizzle-orm, better-sqlite3, js-tiktoken, react-markdown, remark-gfm, rehype-highlight, zod, uuid) via package.json
- [x] T002 [P] Configure Tailwind CSS and create global styles in src/app/globals.css
- [x] T003 [P] Create .env.example with OPENAI_API_KEY and ANTHROPIC_API_KEY placeholders
- [x] T004 [P] Create app-level configuration (context window defaults, token cap, message length limit) in src/lib/config.ts
- [x] T005 [P] Configure Vitest for unit and integration testing in vitest.config.ts
- [x] T006 [P] Configure Playwright for E2E testing in playwright.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, shared modules, and root layout that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Define database schema for Conversation, Message, Persona, and ProviderConfig tables in src/modules/shared/db/schema.ts
- [x] T008 Create Drizzle client singleton with SQLite WAL mode in src/modules/shared/db/index.ts
- [x] T009 Configure Drizzle Kit for migrations in drizzle/drizzle.config.ts
- [x] T010 [P] Create seed data script with 3 default personas (General Assistant, Tutor, Code Reviewer) and 2 providers (GPT-4o, Claude Sonnet 4) in src/modules/shared/db/seed.ts
- [x] T011 [P] Create shared TypeScript types for Conversation, Message, Persona, and ProviderConfig in src/modules/shared/types.ts
- [x] T012 [P] Create Zod validation schemas for chat input, conversation create/update, and archive toggle in src/modules/shared/validation.ts
- [x] T013 [P] Implement structured JSON logger with request metadata support in src/modules/shared/logger.ts
- [x] T014 Create shared module public API exports in src/modules/shared/index.ts
- [x] T015 [P] Write database integration tests (connection, CRUD, cascade delete, indexes) in __tests__/modules/shared/db.test.ts
- [x] T016 [P] Write validation schema tests (valid inputs, edge cases, rejection) in __tests__/modules/shared/validation.test.ts
- [x] T017 Create root layout with sidebar + main panel structure in src/app/layout.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Streaming Chat Conversation (Priority: P1) MVP

**Goal**: A user can open the chat UI, send a message, and see the AI response stream in token by token. Conversations are persisted and manageable from a sidebar.

**Independent Test**: Open the chat UI, send "Hello", verify the response streams character by character with a progress indicator, then ask a follow-up and verify it works in the same thread.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T018 [P] [US1] Write unit tests for LLM client (provider initialization, streamText call, error handling) in __tests__/modules/chat/llm-client.test.ts
- [x] T019 [P] [US1] Write unit tests for chat service (message persistence, stream orchestration, error paths) in __tests__/modules/chat/chat-service.test.ts
- [x] T020 [P] [US1] Write integration tests for POST /api/chat (valid request, invalid input 400, conversation not found 404, provider error 500) in __tests__/integration/chat-api.test.ts
- [x] T021 [P] [US1] Write integration tests for conversations API (list, create, get, rename, delete, archive/unarchive) in __tests__/integration/conversations-api.test.ts

### Implementation for User Story 1

- [x] T022 [P] [US1] Create chat-specific types (ChatRequest, StreamCallbacks, LLMProviderConfig) in src/modules/chat/types.ts
- [x] T023 [US1] Implement multi-provider LLM client using Vercel AI SDK streamText with @ai-sdk/openai and @ai-sdk/anthropic in src/modules/chat/llm-client.ts
- [x] T024 [US1] Implement chat service: save user message, load persona system prompt, call LLM client, save assistant response on stream completion, update conversation timestamp in src/modules/chat/chat-service.ts
- [x] T025 [US1] Create chat module public API exports in src/modules/chat/index.ts
- [x] T026 [US1] Implement POST /api/chat route with Zod validation, chat service call, and toDataStreamResponse in src/app/api/chat/route.ts
- [x] T027 [P] [US1] Implement GET (list by status, sorted by updatedAt DESC) and POST (create with optional personaId/providerId) in src/app/api/conversations/route.ts
- [x] T028 [US1] Implement GET (with messages), PATCH (rename, change persona/provider), and DELETE (cascade) in src/app/api/conversations/[id]/route.ts
- [x] T029 [US1] Implement POST archive/unarchive toggle in src/app/api/conversations/[id]/archive/route.ts
- [x] T030 [P] [US1] Create StreamingMessage component with react-markdown, remark-gfm, and rehype-highlight for code block rendering in src/components/chat/StreamingMessage.tsx
- [x] T031 [P] [US1] Create MessageList component with auto-scroll to latest message in src/components/chat/MessageList.tsx
- [x] T032 [P] [US1] Create MessageInput component with 10,000-char limit, character counter, empty/whitespace validation, and send button in src/components/chat/MessageInput.tsx
- [x] T033 [US1] Create ChatPanel integrating Vercel AI SDK useChat hook with streaming indicator, error display, and retry mechanism in src/components/chat/ChatPanel.tsx
- [x] T034 [P] [US1] Create ConversationItem component with title display, rename inline edit, and context menu (archive, delete) in src/components/sidebar/ConversationItem.tsx
- [x] T035 [US1] Create Sidebar with conversation list (active/archived views), new conversation button, and archive toggle in src/components/sidebar/Sidebar.tsx
- [x] T036 [US1] Wire up main chat page: conversation selection state, ChatPanel + Sidebar integration in src/app/page.tsx

**Checkpoint**: User Story 1 is fully functional — users can chat with streaming responses, manage conversations from the sidebar, and conversations persist across sessions

---

## Phase 4: User Story 2 - Multi-Turn Context Window (Priority: P2)

**Goal**: The system retains the last N messages (default 20) with a 100K token safety cap, enabling coherent multi-turn conversations. Oldest messages are silently dropped when limits are exceeded.

**Independent Test**: Send a sequence of related messages (define a variable in message 1, reference it in message 3) and verify the AI correctly uses prior context. Then exceed the window size and verify oldest messages are trimmed without disruption.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T037 [P] [US2] Write unit tests for context window (message count trimming, token cap trimming, hybrid behavior, minimum window enforcement, edge cases) in __tests__/modules/chat/context-window.test.ts

### Implementation for User Story 2

- [x] T038 [US2] Implement hybrid sliding context window: load last N messages, count tokens with js-tiktoken cl100k_base encoding, trim oldest until under 100K token cap, enforce minimum window size in src/modules/chat/context-window.ts
- [x] T039 [US2] Integrate context window with chat service: apply window before sending messages to LLM client in src/modules/chat/chat-service.ts

**Checkpoint**: Multi-turn conversations retain context correctly, and long conversations are gracefully trimmed

---

## Phase 5: User Story 3 - System Prompt Persona Selection (Priority: P3)

**Goal**: Users can select from predefined personas (General Assistant, Tutor, Code Reviewer) that change the AI's response behavior via system prompts. Personas can be switched mid-conversation.

**Independent Test**: Select "Code Reviewer", paste a code snippet, verify the response focuses on review feedback. Switch to "Tutor", paste the same snippet, verify the response is educational.

### Implementation for User Story 3

- [x] T040 [P] [US3] Implement GET /api/personas route returning personas sorted by sortOrder (excluding systemPrompt from response) in src/app/api/personas/route.ts
- [x] T041 [P] [US3] Create PersonaSelector dropdown component showing persona name, description, and icon with current selection highlighted in src/components/PersonaSelector.tsx
- [x] T042 [US3] Integrate persona selection with ChatPanel: load personas on mount, update conversation via PATCH when persona changes, default to General Assistant in src/components/chat/ChatPanel.tsx

**Checkpoint**: Users can switch personas and see different AI response styles within the same conversation

---

## Phase 6: User Story 4 - Model Provider Switching (Priority: P4)

**Goal**: Users can switch between AI providers (OpenAI GPT-4o, Anthropic Claude Sonnet 4) mid-conversation. The chat UI remains unchanged; only the underlying model changes.

**Independent Test**: Start a conversation with OpenAI, switch to Anthropic mid-conversation, send a message, and verify the response comes from the new provider while context is preserved.

### Implementation for User Story 4

- [x] T043 [P] [US4] Implement GET /api/providers route returning providers sorted by sortOrder with isAvailable status in src/app/api/providers/route.ts
- [x] T044 [P] [US4] Create ModelSwitcher dropdown component showing provider display name, availability status (disable unavailable), and current selection in src/components/ModelSwitcher.tsx
- [x] T045 [US4] Integrate model switching with ChatPanel: load providers on mount, update conversation via PATCH when provider changes, show error for unavailable providers in src/components/chat/ChatPanel.tsx

**Checkpoint**: Users can switch AI providers mid-conversation seamlessly

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: E2E testing, error resilience, and performance validation across all stories

- [x] T046 [P] Write E2E test for full chat flow (new conversation, send message, streaming response, switch persona, switch model, rename, archive, restore, delete) in e2e/chat-flow.spec.ts
- [x] T047 [P] Add message queuing: when user sends a message while streaming, queue it and auto-send after current response completes in src/components/chat/ChatPanel.tsx
- [x] T048 Performance validation: verify first-token latency under 2 seconds (SC-001) and error recovery within 3 seconds (SC-006)
- [x] T049 Run quickstart.md validation end-to-end (install, configure, migrate, seed, start, first chat)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories proceed sequentially in priority order (P1 -> P2 -> P3 -> P4)
  - US2 builds on US1's chat service
  - US3 and US4 build on US1's ChatPanel
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 chat service (T024) - Adds context window integration to chat-service.ts
- **User Story 3 (P3)**: Depends on US1 ChatPanel (T033) - Adds persona selector to ChatPanel
- **User Story 4 (P4)**: Depends on US1 ChatPanel (T033) - Adds model switcher to ChatPanel

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types before services
- Services before API routes
- API routes before UI components (contract is defined)
- Individual components before composite components (ChatPanel)
- Composite components before page integration

### Parallel Opportunities

- **Phase 1**: T002-T006 can all run in parallel
- **Phase 2**: T010-T013 in parallel; T015-T016 in parallel
- **Phase 3 tests**: T018-T021 all in parallel
- **Phase 3 types**: T022 in parallel with tests
- **Phase 3 APIs**: T026 and T027 in parallel (different route groups)
- **Phase 3 UI**: T030, T031, T032, T034 all in parallel (independent components)
- **Phase 5**: T040 and T041 in parallel
- **Phase 6**: T043 and T044 in parallel
- **Phase 7**: T046 and T047 in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (write-first, must fail):
Task: "Write unit tests for LLM client in __tests__/modules/chat/llm-client.test.ts"
Task: "Write unit tests for chat service in __tests__/modules/chat/chat-service.test.ts"
Task: "Write integration tests for chat API in __tests__/integration/chat-api.test.ts"
Task: "Write integration tests for conversations API in __tests__/integration/conversations-api.test.ts"

# Launch chat types in parallel with tests:
Task: "Create chat-specific types in src/modules/chat/types.ts"

# After types complete, sequential backend chain:
Task: "Implement LLM client in src/modules/chat/llm-client.ts"
Task: "Implement chat service in src/modules/chat/chat-service.ts"
Task: "Create chat module exports in src/modules/chat/index.ts"

# Launch independent API routes in parallel:
Task: "Implement POST /api/chat in src/app/api/chat/route.ts"
Task: "Implement GET+POST /api/conversations in src/app/api/conversations/route.ts"

# Launch independent UI components in parallel:
Task: "Create StreamingMessage in src/components/chat/StreamingMessage.tsx"
Task: "Create MessageList in src/components/chat/MessageList.tsx"
Task: "Create MessageInput in src/components/chat/MessageInput.tsx"
Task: "Create ConversationItem in src/components/sidebar/ConversationItem.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 - Streaming Chat
4. **STOP and VALIDATE**: Open http://localhost:3000, send a message, verify streaming works
5. Deploy/demo if ready - this is a functional AI chat assistant

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test streaming chat -> Deploy/Demo (MVP!)
3. Add User Story 2 -> Test multi-turn context -> Deploy/Demo
4. Add User Story 3 -> Test persona switching -> Deploy/Demo
5. Add User Story 4 -> Test model switching -> Deploy/Demo
6. Each story adds value without breaking previous stories

### Single Developer Strategy

1. Complete Setup + Foundational (Phases 1-2)
2. User Story 1 (Phase 3): Write tests -> implement backend -> implement UI -> validate
3. User Story 2 (Phase 4): Write test -> implement context window -> integrate -> validate
4. User Story 3 (Phase 5): Implement API -> build UI -> integrate -> validate
5. User Story 4 (Phase 6): Implement API -> build UI -> integrate -> validate
6. Polish (Phase 7): E2E tests -> edge cases -> performance -> quickstart validation

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable after its checkpoint
- Verify tests fail before implementing (TDD per constitution principle II)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The Vercel AI SDK `useChat` hook handles much of the streaming UI state — leverage it rather than building custom stream handling
