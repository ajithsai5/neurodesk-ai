# Research: UI Redesign — Claude Design System

**Phase**: 0 — Technology Decisions  
**Feature**: 003.5-ui-redesign-claude-design  
**Date**: 2026-05-03

---

## Decision 1: Component Primitive Strategy

**Decision**: Use Shadcn UI scaffolding with Radix UI primitives, styled entirely via project design tokens.

**Rationale**: FR-008 (keyboard operability), FR-009 (ARIA labels), and SC-005 (100% keyboard coverage) each require correct focus management, ARIA roles, and keyboard event handling on every interactive element. Building these from scratch per component is high-risk and high-effort. Radix primitives provide battle-tested accessible behaviour out of the box — focus trapping in dialogs, roving tabindex in menus, ARIA state sync — without shipping any default visual styles. `shadcn/ui` is not an installed package; it is a CLI scaffolder that copies component source files into `src/components/ui/`, meaning the project owns the code and can modify it freely.

**New packages added** (each justified):

| Package | Justification |
|---------|--------------|
| `@radix-ui/react-*` (per component) | Accessible headless primitives — keyboard, ARIA, focus management |
| `class-variance-authority` | Type-safe component variant definitions without conditional string concatenation |
| `clsx` | Conditional class merging utility |
| `tailwind-merge` | Prevents conflicting Tailwind classes from overriding each other |
| `lucide-react` | Consistent, minimal icon set matching Claude's aesthetic; tree-shakeable |
| `next-themes` | SSR-safe dark mode provider; prevents flash of unstyled content (FOUC) on load |

**Alternatives considered**:
- Custom from scratch: Rejected — would require 200+ lines of ARIA and focus management per interactive component; high maintenance surface.
- MUI / Chakra: Rejected — both ship opinionated visual styles that conflict with custom design tokens; theming requires overriding their system, not building from it.
- Headless UI (@headlessui/react): Evaluated — Radix preferred because it has more granular component primitives (Select, Dropdown, Tooltip, etc.) and TypeScript types are better maintained.

---

## Decision 2: Dark Mode Implementation

**Decision**: `next-themes` with `class` strategy. CSS custom properties defined in `:root` (light) and `.dark` (dark) in `globals.css`. Tailwind configured with `darkMode: 'class'`.

**Rationale**: The `class` strategy (adding/removing `dark` on `<html>`) works correctly with Next.js App Router's server-rendered HTML. `next-themes` handles: reading the saved preference before hydration (preventing FOUC), syncing with the OS preference on first visit, and exposing a `useTheme()` hook for the toggle button. Alternative `media` strategy was rejected because FR-003 requires the user's explicit saved preference to override the system setting — `next-themes` with `class` supports this correctly.

**Alternatives considered**:
- Manual `localStorage` read in `<script>` blocking tag: Works but requires custom implementation. `next-themes` is the canonical solution for this in Next.js; its 2 kB size is justified.
- CSS-only `prefers-color-scheme` media query: Rejected — cannot persist user preference override (FR-003).

---

## Decision 3: Design Token Architecture

**Decision**: CSS custom properties (CSS variables) as the single source of truth. Tailwind references tokens via `hsl(var(--token))` syntax. No raw colour hex values in component files.

**Rationale**: CSS variables are the only approach that enables live dark mode switching without a page reload. When `.dark` class is added to `<html>`, every CSS variable is redefined at that scope — all components update simultaneously via cascade. Tailwind's JIT compiler generates utility classes that reference these variables, so components continue using standard Tailwind class names (`bg-background`, `text-foreground`, `border-border`) which resolve to the correct value in both modes.

**Token naming convention** (Shadcn standard — aligns with existing Shadcn ecosystem):

```
--background        Page background
--foreground        Primary text
--card              Surface/card background
--card-foreground   Text on cards
--muted             Subdued surface
--muted-foreground  Subdued text
--border            Default border
--input             Input border
--primary           Brand accent (amber/orange)
--primary-foreground Text on primary
--secondary         Secondary surface
--secondary-foreground Text on secondary
--accent            Hover/highlight accent
--accent-foreground Text on accent
--destructive       Error/danger colour
--destructive-foreground Text on destructive
--ring              Focus ring colour
--radius            Base border radius (used for `rounded-*` scale)
```

**Claude-inspired palette anchors**:

| Token | Light value (HSL) | Dark value (HSL) |
|-------|-------------------|-----------------|
| `--background` | `40 33% 98%` | `40 10% 8%` |
| `--foreground` | `40 10% 8%` | `40 15% 93%` |
| `--card` | `0 0% 100%` | `40 8% 12%` |
| `--muted` | `40 20% 94%` | `40 8% 16%` |
| `--muted-foreground` | `40 5% 44%` | `40 5% 58%` |
| `--border` | `40 20% 87%` | `40 8% 20%` |
| `--primary` | `24 90% 53%` | `24 90% 60%` |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--destructive` | `0 84% 60%` | `0 84% 65%` |
| `--ring` | `24 90% 53%` | `24 90% 60%` |
| `--radius` | `0.5rem` | (same) |

**Alternatives considered**:
- Tailwind semantic tokens only (no CSS variables): Rejected — cannot switch at runtime without page reload.
- SCSS variables: Rejected — adds a build dependency not present in the project; CSS variables are native.

---

## Decision 4: Logo Design

**Decision**: SVG wordmark — product icon (abstract neural/node mark) + "NeuroDesk AI" text. Two variants: `logo-light.svg` (dark ink on transparent), `logo-dark.svg` (light ink on transparent). Rasterised to PNG at 16px, 32px, 512px for favicons and app icon.

**Rationale**: SVG is resolution-independent (FR-013 requirement). Two colour variants satisfy FR-001 (works on both light and dark backgrounds). The wordmark is simpler to produce and maintain than a full logomark system.

**Implementation**: Created directly as SVG source files in `public/`. The `<NeuroLogo>` component conditionally renders the correct variant based on `useTheme()`.

---

## Decision 5: Graph Panel Rendering

**Decision**: Retain `react-force-graph-2d` (already installed) for node/edge rendering. Redesign only the container chrome — panel wrapper, loading overlay, empty state, error state, filter/zoom controls, node colour scheme.

**Rationale**: `react-force-graph-2d` already handles zoom, pan, and force simulation. The clarification (Q2) confirmed the GraphPanel exists and only needs a visual reskin. Replacing the renderer would risk regressions in graph query behaviour with no user-facing benefit.

**Changes scoped to**:
- Panel container padding, background, and border
- Node `nodeAutoColorBy` colour mapping to use design token colours
- Link label styling
- Overlay components (loading spinner, empty state, error state, filter sidebar)

---

## Decision 6: Animation Strategy

**Decision**: CSS transitions via Tailwind `transition-*` utilities only. No JS animation library.

**Rationale**: FR-012 requires 300ms completion and `prefers-reduced-motion` suppression. Both are achievable with native CSS:
- `transition-all duration-200 ease-in-out` for panel switching and component state changes
- `@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }` in `globals.css`

Adding `framer-motion` (~150 kB) is unjustified per Constitution Principle V (YAGNI). CSS transitions handle all required animations within the spec's constraints.

---

## Decision 7: Sidebar Architecture Restructure

**Decision**: Replace the current single `Sidebar` component (conversation list only) with a two-part shell:
- `NavSidebar` — vertical navigation bar with 5 panel icons + labels (Chat, Document Q&A, Code Assistant, Graph Visualisation, Settings)
- `ConversationSidebar` — the existing conversation list + document library, shown only when Chat panel is active

**Rationale**: The current `page.tsx` has a flat tab bar with only Chat and Code Assistant. The spec (FR-011) requires sidebar navigation with 5 items. Separating navigation from conversation management avoids mixing concerns and matches the clarified structure (Q4).
