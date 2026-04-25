# Feature Specification: Platform Hardening — Coverage, CI, Security, Graphify & README

**Feature Branch**: `002.5-platform-hardening`  
**Created**: 2026-04-23  
**Status**: Draft  
**Feature ID**: 002.5  
**Depends On**: 002 (Document Q&A RAG)  
**Priority**: Critical — must be completed before Feature 03 development begins

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Developer runs CI and all checks pass (Priority: P1)

A developer pushes a commit or opens a pull request. The CI pipeline runs automatically, executes all tests (unit, integration), enforces lint rules, checks code quality via CodeQL, and reports a coverage percentage on the PR. Every job passes cleanly on both supported Node versions.

**Why this priority**: CI is the gating mechanism for all future development. A broken or incomplete pipeline blocks every other team workflow.

**Independent Test**: Push any commit to a branch, open a PR, and verify that the Actions summary shows all jobs green (lint, test, build, CodeQL) and a coverage comment appears on the PR.

**Acceptance Scenarios**:

1. **Given** a pull request is opened, **When** GitHub Actions triggers, **Then** lint, test, and build jobs all complete successfully on Node 18 and Node 20.
2. **Given** test coverage drops below 90%, **When** CI runs, **Then** the coverage job fails and blocks the PR merge.
3. **Given** a PR is submitted, **When** tests complete, **Then** a coverage report comment is posted automatically on the PR.
4. **Given** a CodeQL scan runs, **When** vulnerabilities are found, **Then** the scan job fails and the PR cannot be merged.

---

### User Story 2 — Developer checks test coverage and sees ≥ 90% across all modules (Priority: P1)

A developer runs the test suite locally or in CI and sees a coverage report showing at least 90% line, branch, and function coverage. All error boundary paths, React component snapshots, and chat-service branches are exercised by tests.

**Why this priority**: High coverage is the primary quality gate for this sprint; without it, the CI threshold enforcement in User Story 1 is meaningless.

**Independent Test**: Run `npm test` locally and verify the coverage summary shows ≥ 90% for all metrics. Introduce a deliberate uncovered branch and verify coverage drops below 90%.

**Acceptance Scenarios**:

1. **Given** the test suite runs, **When** coverage is calculated, **Then** line, branch, and function coverage are each ≥ 90%.
2. **Given** an error boundary is triggered in a React component, **When** the component renders with a thrown error, **Then** the error boundary catches it and the test asserts the fallback UI.
3. **Given** all branches in the chat service are tested, **When** each conditional path executes, **Then** every branch is covered and reported as such.
4. **Given** a React component changes its rendered output, **When** the snapshot test runs, **Then** the test fails and the developer must deliberately update the snapshot.

---

### User Story 3 — Security team reviews the repo and finds no critical or high vulnerabilities (Priority: P2)

A security reviewer opens the GitHub Security tab and the Dependabot alerts panel. No critical or high severity alerts appear. CodeQL reports no injection, unsafe regex, hardcoded secrets, or prototype pollution issues. All direct dependencies are pinned to specific versions.

**Why this priority**: Security posture must be clean before Feature 03 adds significant new surface area (graph queries, external API integrations).

**Independent Test**: Open the GitHub Security tab and Dependabot alerts for the repository. Verify zero critical/high alerts remain after all upgrades and fixes are applied.

**Acceptance Scenarios**:

1. **Given** Dependabot alerts are reviewed, **When** all critical and high packages are upgraded, **Then** no critical or high Dependabot alerts remain.
2. **Given** CodeQL scans the codebase, **When** the workflow runs, **Then** no injection vulnerabilities, unsafe regex patterns, hardcoded secrets, or prototype pollution issues are reported.
3. **Given** the daily Dependabot schedule runs, **When** a patch-level update is available, **Then** a PR is automatically opened and auto-merged if all CI checks pass.

---

### User Story 4 — Developer queries the graph and gets contextual results from conversation history and documents (Priority: P2)

A developer (or the application internally) sends a graph query via the API endpoint. The system returns nodes and relationships derived from the conversation context, RAG document chunks, and code entities. The UI displays a graph visualisation panel showing these relationships.

**Why this priority**: Graphify integration delivers cross-feature value (chat context, RAG re-ranking, code assistant) but depends on CI and security being stable first.

**Independent Test**: Send a GET request to the graph query endpoint with a sample query string. Verify the response contains nodes and edges. Open the UI graph panel and verify nodes render visually.

**Acceptance Scenarios**:

1. **Given** a conversation has taken place, **When** the graph endpoint is queried, **Then** the response contains nodes representing messages and edges representing their conversational relationships.
2. **Given** documents have been ingested via RAG, **When** a graph query is run over those documents, **Then** chunk nodes and their relationships appear in the results.
3. **Given** the RAG pipeline retrieves candidates, **When** graph relationships are used for re-ranking, **Then** chunks with stronger graph connectivity to the query context rank higher than isolated chunks.
4. **Given** a user is interacting with the app, **When** they open the graph visualisation panel, **Then** a visual representation of the current session's knowledge graph is displayed.

---

### User Story 5 — New contributor reads the README and can set up a local environment without asking for help (Priority: P3)

A first-time contributor clones the repository, reads the README, and follows the setup guide to get the application running locally with Ollama in under 15 minutes without external assistance.

**Why this priority**: Developer experience and project discoverability matter, but they do not block feature development and can be completed in parallel.

**Independent Test**: Have a developer unfamiliar with the project follow only the README setup guide and record whether they reach a working local instance within 15 minutes.

**Acceptance Scenarios**:

1. **Given** a contributor follows the local setup guide, **When** they complete all steps, **Then** the application runs locally with Ollama and all features are accessible.
2. **Given** a visitor opens the repository, **When** they view the README, **Then** they see CI, coverage, CodeQL, Node version, and license badges with accurate current statuses.
3. **Given** a contributor reads the feature table, **When** they look up any feature from F01 to F09, **Then** they can see the feature name, description, and current implementation status.

---

### Edge Cases

- When a dependency upgrade introduces a breaking API change, CI catches it: the build or test job fails before the PR can be merged.
- When a conversation is deleted, its graph nodes and edges are cascade-deleted (resolved — see FR-024a).
- How does the coverage threshold behave when new untested code is added — does it fail immediately or only after a grace period?
- What happens when the graph query returns zero nodes — does the UI show an empty state or an error?
- When the graph store is empty (first run), chat and RAG proceed normally; RAG skips graph re-ranking; the UI panel shows an empty-state message (resolved — see FR-021, FR-022).
- What happens when a CodeQL rule flags a false positive in a third-party library vendored in the repo?
- What happens when Dependabot auto-merge conflicts with a feature branch already in review?
- When Graphify's AST analysis fails on startup, the application starts with an empty graph and logs a warning; chat and RAG degrade gracefully per FR-021 (resolved — see FR-017b).

---

## Requirements *(mandatory)*

### Functional Requirements

#### Test Coverage

- **FR-001**: The test suite MUST enforce a minimum 90% threshold for line, branch, and function coverage; CI MUST fail if any metric falls below this threshold. Where achievable without artificial test inflation, the team SHOULD target 95% as an aspirational ceiling.
- **FR-002**: All error boundary paths in React components MUST have dedicated tests that assert the fallback UI renders correctly when an error is thrown.
- **FR-003**: Snapshot tests MUST exist for all primary React components; a snapshot mismatch MUST cause the test run to fail.
- **FR-004**: All conditional branches in the chat service MUST be covered by unit tests, including success paths, validation failures, provider errors, and context-window trim scenarios.
- **FR-004b**: The logger module (`src/modules/shared/logger.ts`) MUST be tested at every supported log level (debug, info, warn, error); the structured JSON output format MUST be asserted in each test case. Because the logger suppresses output when `NODE_ENV === 'test'`, tests MUST use `vi.spyOn(console, 'log')` (and `console.warn`/`console.error` as appropriate) to capture emitted strings without modifying `logger.ts` or the suppression guard.
- **FR-004c**: The LLM client (`src/modules/chat/llm-client.ts`) MUST have separate test cases for the Ollama local path and each cloud provider path (OpenAI, Anthropic); each path MUST be tested in isolation using mocks so neither requires a live API key.

#### CI / GitHub Actions

- **FR-005**: The CI pipeline MUST include separate jobs for lint, test (with coverage), build, and CodeQL analysis. The build job MUST run both `npm run build` and `tsc --noEmit` with zero TypeScript errors.
- **FR-006**: All CI jobs MUST run on a matrix of Node 18 and Node 20.
- **FR-007**: All GitHub Actions steps MUST use non-deprecated action versions.
- **FR-008**: A coverage report comment MUST be posted automatically on every pull request showing the current coverage percentages.
- **FR-009**: CodeQL MUST be configured as a required status check that blocks PR merges when vulnerabilities are detected.
- **FR-009b**: Branch protection rules on the main branch MUST require all CI jobs (lint, test on Node 18, test on Node 20, build, CodeQL) to pass before any pull request can be merged.

#### Dependabot & Dependency Security

- **FR-010**: A `.github/dependabot.yml` configuration MUST exist with a daily schedule for npm dependency updates and a weekly schedule for GitHub Actions dependency updates.
- **FR-011**: All critical and high severity Dependabot alerts MUST be resolved by upgrading the affected packages. A full `npm audit` report MUST be captured before any changes are made, and any use of `npm audit fix --force` MUST be reviewed for breaking changes before being committed.
- **FR-011b**: The full test suite MUST be run after all dependency upgrades complete and MUST pass with zero regressions before the changes are merged.
- **FR-012**: Auto-merge MUST be enabled for patch-level Dependabot PRs when all CI checks pass.
- **FR-013**: Direct `dependencies` in `package.json` MUST be pinned to exact versions (`1.2.3`, no `^` or `~`); direct `devDependencies` MUST use at most patch-range (`~1.2.3`); no open minor-range (`^x.y.z`) is permitted on any direct dependency.

#### CodeQL

- **FR-014**: A `codeql.yml` GitHub Actions workflow MUST exist and run on every push to the main branch and on every pull request.
- **FR-015**: All injection vulnerabilities, unsafe regex patterns, hardcoded secrets, and prototype pollution issues identified by CodeQL MUST be resolved.
- **FR-016**: *(See FR-009 — same requirement; retained as cross-reference.)* CodeQL MUST be added as a required status check in branch protection rules; satisfying FR-009 satisfies this requirement.

#### Graphify Integration

- **FR-017**: The Graphify library MUST be installed from the upstream repository and integrated into the project's dependency graph.
- **FR-017b**: After installation, Graphify MUST be invoked using its tree-sitter AST mode on the `src/` directory to extract TypeScript code entities (functions, classes, interfaces, imports, and their relationships) and persist an initial knowledge graph of the codebase structure to the graph store. This is a best-effort operation: if Graphify's AST analysis fails for any reason (parse error, permission issue, tree-sitter crash), the failure MUST be logged as a warning and the application MUST start normally with an empty graph; FR-021 graceful degradation applies.
- **FR-018**: The chat service MUST write conversation messages as nodes and relationships to the graph store after each exchange. If the graph write fails, the chat exchange MUST complete normally; the failure MUST be logged server-side but MUST NOT surface an error to the user (silent degradation).
- **FR-018b**: When processing a chat message, the chat service MUST query the Graphify knowledge graph for code entities relevant to the user's query and include the matched graph context (node labels, relationships, file locations) in the LLM system prompt. This enables the assistant to answer questions about the codebase structure ("why is X here", "what calls Y", "how does Z relate to W") using Graphify's extracted knowledge. If the graph query returns no results, the chat proceeds with standard context only (graceful degradation).
- **FR-019**: The RAG pipeline MUST represent ingested document chunks as graph nodes with edges encoding their relationships (sequential order, semantic similarity, shared topics).
- **FR-019b**: Since Graphify natively extracts code entities via tree-sitter AST, the graph service MUST expose a `queryCodeEntities(sessionId, query)` function that retrieves code entity nodes (functions, classes, interfaces, imports) from the Graphify-built graph for a given query. Feature 03 (Code Assistant) will use this function directly — no stub is needed; the function MUST be implemented and return an empty array when no matching entities exist.
- **FR-020**: A `GET /api/graph/query` endpoint MUST exist that accepts a query parameter and returns matching nodes and edges as JSON. The endpoint MUST require the same session authentication used by all other `/api/*` routes; unauthenticated requests MUST receive a 401 response.
- **FR-020b**: The existing `GET /api/health` endpoint MUST be updated to include graph store statistics in its response: total node count, total edge count, and the timestamp of the most recently created node.
- **FR-021**: The RAG retrieval step MUST use graph relationship scores to re-rank candidate chunks before returning them to the language model. When the graph store is empty, the RAG retrieval step MUST proceed using standard ranking without graph re-ranking (graceful degradation).
- **FR-022**: The UI MUST include a graph visualisation panel that renders the current session's knowledge graph as an interactive node-edge diagram. When no graph data exists, the panel MUST display an empty-state message rather than an error.
- **FR-023**: Per-user session memory MUST be stored as a personal knowledge graph, associating nodes with the originating user session.
- **FR-024a**: When a conversation is deleted, all graph nodes and edges associated with that conversation MUST be cascade-deleted from the graph store, consistent with the existing cascade-delete behaviour for messages.

#### README

- **FR-024**: The README MUST display live badges at the top for: CI status (GitHub Actions), test coverage (shields.io), CodeQL status, Node version, license, last-commit date, LinkedIn (linking to `https://www.linkedin.com/in/sri-sai-ajith-mandava-ba73a7183/`), and GitHub profile (linking to `https://github.com/ajithsai5`).
- **FR-025**: The README MUST contain a feature status table covering F01 through F09 with columns for feature name, description, and current status.
- **FR-026**: The README MUST embed an architecture diagram illustrating the system's module boundaries and data flow.
- **FR-027**: The README MUST include a dedicated Graphify section with at least three example graph queries and their expected outputs.
- **FR-028**: The README MUST contain a full technology stack table listing all major libraries and their roles.
- **FR-029**: The README MUST include both a local setup guide (with Ollama) and a cloud setup guide.
- **FR-030**: The README MUST include a test and CI section describing how to run tests locally and how CI is structured.
- **FR-031**: Each feature in the README MUST be accompanied by at least one screenshot or animated GIF demonstrating it in use.
- **FR-032**: The README MUST include a contributing guide and a license section.

### Key Entities

- **Coverage Report**: Aggregated per-file and per-metric (line, branch, function) coverage percentages produced by the test runner; consumed by CI threshold checks and the PR comment action.
- **Graph Node**: A discrete entity in the knowledge graph with a type label and key–value properties. Types: `MESSAGE` (conversation turn), `CHUNK` (RAG document chunk), `CODE_ENTITY` (function, class, interface, or import extracted by Graphify's tree-sitter AST parser from `src/`).
- **Code Entity**: A structural element of the TypeScript codebase extracted by Graphify's AST parser — function, class, interface, or import declaration. Stored as a `CODE_ENTITY` graph node with properties: `name`, `kind` (function/class/interface/import), `filePath`, `lineStart`, `lineEnd`.
- **Graph Edge**: A directed or undirected relationship between two graph nodes (e.g., "FOLLOWS", "REFERENCES", "PART_OF") with optional weight or metadata.
- **Dependabot Alert**: A GitHub-managed record of a vulnerable dependency including severity, affected version range, and recommended fix version.
- **CodeQL Finding**: A static analysis result with a rule ID, severity, affected file and line, and a remediation recommendation.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Test coverage is at or above 90% for line, branch, and function metrics on every commit merged to the main branch; the aspirational target is 95% where achievable without artificial test inflation.
- **SC-002**: All CI jobs (lint, test, build, CodeQL) complete successfully on both Node 18 and Node 20 for every pull request.
- **SC-003**: Zero critical or high Dependabot alerts remain open after the hardening sprint is complete.
- **SC-004**: CodeQL reports zero open findings in the categories of injection, unsafe regex, hardcoded secrets, and prototype pollution.
- **SC-005**: A graph query against the API endpoint returns a non-empty node-edge response within 2 seconds for a conversation of up to 50 messages.
- **SC-006**: The graph visualisation panel renders a session's knowledge graph within 3 seconds of the panel being opened.
- **SC-007**: A developer unfamiliar with the project can complete the local setup guide in the README and reach a running local instance within 15 minutes.
- **SC-008** *(post-sprint metric — not task-covered in 002.5)*: RAG retrieval quality improves measurably — at least 10% increase in answer relevance scores on a fixed evaluation set of 20–50 Q&A pairs — after graph-based re-ranking is enabled. The eval set MUST be defined and baselined before Feature 003 begins; measurement occurs after graph re-ranking is live in production.
- **SC-009**: Patch-level dependency updates are automatically merged within 24 hours of the Dependabot PR being opened, provided CI passes.

---

## Clarifications

### Session 2026-04-23 (round 2)

- Q: How should logger.ts tests assert JSON output given the `NODE_ENV === 'test'` suppression guard? → A: Use `vi.spyOn(console, 'log'/'warn'/'error')` to capture emitted strings; no changes to logger.ts or the suppression guard.
- Q: What does "run Graphify on the existing codebase" mean for FR-017b? → A: Use Graphify's tree-sitter TypeScript AST parser on `src/` to extract code entities (functions, classes, interfaces, imports, call relationships) as graph nodes. Graphify also supports chat context enrichment (FR-018b) and will serve as the foundation for the Feature 03 Code Assistant via `queryCodeEntities()` — no stub needed, full implementation in 002.5.
- Q: If Graphify's AST analysis fails at install time, should the app fail to start or degrade gracefully? → A: Best-effort — log a warning, start with an empty graph, rely on FR-021 graceful degradation. The MUST in FR-017b applies to the attempt, not the outcome.

### Session 2026-04-23

- Q: Should `GET /api/graph/query` require authentication? → A: Yes — same session authentication as all other `/api/*` routes; unauthenticated requests receive 401.
- Q: What happens when a graph write fails during a chat exchange? → A: Silent degradation — chat completes normally; failure is logged server-side and not surfaced to the user.
- Q: What happens to graph nodes when a conversation is deleted? → A: Cascade delete — graph nodes and edges for that conversation are deleted alongside it, consistent with existing message cascade-delete behaviour.
- Q: What happens when the graph store is empty on first run? → A: Graceful degradation — chat and RAG work normally without graph data; RAG skips re-ranking; UI panel shows an empty-state message.
- Q: Is there an explicit graph store size cap? → A: No cap for v1 — cascade-delete on conversation deletion is the natural size control; explicit pruning deferred to a later feature.

---

## Assumptions

- The Graphify library at `https://github.com/safishamsi/graphify` is publicly accessible and compatible with the project's Node.js version and TypeScript configuration.
- The existing SQLite database is sufficient to back the graph store for v1; a dedicated graph database is out of scope. No explicit node count cap is applied — graph size is naturally controlled by cascade-delete on conversation deletion. Explicit pruning strategies are deferred to a later feature.
- Auto-merge for Dependabot PRs applies only to patch-level updates; minor and major updates require manual review.
- The graph visualisation panel uses a client-side rendering library (e.g., a force-directed graph) without requiring a separate backend service.
- CodeQL required status checks will be enforced via GitHub repository branch protection settings, which the repository owner has permission to configure.
- The evaluation set for measuring RAG retrieval quality improvement (SC-008) is a fixed set of 20–50 question–answer pairs defined before the sprint begins.
- Screenshots and animated GIFs for the README are captured from the running local development instance; no dedicated staging environment is required.
- Feature 03 development will not begin on the main branch until all success criteria for this sprint are met.

---

## Phase 8 — Gap Closure Amendment (added 2026-04-25)

This amendment closes four gaps identified in post-implementation audit: the 95% aspirational
coverage target was never met, all 11 open Dependabot alerts remained unaddressed, the README
lacked the motivation/per-file/per-function/progression detail the user requested, and Graphify
itself was substituted with an in-house graph store rather than installed and used.

### Functional Requirements (Amendment)

- **FR-033 (Coverage 95%)**: Aggregate test coverage MUST reach ≥ 95% for statements, branches,
  functions, and lines on the merge to master, satisfying the SC-001 aspirational ceiling rather
  than only the FR-001 90% floor. Backfill targets (current → required): `graph-client.ts`
  (65.62% → 95%), `graph-service.ts` (88.88% → 95%), `app/api/chat/route.ts` (72.13% → 95%),
  `GraphPanel.tsx` (71.01% → 95%), `ChatPanel.tsx` (78.09% → 95%), `MessageList.tsx`
  (81.81% → 95%), `MessageInput.tsx` branches (78.57% → 95%).
- **FR-034 (Dependabot zero-open)**: All 11 open Dependabot alerts MUST be closed before merge.
  Severity-prioritised: HIGH (next < 15.5.15, drizzle-orm < 0.45.2, glob < 10.5.0) →
  MEDIUM (uuid < 14, jsondiffpatch < 0.7.2, esbuild ≤ 0.24.2, next < 15.5.10/15.5.13/15.5.14) →
  LOW (ai < 5.0.52). Each MUST either be patched (direct dep bump or npm `overrides` for
  transitive) or formally dismissed with a written rationale.
- **FR-035 (ai SDK lock)**: The `ai`/`@ai-sdk/openai`/`@ai-sdk/anthropic` major version MUST stay
  on v4.x for this sprint. Bumping to ai 5.x breaks LanguageModelV1 → V3. Alert #3 (low severity)
  MUST be dismissed with rationale "deferred to F03 — major-bump migration tracked separately."
- **FR-036 (Graphify actually installed)**: Graphify MUST be installed locally as a development
  tool (`pipx install graphifyy` — Python CLI) and run against `src/` to produce
  `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md`, both committed.
- **FR-037 (Graphify Claude Code integration)**: The `graphify claude install` command MUST be
  run so `.claude/settings.local.json` gets the PreToolUse hook and `CLAUDE.md` gets the
  directive section that tells Claude to consult `graphify-out/GRAPH_REPORT.md` before Glob/Grep.
- **FR-038 (Graphify chat retrieval enrichment)**: The chat service MUST read
  `graphify-out/graph.json` at startup (best-effort) and use it to enrich the system prompt with
  file/function context — alongside (not replacing) the existing in-house `queryCodeEntities()`.
  Graceful degradation when `graph.json` is absent or unparseable.
- **FR-039 (Expanded README)**: README MUST add four sections: "Why this project exists",
  per-file index for `src/`, per-function API for every module, and "Progression from scratch"
  changelog (F00 → F01 → F01.5 → F02 → F02.5).
- **FR-040 (Verification gate)**: One CI run on this branch must show: coverage ≥ 95%, zero
  open Dependabot alerts, `graphify-out/graph.json` exists, README sections present, and all
  four CI jobs plus CodeQL green.

### Success Criteria (Amendment)

- **SC-010**: Aggregate coverage on the merge commit is ≥ 95% across all four metrics.
- **SC-011**: Open Dependabot alerts = 0 (closed or dismissed-with-rationale).
- **SC-012**: `graphify-out/graph.json` exists and PreToolUse hook is wired in `.claude/settings.local.json`.
- **SC-013**: README contains the four new sections with non-stub content.
