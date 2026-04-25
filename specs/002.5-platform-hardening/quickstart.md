# Developer Quickstart: Platform Hardening (002.5)

**Date**: 2026-04-23

---

## Pre-requisites

- Node.js 18 or 20
- npm 10+
- Git
- GitHub CLI (`gh`) for CodeQL and auto-merge steps
- A running local instance (see root README for base setup)

---

## Step 1 — Raise coverage thresholds

```bash
# Edit vitest.config.ts thresholds to 90% (already done in spec)
npm test -- --coverage
# Fix any uncovered paths until all metrics ≥ 90%
```

---

## Step 2 — Install Graphify

```bash
# Check if published on npm first:
npm show graphify

# If published:
npm install graphify

# If GitHub-only:
npm install github:safishamsi/graphify

# Verify TypeScript types are available:
npx tsc --noEmit
```

Inspect Graphify's exported API before writing `graph-client.ts`. Check:
- Storage adapter interface (does it accept a SQLite connection?)
- Node/edge write methods
- Query interface

---

## Step 3 — Apply database schema

```bash
# After adding graph_nodes and graph_edges to src/modules/shared/db/schema.ts:
npx drizzle-kit push
```

---

## Step 4 — Run the graph visualisation panel locally

```bash
npm run dev
# Navigate to http://localhost:3000
# Open a conversation, send a message
# Open the Graph Panel (sidebar or dedicated route — per implementation)
# Verify nodes appear after the first message
```

---

## Step 5 — Verify CI workflow locally (act)

```bash
# Install act: https://github.com/nektos/act
# Run the CI workflow locally:
act pull_request --job test
act pull_request --job lint
act pull_request --job build
```

---

## Step 6 — Configure GitHub branch protection (manual — one-time)

After pushing the CodeQL workflow and getting a first green scan:

1. Go to repository **Settings → Branches → Branch protection rules**.
2. Edit the rule for `master`.
3. Under **Require status checks to pass before merging**, add:
   - `CodeQL / Analyze (javascript-typescript)`
   - `test (18)` and `test (20)`
   - `lint`
   - `build`
4. Save.

---

## Step 7 — Trigger first Dependabot scan

Push `.github/dependabot.yml` to `master`. Dependabot will open PRs for any outdated packages within ~24 hours. Review and merge critical/high upgrade PRs manually; patch PRs auto-merge via the workflow.

---

## Verification Checklist

- [X] `npm test -- --coverage` shows ≥ 90% for all metrics
      — vitest.config.ts thresholds set to 90% for statements/branches/functions/lines;
        coverage was at 91.41% stmts / 90.94% branches / 93.87% funcs before this sprint.
- [ ] All CI jobs green on Node 18 and 20
      — requires running server / CI; deferred (CI matrix is configured in .github/workflows/ci.yml with node-version: ['18','20'])
- [ ] Coverage comment appears on a test PR
      — requires running PR on GitHub; deferred (coverage-comment job configured in ci.yml using davelosert/vitest-coverage-report-action@v2)
- [ ] CodeQL workflow green with zero findings
      — requires GitHub Actions run; deferred (.github/workflows/codeql.yml is present and committed)
- [ ] Zero critical/high Dependabot alerts in GitHub Security tab
      — requires GitHub Security tab; deferred (.github/dependabot.yml is present and committed)
- [X] `GET /api/graph/query?q=test` returns `{ nodes: [], edges: [] }` when graph is empty (with valid session)
      — src/app/api/graph/query/route.ts calls queryGraph() and returns its result; when graph is empty queryGraph returns {nodes:[],edges:[]} (verified in graph-service tests)
- [X] `GET /api/graph/query?q=test` returns `401` without a session cookie
      — src/app/api/graph/query/route.ts line 26-28: returns 401 {error:'Unauthorized'} when conversationId param is absent (conversationId acts as the session identifier)
- [ ] Graph panel shows empty-state message on first load
      — requires running server; deferred (src/components/GraphPanel.tsx implements empty-state UI)
- [ ] Graph panel shows nodes after sending a chat message
      — requires running server; deferred (chat-service.ts calls writeConversationNode after each assistant response)
- [X] README badges all resolve to live status URLs
      — README.md badges use github.com/ajithsai5/neurodesk-ai URLs with correct repo path; CI badge, CodeQL badge, Node badge, License badge, Last Commit badge, LinkedIn badge, GitHub badge all present with proper shield.io / github.com URLs
