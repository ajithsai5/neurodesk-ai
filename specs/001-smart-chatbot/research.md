# Research: Smart Chatbot

**Branch**: `001-smart-chatbot` | **Date**: 2026-04-15
**Input**: Technical unknowns from plan Technical Context

## 1. Storage Solution

**Decision**: Drizzle ORM + SQLite (WAL mode)

**Rationale**: Drizzle is a lightweight (~35 KB) TypeScript-first ORM
with zero native binaries. SQLite in WAL mode handles concurrent reads
from multiple Next.js API route handlers without contention. No external
database server is required, aligning with Constitution Principle V
(Simplicity). When the project scales to v2, Drizzle supports a
near-mechanical dialect swap to PostgreSQL.

**Alternatives considered**:

| Option | Fit | Rejected Because |
|--------|-----|------------------|
| Prisma + SQLite | Strong TypeScript DX, auto-generated types | ~10 MB native binary adds cold-start latency in API routes |
| better-sqlite3 | Fastest raw throughput, zero abstraction | Hand-written SQL and manual type mappings become brittle as entities grow |
| Prisma + PostgreSQL | Best for concurrent writes at scale | Requires external DB server, violates simplicity principle for v1 |

## 2. LLM Streaming Pattern

**Decision**: Vercel AI SDK (`ai` package) with provider packages
(`@ai-sdk/openai`, `@ai-sdk/anthropic`)

**Rationale**: The `ai` SDK provides `streamText()` on the backend with
`toDataStreamResponse()` to return a streaming response from Next.js
route handlers. On the frontend, the `useChat` hook handles stream
consumption, token rendering, and message state automatically. This
eliminates manual `ReadableStream` plumbing and provides a standardized
wire format across providers.

**Alternatives considered**:

| Option | Fit | Rejected Because |
|--------|-----|------------------|
| Raw SDK streaming (openai + @anthropic-ai/sdk) | Full control, no extra dependency | Requires manual async iterator → ReadableStream wiring, custom frontend reader, duplicated logic per provider |
| Server-Sent Events (EventSource) | Standard browser API | Only supports GET requests, no request body — poorly suited for chat payloads |
| fetch + ReadableStream (manual) | Works everywhere, no dependencies | Significant boilerplate for stream parsing, chunk decoding, error handling on both ends |

**Notes**:
- The `ai` SDK uses the official provider APIs under the hood via
  `@ai-sdk/openai` and `@ai-sdk/anthropic` — this satisfies the
  constitution's requirement for official SDK integration.
- `useChat` provides built-in loading state, error handling, and
  message history management that aligns with FR-002, FR-003, FR-015.

## 3. Token Counting (Hybrid Context Window)

**Decision**: `js-tiktoken` with `cl100k_base` encoding, default token
cap of 100,000 tokens

**Rationale**: `js-tiktoken` is the lightweight WASM-based port of
OpenAI's `tiktoken` library. Using `cl100k_base` encoding provides
accurate token counts for OpenAI models and a close approximation
(~5-10% variance) for Anthropic models. A 100,000-token cap leaves
sufficient headroom below the 128K+ model context limit for system
prompts, persona instructions, and the model's output buffer.

**Alternatives considered**:

| Option | Fit | Rejected Because |
|--------|-----|------------------|
| Character heuristic (~4 chars/token) | Zero dependencies | 10-15% error rate makes the safety cap unreliable, especially for code-heavy content |
| `tiktoken` (full Python port) | Most accurate | Heavier than needed; js-tiktoken provides sufficient accuracy in a WASM bundle |
| No token counting (message count only) | Simplest | Long code-paste messages could exceed model limits silently, violating FR-005 safety cap |

## 4. Markdown Rendering

**Decision**: `react-markdown` + `remark-gfm` + `rehype-highlight`

**Rationale**: `react-markdown` is the standard React library for
rendering Markdown content. Combined with `remark-gfm` (GitHub Flavored
Markdown: tables, strikethrough, task lists) and `rehype-highlight`
(syntax highlighting for code blocks), it satisfies FR-004's
requirements for code blocks, paragraphs, headings, lists, and inline
code rendering.

**Alternatives considered**:

| Option | Fit | Rejected Because |
|--------|-----|------------------|
| `marked` + `DOMPurify` + manual rendering | Lightweight | Not React-native; requires dangerouslySetInnerHTML, increasing XSS risk (violates Principle III) |
| `@mdx-js/react` | Full MDX support | Overkill for rendering AI responses; adds unnecessary compilation step |
| `shiki` for syntax highlighting | Best highlighting quality | Larger bundle size; rehype-highlight is sufficient for v1 developer use cases |

## 5. UI Component Foundation

**Decision**: Tailwind CSS (utility-first) — no component library

**Rationale**: Next.js ships with first-class Tailwind support. Using
utility classes directly avoids the bundle size and learning curve of a
component library (shadcn/ui, Chakra, MUI). For v1 with a focused set
of components (sidebar, chat panel, dropdowns), custom Tailwind
components provide the right level of control without premature
abstraction (Principle V).

**Alternatives considered**:

| Option | Fit | Rejected Because |
|--------|-----|------------------|
| shadcn/ui | Good DX, copy-paste components | Adds Radix UI dependency chain; components may need customization anyway for chat-specific UX |
| Chakra UI | Accessible, themeable | Heavy bundle, opinionated styling system conflicts with Tailwind approach |
| Plain CSS modules | Zero dependencies | Slower iteration than utility-first; harder to maintain consistency across components |
