<!--
Sync Impact Report
===================
Version change: N/A (initial) -> 1.0.0
Modified principles: N/A (first ratification)
Added sections:
  - Core Principles (7 principles)
  - Technology Constraints
  - Development Workflow
  - Governance
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md - OK (generic, no conflicts)
  - .specify/templates/spec-template.md - OK (generic, no conflicts)
  - .specify/templates/tasks-template.md - OK (generic, no conflicts)
  - .specify/templates/commands/ - N/A (no command files exist)
Follow-up TODOs: None
-->

# NeuroDesk AI Constitution

## Core Principles

### I. Modular Architecture

All features MUST be organized into clearly bounded modules with
explicit interfaces. Each module (e.g., `chat`, `rag`, `memory`)
MUST be self-contained and independently testable.

```text
# Module boundary example
src/
  modules/
    chat/         # Chat API + conversation logic
    rag/          # Document ingestion + retrieval
    memory/       # Short-term and long-term memory
    shared/       # Shared types, utilities, config
```

- Modules MUST NOT import internal implementation details from
  other modules; they MUST use the module's public API (exported
  types and functions from the module's `index.ts`).
- Cross-module communication MUST go through well-defined
  interfaces or shared types in `shared/`.
- New functionality MUST be placed in an existing module or justify
  the creation of a new one.

**Rationale**: NeuroDesk AI will grow to include codebase analysis,
multi-agent workflows, and personalized assistants. Loose coupling
ensures each capability can evolve, be tested, and be deployed
independently.

### II. Test-First (NON-NEGOTIABLE)

All new features and bug fixes MUST follow Test-Driven Development:

1. Write failing tests that capture the expected behavior.
2. Confirm the tests fail (Red).
3. Implement the minimum code to make tests pass (Green).
4. Refactor while keeping tests green (Refactor).

```typescript
// File: __tests__/modules/chat/chat-service.test.ts
describe("ChatService.sendMessage", () => {
  it("MUST return an AI response for a valid user message", async () => {
    const response = await chatService.sendMessage({
      conversationId: "conv-1",
      content: "Explain this function",
    });
    expect(response.content).toBeDefined();
    expect(response.role).toBe("assistant");
  });
});
```

- Unit tests MUST cover all public module APIs.
- Integration tests MUST cover cross-module interactions (e.g.,
  chat module calling RAG module for context retrieval).
- Tests MUST NOT be skipped, mocked away, or marked as TODO
  without a linked issue and deadline for resolution.

**Rationale**: An AI assistant that produces incorrect responses or
loses conversation context is worse than having no assistant. TDD
ensures correctness is verified before code is shipped.

### III. Security-First

Security MUST be treated as a non-negotiable constraint in every
design decision, not an afterthought.

- All user input MUST be validated and sanitized at system
  boundaries (API routes, file uploads, query parameters).
- API keys and secrets MUST NEVER be committed to the repository;
  they MUST be loaded from environment variables or a secrets
  manager.
- LLM API calls MUST sanitize user-provided content to prevent
  prompt injection attacks.
- Document uploads MUST be validated for file type, size limits,
  and content safety before processing.
- Authentication and authorization MUST be enforced on every API
  route that accesses user data or conversations.
- Dependencies MUST be audited regularly; `npm audit` MUST pass
  with zero critical or high vulnerabilities before merge.

```typescript
// File: src/middleware/validate-input.ts
// All API route handlers MUST use input validation middleware
export function validateInput(schema: ZodSchema) {
  return (req: NextRequest) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }
    return result.data;
  };
}
```

**Rationale**: NeuroDesk AI handles user documents, codebases, and
conversation history. A security breach could expose sensitive
intellectual property or proprietary code.

### IV. API-First Design

Every feature MUST be exposed through a well-defined API before
any UI is built.

- API routes MUST be defined in `src/app/api/` following Next.js
  conventions.
- Every endpoint MUST have a typed request/response contract using
  TypeScript interfaces or Zod schemas.
- API contracts MUST be documented with input parameters, response
  shape, and error codes.
- The chat interface, RAG queries, and memory operations MUST all
  be accessible via API independently of the web UI.

```typescript
// File: src/app/api/chat/route.ts
// Contract: POST /api/chat
// Request:  { conversationId: string, message: string }
// Response: { id: string, role: "assistant", content: string }
// Errors:   400 (invalid input), 401 (unauthorized), 500 (LLM error)
```

**Rationale**: API-first ensures the system can be consumed by
multiple clients (web UI, CLI, IDE extensions, future agents) and
enables independent testing of backend logic.

### V. Simplicity & YAGNI

Every piece of code MUST justify its existence by serving a current,
concrete requirement.

- Do NOT build abstractions for hypothetical future needs.
- Prefer inline logic over premature helper functions. Three
  similar lines are better than a premature abstraction.
- Start with the simplest solution that satisfies the requirement;
  refactor only when complexity is proven necessary.
- Do NOT add configuration options, feature flags, or plugin
  systems until there are at least two concrete use cases.
- When choosing between approaches, prefer the one with fewer
  moving parts and fewer dependencies.

**Rationale**: NeuroDesk AI has an ambitious roadmap (RAG, memory,
multi-agent, codebase analysis). Premature complexity in early
phases will slow down iteration and make the codebase harder to
evolve.

### VI. Observability & Documentation

All code MUST be written for readability and debuggability.

- Functions MUST have clear, descriptive names that convey intent.
- Complex logic MUST include inline comments explaining *why*, not
  *what*.
- Every module MUST include a brief comment block at the top of its
  entry file (`index.ts`) describing its purpose and public API.

```typescript
// File: src/modules/rag/index.ts
/**
 * RAG Module - Document ingestion and context retrieval
 *
 * Public API:
 *   ingestDocument(doc: Document): Promise<void>
 *   queryContext(query: string, opts?: QueryOpts): Promise<Context[]>
 *
 * Dependencies: shared/embedding-client, shared/vector-store
 */
```

- API routes MUST log request metadata (method, path, duration,
  status code) at the INFO level.
- Errors MUST be logged with full context (stack trace, request
  parameters, user ID) at the ERROR level.
- Structured JSON logging MUST be used in production; human-
  readable format is acceptable in development.

**Rationale**: An AI system's behavior is inherently harder to
debug than deterministic software. Strong observability and clear
documentation are essential for diagnosing issues in LLM responses,
RAG retrieval quality, and memory behavior.

### VII. Incremental Delivery

Features MUST be delivered in small, working increments that each
provide standalone value.

- Each user story MUST be independently deployable and testable.
- The MVP for any feature MUST be the smallest slice that delivers
  user value (e.g., chat API before RAG, RAG before memory).
- Branches MUST NOT accumulate more than one user story of work
  before merging.
- Every merge to the main branch MUST leave the application in a
  working, deployable state.

**Rationale**: NeuroDesk AI's scope spans chat, RAG, memory, and
future agent capabilities. Incremental delivery ensures each
capability is validated with real usage before building the next,
reducing waste and catching design issues early.

## Technology Constraints

**Language**: TypeScript (strict mode enabled)
**Framework**: Next.js (App Router) for both frontend and backend
**Runtime**: Node.js
**Package Manager**: npm
**LLM Integration**: OpenAI and Anthropic APIs via official SDKs
**Testing**: Vitest for unit/integration tests; Playwright for E2E
**Linting**: ESLint with strict TypeScript rules
**Formatting**: Prettier with project-level configuration

- All code MUST compile with `strict: true` in `tsconfig.json`.
- New dependencies MUST be justified; prefer built-in Node.js /
  Next.js capabilities over third-party packages.
- The project MUST use a single `package.json` at the root (no
  monorepo unless explicitly justified by a future requirement).

## Development Workflow

1. **Branch per feature**: Every feature or fix MUST be developed
   on a dedicated branch named `###-feature-name`.
2. **Spec before code**: Features MUST have an approved
   specification (`spec.md`) before implementation begins.
3. **Plan before build**: Non-trivial features MUST have an
   implementation plan (`plan.md`) derived from the spec.
4. **Tests before implementation**: Per Principle II, tests MUST be
   written and fail before production code is written.
5. **Review before merge**: All code MUST pass linting, type
   checking, and tests before merge. Code review is required for
   all changes to `main`.
6. **Commit discipline**: Each commit MUST represent a single
   logical change with a clear, descriptive message.

## Governance

This constitution is the supreme governing document for the
NeuroDesk AI project. All development practices, code reviews, and
architectural decisions MUST comply with its principles.

- **Amendments** require: (1) a written proposal describing the
  change and its rationale, (2) review of impact on existing code
  and workflows, (3) a migration plan if the change affects
  existing implementations.
- **Versioning** follows Semantic Versioning:
  - MAJOR: Backward-incompatible principle removals or
    redefinitions.
  - MINOR: New principles added or existing ones materially
    expanded.
  - PATCH: Clarifications, wording fixes, non-semantic
    refinements.
- **Compliance review**: Every pull request MUST verify compliance
  with this constitution. Reviewers MUST check that new code
  adheres to all applicable principles.
- **Complexity justification**: Any deviation from Principle V
  (Simplicity) MUST be documented in the implementation plan with
  a clear rationale for why the simpler alternative was rejected.

**Version**: 1.0.0 | **Ratified**: 2026-04-15 | **Last Amended**: 2026-04-15
