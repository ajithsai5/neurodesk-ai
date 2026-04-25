# Research: Platform Hardening (002.5)

**Date**: 2026-04-23  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## 1. Graphify Library

**Decision**: Install from GitHub (`npm install github:safishamsi/graphify`); verify npm publication before implementation.

**Confirmed Capabilities** (from project description):
- **Multimodal**: ingests code, PDFs, markdown, screenshots, diagrams, whiteboard photos, images (25+ languages), video (Whisper transcription with domain-aware prompts), audio
- **Code analysis**: tree-sitter AST parser supporting 25 languages including TypeScript, JavaScript, Go, Rust, Java, C/C++, Python, Ruby, C#, Kotlin, Scala, PHP, Swift, Lua, Zig, PowerShell, Elixir, Objective-C, Julia, Verilog, SystemVerilog, Vue, Svelte, Dart
- **Knowledge graph output**: extracts concepts and relationships from all inputs and connects them into a single queryable graph
- **AI tool integration**: invoked with `/graphify` in Claude Code, Codex, OpenCode, Cursor, Gemini CLI, GitHub Copilot CLI, VS Code Copilot Chat, Aider, and others
- **Use case**: "understand a codebase faster; find the 'why' behind architectural decisions"

**Integration approach for NeuroDesk AI**:
1. Run Graphify's tree-sitter TypeScript AST parser on `src/` to build the initial CODE_ENTITY knowledge graph (functions, classes, interfaces, imports with file paths and relationships)
2. Expose `queryCodeEntities(sessionId, query)` to inject matched code context into LLM system prompts (FR-018b — chat-assisted codebase understanding)
3. Feature 03 (Code Assistant) uses `queryCodeEntities()` directly — full implementation, not a stub
4. AST analysis is best-effort: failure logs a warning; app starts with empty graph; FR-021 graceful degradation applies

**Implementation checklist before coding**:
1. `npm show graphify` — check npm publication; use npm name if available, GitHub install otherwise
2. Inspect repository for: TypeScript types, `init()` / AST analysis API, query interface, storage adapter (SQLite vs in-memory)
3. Confirm Node.js 18/20 compatibility
4. If Graphify manages its own storage, evaluate passing Drizzle tables as adapter vs using Graphify's native store

**Fallback**: If Graphify lacks SQLite support or TypeScript types, implement a minimal in-house graph store using two Drizzle tables (`graph_nodes`, `graph_edges`) with the same `graph-service.ts` public API — the module interface remains stable regardless of the underlying adapter.

**Alternatives considered**: Neo4j (too heavy, separate process), DGraph (same), in-memory only (data lost on restart).

---

## 2. Coverage PR Comment Action

**Decision**: Use `davelosert/vitest-coverage-report@v2`.

**Rationale**: The most widely-used action for posting Vitest coverage summaries as PR comments. Requires `coverage/coverage-summary.json` (already produced by `reporter: ['json-summary']` in `vitest.config.ts`). Configuration:

```yaml
- name: Coverage report
  uses: davelosert/vitest-coverage-report-action@v2
  with:
    json-summary-path: coverage/coverage-summary.json
    json-final-path: coverage/coverage-final.json
```

Needs `pull-requests: write` permission on the job.

**Alternatives considered**: `codecov/codecov-action` (requires Codecov account), manual comment scripts (fragile).

---

## 3. CodeQL GitHub Actions

**Decision**: Use `github/codeql-action@v3` with `javascript-typescript` language pack.

**Rationale**: v3 is the current non-deprecated version as of 2026. The `javascript-typescript` language covers both `.js` and `.ts` files. Autobuild works for Next.js projects without configuration.

```yaml
- uses: github/codeql-action/init@v3
  with:
    languages: javascript-typescript
- uses: github/codeql-action/autobuild@v3
- uses: github/codeql-action/analyze@v3
  with:
    category: /language:javascript-typescript
```

Weekly schedule (`cron: '0 3 * * 1'`) recommended in addition to PR trigger.

**Alternatives considered**: Semgrep (not native to GitHub Security tab), Snyk (paid for private repos).

---

## 4. Dependabot Auto-Merge

**Decision**: Use a GitHub Actions workflow triggered by `pull_request` events from `dependabot[bot]` with `gh pr merge --auto --squash "$PR_URL"`.

**Rationale**: GitHub's native auto-merge feature (enabled via branch protection) combined with a Dependabot-triggered workflow is the lowest-complexity approach. Restrict auto-merge to patch updates only by checking the PR title or Dependabot metadata.

```yaml
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: write
    steps:
      - name: Auto-merge patch updates
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_URL: ${{ github.event.pull_request.html_url }}
        run: |
          # Only auto-merge patch updates (title contains "bump X from Y.Z.A to Y.Z.B")
          if echo "${{ github.event.pull_request.title }}" | grep -qP 'bump .+ from \d+\.\d+\.\d+ to \d+\.\d+\.\d+$'; then
            gh pr merge --auto --squash "$PR_URL"
          fi
```

**Alternatives considered**: Mergify (third-party service), Renovate (replaces Dependabot entirely — too large a change).

---

## 5. Node 18 / 20 Matrix in GitHub Actions

**Decision**: Use `strategy.matrix.node-version: ['18', '20']` with `actions/setup-node@v4`.

**Rationale**: Standard pattern, no NEEDS CLARIFICATION. Node 18 reaches EOL 2025-04-30; matrix ensures compatibility during the transition. After Node 18 EOL, drop from matrix.

```yaml
strategy:
  matrix:
    node-version: ['18', '20']
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
      cache: 'npm'
```

---

## 6. Vitest Coverage Threshold Raise

**Decision**: Raise all thresholds to 90 in `vitest.config.ts`.

**Current state**: `statements: 80, branches: 80, functions: 85, lines: 80`  
**Target state**: `statements: 90, branches: 90, functions: 90, lines: 90`

The `perFile` option is NOT enabled — threshold applies to the aggregate, not per file, which avoids CI failures for small files with low coverage.

---

## 7. React Component Testing Strategy

**Decision**: Use `@testing-library/react` + `jsdom` environment for component tests; use `toMatchSnapshot()` for snapshot tests.

**Rationale**: `@testing-library/react` and `jsdom` are already in `devDependencies`. Snapshot tests are the fastest way to get initial coverage on render-only components. Error boundary tests use `render()` with a child that throws.

`vitest.config.ts` change: add `environmentMatchGlobs` to apply `jsdom` environment only to component test files, keeping unit tests on `node`.

```typescript
environmentMatchGlobs: [
  ['__tests__/components/**', 'jsdom'],
],
```

---

## 8. Graph Visualisation Library

**Decision**: Use `react-force-graph-2d` (npm package, ~180KB gzipped) for the client-side graph panel.

**Rationale**: Lightweight, no backend service required, works in Next.js client components, has TypeScript types. The graph panel is a supplementary feature; a heavyweight library would not be justified.

**Alternatives considered**: D3.js (too low-level, significant boilerplate), Cytoscape.js (heavier), vis.js (no active TypeScript types).
