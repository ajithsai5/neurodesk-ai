# Implementation Plan: UI Redesign — Claude Design System

**Branch**: `003.5-ui-redesign-claude-design` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003.5-ui-redesign-claude-design/spec.md`

---

## Summary

Full visual overhaul of the NeuroDesk AI platform to align with Claude's design language — neutral-warm palette (grey base + amber/orange accent), minimal typography, consistent design tokens across all panels. The redesign introduces: a new shell with a 5-item navigation sidebar and branded top bar; Shadcn + Radix accessible primitives replacing raw HTML elements; CSS-variable design tokens with a live dark mode toggle; skeleton/empty/error states for every async operation; and a reskinned Graph Visualisation panel. No backend changes. No new API routes. Every existing feature continues to work identically — only the visual layer changes.

---

## Technical Context

**Language/Version**: TypeScript 5.7 (strict mode) | Node.js 20+  
**Primary New Dependencies**:

| Package | Purpose | Justification |
|---------|---------|--------------|
| `next-themes` | SSR-safe dark mode provider | Prevents FOUC; handles localStorage persistence (FR-003) |
| `@radix-ui/react-*` (7 packages) | Accessible headless UI primitives | FR-008/009/SC-005 — keyboard nav, ARIA, focus mgmt |
| `class-variance-authority` | Component variant definitions | Type-safe variant management without conditional strings |
| `clsx` + `tailwind-merge` | Conditional class merging | Prevents Tailwind class conflicts in dynamic components |
| `lucide-react` | Icon library | Consistent minimal icon set; tree-shakeable |
| `tailwindcss-animate` | CSS animation utilities | Required by Shadcn; enables `animate-*` classes |

**No new packages**: No framer-motion, no new database packages, no new API SDK packages.  
**Storage**: No schema changes. No new API routes.  
**Testing**: Vitest (unit + snapshot) | Playwright (E2E) | coverage threshold ≥ 95% maintained  
**Target Platform**: Windows 11, local Next.js dev server, Node.js 20+  
**Project Type**: Next.js 14 App Router full-stack web application  
**Performance Goals**: Loading indicator visible ≤ 100 ms from user action (SC-003); transitions ≤ 300 ms (SC-008)  
**Constraints**: TypeScript strict throughout; zero hardcoded colour hex/rgb in component files; all colours via design tokens; no new monorepo structure  
**Scale/Scope**: Single-user local tool; 4 feature panels + settings; full dark/light mode support

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Modular Architecture | ✅ PASS | New shell components in `src/components/shell/`; UI primitives in `src/components/ui/`; no new backend modules; no circular imports introduced |
| II. Test-First | ✅ PASS | Snapshot tests written before implementation for every new component; existing integration/unit tests unchanged |
| III. Security-First | ✅ PASS | No new API routes; no new user input; no new data storage; SVG assets are static files, not user-provided |
| IV. API-First | ✅ PASS | N/A — purely presentational feature; all APIs already exist |
| V. Simplicity & YAGNI | ⚠️ JUSTIFIED | 6 new packages added (see Complexity Tracking); each justified by a specific FR/SC requirement. No framer-motion, no component library with opinion, no plugin system |
| VI. Observability | ✅ PASS | No new backend logic; frontend errors continue to surface via existing ErrorBoundary; no new logging surface needed |
| VII. Incremental Delivery | ✅ PASS | 7 tracks, each independently deployable; Track A (foundation) can be merged alone; each panel track can be merged independently |

**Verdict**: All gates pass. One justified complexity entry (see below).

---

## Project Structure

### Documentation (this feature)

```text
specs/003.5-ui-redesign-claude-design/
├── plan.md              ← this file
├── research.md          ← Phase 0: technology decisions
├── data-model.md        ← Phase 1: design token schema + component types
├── quickstart.md        ← Phase 1: local dev setup guide
├── contracts/
│   └── component-contracts.md  ← Phase 1: component prop interfaces
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code Changes

```text
# New packages (runtime)
package.json             MODIFY — add 6 new dependencies (see Technical Context)

# Design foundation
src/app/globals.css      MODIFY — replace :root block with full CSS variable token set;
                                  add .dark block; add reduced-motion media query
tailwind.config.ts       MODIFY — darkMode: ['class']; extend colors/borderRadius from tokens
src/lib/utils.ts         NEW    — cn() utility (clsx + tailwind-merge)

# Shadcn-scaffolded primitives (npx shadcn@latest add ...)
src/components/ui/
├── button.tsx           NEW    — variant-aware button with focus ring + all CVA variants
├── badge.tsx            NEW    — status badge (default/secondary/destructive/outline)
├── skeleton.tsx         NEW    — pulsing loading placeholder
├── tooltip.tsx          NEW    — accessible hover tooltip (Radix)
├── scroll-area.tsx      NEW    — custom-styled scrollbar wrapper
├── separator.tsx        NEW    — horizontal/vertical divider
├── sheet.tsx            NEW    — slide-in drawer (mobile nav sidebar)
├── dropdown-menu.tsx    NEW    — accessible dropdown (conversation actions, model switcher)
└── select.tsx           NEW    — accessible select (persona selector, language picker)

# Logo assets
public/logo-light.svg    NEW    — SVG wordmark, dark ink (for light bg)
public/logo-dark.svg     NEW    — SVG wordmark, light ink (for dark bg)
public/favicon-16.png    NEW    — rasterised icon 16px
public/favicon-32.png    NEW    — rasterised icon 32px
public/icon-512.png      NEW    — rasterised icon 512px

# Logo component
src/components/logo/
└── NeuroLogo.tsx        NEW    — renders correct SVG variant based on useTheme()

# Shell components
src/components/shell/
├── AppShell.tsx         NEW    — top-level layout: TopBar + NavSidebar + content slot
├── TopBar.tsx           NEW    — logo left, theme toggle right, mobile menu hamburger
└── NavSidebar.tsx       NEW    — 5-item vertical nav (desktop fixed + mobile Sheet)

# App layout
src/app/layout.tsx       MODIFY — wrap children in ThemeProvider; add suppressHydrationWarning to <html>
src/app/page.tsx         REWRITE — use AppShell; PanelId state; render 5 panels

# Chat panel (visual only — no logic changes)
src/components/chat/
├── ChatPanel.tsx        MODIFY — token colours; branded empty state; token-based error banner
├── MessageInput.tsx     MODIFY — token colours; Radix-backed textarea styling
├── MessageList.tsx      MODIFY — token colours; skeleton rows during load
└── StreamingMessage.tsx MODIFY — streaming cursor colour via text-primary token

src/components/
├── PersonaSelector.tsx  MODIFY — replace <select> with Radix Select; token colours
└── ModelSwitcher.tsx    MODIFY — replace dropdown with Radix DropdownMenu; token colours

# Document Q&A panel (visual only)
src/components/
├── DocumentQAPanel.tsx  NEW    — composite panel (wraps upload + library + citation)
├── CitationPanel.tsx    MODIFY — token colours; citation cards with shadow-sm
├── DocumentUpload.tsx   MODIFY — styled drop-zone; token border/bg; skeleton on upload
├── DocumentLibrary.tsx  MODIFY — token colours; skeleton rows during fetch; empty state card
└── DocumentStatus.tsx   MODIFY — replace raw coloured spans with <Badge> variants

# Code Assistant panel (visual only)
src/components/
└── CodeAssistant.tsx    MODIFY — token colours; mode toggle uses bg-muted tab bar;
                                  code output bg-card; empty state when no output

# Graph panel (visual only — react-force-graph-2d retained)
src/components/
└── GraphPanel.tsx       MODIFY — container bg-card border-border; Skeleton loading overlay;
                                  branded empty state; token error card; filter controls UI

# Settings panel (new placeholder)
src/components/
└── SettingsPanel.tsx    NEW    — read-only provider + persona display; no mutations in v1

# Tests
__tests__/components/
├── shell/
│   ├── AppShell.test.tsx      NEW — renders correct panel based on activePanel prop
│   ├── TopBar.test.tsx        NEW — renders logo; dark mode toggle present
│   └── NavSidebar.test.tsx    NEW — renders 5 nav items; active item highlighted
├── logo/
│   └── NeuroLogo.test.tsx     NEW — renders light/dark variants correctly
├── chat/
│   └── ChatPanel.test.tsx     EXTEND — empty state snapshot; error banner uses token classes
├── DocumentLibrary.test.tsx   EXTEND — skeleton state snapshot; empty state snapshot
└── GraphPanel.test.tsx        EXTEND — loading state snapshot; empty state snapshot; error state snapshot

# README
README.md                MODIFY — logo at top; screenshots section; demo GIF
```

**Structure Decision**: Single Next.js project (unchanged). New `src/components/shell/` and `src/components/logo/` follow the established component directory pattern. `src/components/ui/` is the Shadcn convention. No new modules in `src/modules/` — this feature is entirely presentational.

---

## Implementation Tracks

### Track A — Foundation: Tokens + Shadcn + ThemeProvider (blocks all other tracks)

**Goal**: Install dependencies, apply design tokens, scaffold Shadcn primitives, wire ThemeProvider. After this track, the app compiles and runs — it will look broken visually but the token infrastructure is in place.

1. Install runtime packages:
   ```bash
   npm install next-themes lucide-react class-variance-authority clsx tailwind-merge tailwindcss-animate
   npm install @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-separator \
     @radix-ui/react-sheet @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-slot
   ```
2. Run `npx shadcn@latest init` (Default style, CSS variables: Yes). Then scaffold: `button badge skeleton tooltip scroll-area separator sheet dropdown-menu select`.
3. Create `src/lib/utils.ts`:
   ```ts
   import { clsx, type ClassValue } from 'clsx';
   import { twMerge } from 'tailwind-merge';
   export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
   ```
4. Replace `tailwind.config.ts` with the configuration from `data-model.md` section 2.
5. Replace the `:root` block in `src/app/globals.css` with the full token set from `data-model.md` section 1. Append the reduced-motion media query block.
6. In `src/app/layout.tsx`: import `ThemeProvider` from `next-themes`; wrap `{children}` with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`; add `suppressHydrationWarning` to `<html>`.
7. Tests: verify `npm run build` passes with zero TS errors. Run `npm test` — all pre-existing tests must pass.

**Key files**: `package.json`, `tailwind.config.ts`, `src/app/globals.css`, `src/lib/utils.ts`, `src/app/layout.tsx`

---

### Track B — Logo & Shell (depends on A)

**Goal**: Branded top bar, 5-item nav sidebar, responsive shell layout. After this track the app has the new navigation but panels still use old visual styles.

1. Create `public/logo-light.svg` and `public/logo-dark.svg` — SVG wordmark "NeuroDesk AI" with a small abstract node/network icon mark left of the text. Ink colour: `#1A1812` (light variant), `#F0EDE8` (dark variant), transparent background.
2. Rasterise to `public/favicon-16.png`, `public/favicon-32.png`, `public/icon-512.png`.
3. Update `src/app/layout.tsx` `metadata` to include `icons` pointing to the favicon files.
4. Create `src/components/logo/NeuroLogo.tsx` — reads `useTheme()`, renders `<img src="/logo-light.svg" />` or `<img src="/logo-dark.svg" />` based on resolved theme. Three size variants via className.
5. Create `src/components/shell/TopBar.tsx`:
   - Left: hamburger `<Sheet>` trigger (mobile only, hidden on `md:` breakpoint) + `<NeuroLogo size="md" />`.
   - Right: dark mode toggle button (Sun/Moon Lucide icons, `aria-label="Toggle theme"`).
   - Style: `h-14 border-b border-border bg-background px-4 flex items-center justify-between`.
6. Create `src/components/shell/NavSidebar.tsx`:
   - Desktop: `w-56 border-r border-border bg-sidebar` fixed sidebar with 5 nav items.
   - Each item: icon + label, `aria-current="page"` on active, `focus-visible:ring` focus style.
   - Active state: `bg-primary/10 text-primary font-medium` (amber tint + amber text).
   - Hover state: `hover:bg-accent hover:text-accent-foreground`.
   - Mobile: wrapped in `<Sheet>` (slide-in drawer), same items.
   - Conversation sub-list (Chat panel only): below the Chat nav item, render `<ConversationSidebar>` (extracted from old `Sidebar.tsx`).
7. Create `src/components/shell/AppShell.tsx` — `<div className="h-screen flex flex-col">` → TopBar → `<div className="flex flex-1 min-h-0">` → NavSidebar → `<main className="flex-1 min-h-0 overflow-hidden">{children}</main>`.
8. Rewrite `src/app/page.tsx`: use `AppShell`; `PanelId` state; render `<ChatPanel>` / `<DocumentQAPanel>` / `<CodeAssistant>` / `<GraphPanel>` / `<SettingsPanel>` based on `activePanel`.
9. Tests: `AppShell.test.tsx`, `TopBar.test.tsx`, `NavSidebar.test.tsx`, `NeuroLogo.test.tsx` — snapshot tests for each.

**Key files**: `public/logo-*.svg`, `src/components/logo/NeuroLogo.tsx`, `src/components/shell/`, `src/app/page.tsx`, `src/app/layout.tsx`

---

### Track C1 — Chat Panel Redesign (depends on B, parallel with C2/C3/C4)

**Goal**: Apply design tokens throughout the chat experience; replace raw dropdowns with Radix primitives; add skeleton loading and branded empty state.

1. `ChatPanel.tsx`: Replace hardcoded Tailwind colours with token classes (`bg-background`, `border-border`, `bg-card`, `text-muted-foreground`). Replace error banner classes with `bg-destructive/10 text-destructive border-destructive/20`. Branded empty state: centred `<MessageSquare className="text-primary" />` icon + "Select or start a conversation" heading + "New Conversation" `<Button variant="default">`.
2. `MessageList.tsx`: Replace loading spinner with 3× `<Skeleton className="h-12 w-full rounded-lg" />` rows during initial load. Message bubble: assistant messages `bg-card border border-border rounded-lg shadow-sm`; user messages `bg-primary/10 text-foreground rounded-lg`.
3. `MessageInput.tsx`: Textarea uses `bg-background border-border focus-visible:ring-ring`; Send button uses `<Button size="icon">`.
4. `StreamingMessage.tsx`: Streaming cursor colour `text-primary`.
5. `PersonaSelector.tsx`: Replace `<select>` with Radix `<Select>` from `src/components/ui/select.tsx`. Same props interface.
6. `ModelSwitcher.tsx`: Replace custom dropdown with Radix `<DropdownMenu>`. Same props interface.
7. Tests: extend `ChatPanel.test.tsx` — empty state snapshot; loading skeleton snapshot; error banner class assertion.

**Key files**: `src/components/chat/*.tsx`, `src/components/PersonaSelector.tsx`, `src/components/ModelSwitcher.tsx`

---

### Track C2 — Document Q&A Panel Redesign (depends on B, parallel with C1/C3/C4)

**Goal**: Consistent design tokens across upload zone, document library, and citation cards; new composite panel component; skeleton states.

1. Create `src/components/DocumentQAPanel.tsx` — renders `<DocumentUpload>` + `<DocumentLibrary>` in a left column, `<CitationPanel>` in a right column (or stacked on narrow viewports).
2. `DocumentUpload.tsx`: Drop-zone idle: `border-2 border-dashed border-border bg-muted rounded-lg`; drag-over: `border-primary bg-primary/5`; uploading: replace zone content with `<Skeleton>`.
3. `DocumentLibrary.tsx`: Each row `bg-card border border-border rounded-md`. Loading state: 4× `<Skeleton className="h-10 w-full" />`. Empty state: `<FileText className="text-muted-foreground" />` icon + "No documents yet — upload a PDF to get started" + `<Button variant="outline">Upload Document</Button>` CTA.
4. `DocumentStatus.tsx`: Replace coloured `<span>` tags with `<Badge variant="...">` — `processing` → default; `ready` → success (custom badge variant); `error` → destructive.
5. `CitationPanel.tsx`: Citation cards `bg-card border border-border rounded-lg p-3 shadow-sm`. Source highlight uses `bg-primary/15 rounded px-0.5`. Empty state: "Ask a question to see citations here".
6. Tests: `DocumentLibrary.test.tsx` extend — skeleton state; empty state snapshot. `CitationPanel.test.tsx` extend — empty state snapshot.

**Key files**: `src/components/DocumentQAPanel.tsx`, `src/components/DocumentUpload.tsx`, `src/components/DocumentLibrary.tsx`, `src/components/DocumentStatus.tsx`, `src/components/CitationPanel.tsx`

---

### Track C3 — Code Assistant Panel Redesign (depends on B, parallel with C1/C2/C4)

**Goal**: Token colours throughout; mode toggle uses muted tab bar; empty state when no output.

1. `CodeAssistant.tsx`:
   - Outer container: `bg-background`.
   - Mode toggle: `bg-muted rounded-lg p-1` wrapper; active tab `bg-background shadow-sm rounded-md text-foreground`; inactive tab `text-muted-foreground hover:text-foreground`.
   - Textarea: `bg-background border-border focus-visible:ring-ring`.
   - Language `<Select>`: use Radix Select from `src/components/ui/select.tsx`.
   - Output area: `bg-card border border-border rounded-lg` — retain `rehype-highlight`; map highlight theme to match design tokens (set `className="prose dark:prose-invert max-w-none"` wrapper).
   - Empty output state: centered `<Code2 className="text-muted-foreground" />` + "Generated code will appear here".
   - Loading state: `<Skeleton className="h-48 w-full rounded-lg" />` while waiting for LLM.
   - Error state: `bg-destructive/10 text-destructive rounded-lg p-3` with retry link.
2. Tests: `CodeAssistant.test.tsx` extend — empty output snapshot; loading skeleton snapshot.

**Key files**: `src/components/CodeAssistant.tsx`

---

### Track C4 — Graph Panel Redesign (depends on B, parallel with C1/C2/C3)

**Goal**: Reskin container and overlay components; add filter controls sidebar; retain `react-force-graph-2d`.

1. `GraphPanel.tsx`:
   - Outer container: `bg-card rounded-lg border border-border overflow-hidden relative`.
   - `<ForceGraph2D>`: add `backgroundColor="transparent"` prop; update node colour callback to use CSS variable palette colours (amber/primary for entity nodes, muted for chunk nodes).
   - Loading overlay (replaces the inline text): absolute-positioned `<div>` with `<Skeleton>` blocks filling the graph area.
   - Empty state (no data): centered card — `<Network className="h-12 w-12 text-muted-foreground" />` + "No graph data yet" heading + "Start a conversation to build the knowledge graph" subtext.
   - Error state: replaces old inline red div — `bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4` with icon + message + retry `<Button variant="outline" size="sm">`.
   - Filter controls: small `absolute top-3 right-3` panel — text input (`<Input>`) for node label search; type filter checkboxes; zoom in/out `<Button size="icon">` pair. Filter state is component-local.
2. Tests: `GraphPanel.test.tsx` extend — loading skeleton snapshot; empty state snapshot; error state snapshot.

**Key files**: `src/components/GraphPanel.tsx`

---

### Track D — Settings Panel (depends on B, parallel with C tracks)

**Goal**: Stub settings panel for the 5th nav item. Read-only in v1.

1. Create `src/components/SettingsPanel.tsx`:
   - Reads `GET /api/providers` and `GET /api/personas` (both existing routes).
   - Displays provider configs in a `bg-card border border-border rounded-lg` table.
   - Displays persona list similarly.
   - No mutation UI in this version.
   - Loading states via `<Skeleton>` rows; error states via error card.
2. Tests: `SettingsPanel.test.tsx` — loading snapshot; populated snapshot (mocked API).

**Key files**: `src/components/SettingsPanel.tsx`

---

### Track E — README (depends on all C/D tracks; done last)

**Goal**: Branded README with logo, screenshots, and demo GIF.

1. Add logo at the top of `README.md`: `![NeuroDesk AI](public/logo-light.svg)`.
2. Add "UI" section with screenshots:
   - One screenshot per panel (Chat, Document Q&A, Code Assistant, Graph, Shell overview) in light mode.
   - One dark mode composite screenshot.
3. Record demo GIF (OBS or ShareX): show new conversation → chat message → switch to Document Q&A → upload document → switch to Graph panel → toggle dark mode. Target ≤ 30 seconds at 1280×800.
4. Update feature status table row for F003.5 from "Planned" to "Complete" after merge.

**Key file**: `README.md`

---

## Delivery Order & Dependencies

```
Track A (foundation — tokens + Shadcn + ThemeProvider)
       │
       └──→ Track B (logo + shell layout)
                  │
                  ├──→ Track C1 (chat panel redesign)     ─┐
                  ├──→ Track C2 (document Q&A redesign)   ─┤
                  ├──→ Track C3 (code assistant redesign)  ─┤─→ Track E (README — done last)
                  ├──→ Track C4 (graph panel redesign)    ─┘
                  └──→ Track D  (settings panel stub)    ─┘
```

Tracks C1–C4 and D are fully parallel after Track B lands. Track E waits for all C/D tracks and requires a running dev server for screenshots.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|-----------|--------------------------------------|
| 6 new npm packages | FR-008/FR-009/SC-005 require accessible keyboard nav + ARIA on all interactive elements; FR-003 requires SSR-safe dark mode persistence | Custom ARIA + focus management per component = 200+ lines per component with high maintenance risk; manual FOUC prevention = brittle `<script>` block that conflicts with Next.js hydration |
