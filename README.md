# NeuroDesk AI

![](https://img.shields.io/badge/Coverage-91%25-83A603.svg?prefix=$coverage$)
![CI](https://github.com/ajithsai/neurodesk-ai/actions/workflows/ci.yml/badge.svg)

AI-powered desktop assistant — chat, RAG, and memory. Built with Next.js 14, TypeScript, and SQLite.

## Quick Start

```bash
npm install
npm run dev       # Start dev server at http://localhost:3000
npx drizzle-kit push
npm run db:seed
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run all Vitest tests |
| `npm run test:watch` | Watch mode |
| `npm run test:e2e` | Playwright E2E tests |

## Testing

### Run all tests

```bash
npm test
```

### Run with coverage report

```bash
npm test -- --coverage
```

Generates `coverage/index.html` — open in a browser for per-file drilldown.
Exits non-zero if any coverage threshold is breached.

### Coverage thresholds

| Metric | Threshold |
|--------|-----------|
| Statements | ≥ 80% |
| Branches | ≥ 90% |
| Functions | ≥ 85% |
| Lines | ≥ 80% |

### Run a single test file

```bash
npx vitest run __tests__/integration/chat-api.test.ts
npx vitest run __tests__/components/MessageInput.test.tsx
npx vitest run __tests__/modules/shared/logger.test.ts
```

### View HTML coverage report

```bash
# Windows
start coverage/index.html

# macOS/Linux
open coverage/index.html
```

## Architecture

Next.js 14 App Router full-stack application. See [CLAUDE.md](CLAUDE.md) for the full architecture guide.

```
Components → API Routes → Chat Module → Shared Module
```

## Database

SQLite via Drizzle ORM. Database file at `data/neurodesk.db` (gitignored).

```bash
npx drizzle-kit push    # Apply schema
npm run db:seed         # Seed default personas and providers
```
