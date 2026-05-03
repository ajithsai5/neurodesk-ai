# Component Contracts: UI Redesign — Claude Design System

**Phase**: 1 — Design  
**Feature**: 003.5-ui-redesign-claude-design  
**Date**: 2026-05-03

These are the TypeScript props interfaces for all new and significantly modified components. Existing internal implementation details (state, callbacks) are unchanged unless explicitly noted.

---

## Shell Components (`src/components/shell/`)

### `AppShell` — `src/components/shell/AppShell.tsx`

Top-level layout wrapper. Composes `TopBar` + `NavSidebar` + content area.

```ts
interface AppShellProps {
  activePanel: PanelId;
  onPanelChange: (panel: PanelId) => void;
  children: React.ReactNode;
  /** Mobile sidebar open state — lifted to page.tsx */
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
}

type PanelId = 'chat' | 'documents' | 'code' | 'graph' | 'settings';
```

---

### `TopBar` — `src/components/shell/TopBar.tsx`

Fixed top bar containing the logo (left) and global controls (right: dark mode toggle, optional settings shortcut).

```ts
interface TopBarProps {
  /** Opens mobile nav sidebar */
  onMenuToggle: () => void;
}
// Internally reads useTheme() for dark mode toggle — no prop needed.
```

---

### `NavSidebar` — `src/components/shell/NavSidebar.tsx`

Vertical navigation list with 5 items. On desktop: always visible, fixed width. On mobile: slide-in drawer.

```ts
interface NavSidebarProps {
  activePanel: PanelId;
  onPanelChange: (panel: PanelId) => void;
  /** Mobile: controlled open state */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  id: PanelId;
  label: string;
  icon: React.ReactNode;   // Lucide icon component
  ariaLabel: string;
}

// Fixed nav items (not data-driven; defined as a constant in the file):
// { id: 'chat',      label: 'Chat',           icon: <MessageSquare /> }
// { id: 'documents', label: 'Document Q&A',   icon: <FileText /> }
// { id: 'code',      label: 'Code Assistant', icon: <Code2 /> }
// { id: 'graph',     label: 'Graph',          icon: <Network /> }
// { id: 'settings',  label: 'Settings',       icon: <Settings /> }
```

---

### `NeuroLogo` — `src/components/logo/NeuroLogo.tsx`

Renders the correct SVG variant based on active theme.

```ts
interface NeuroLogoProps {
  /** 'sm' = 24px height, 'md' = 32px (default), 'lg' = 48px */
  size?: 'sm' | 'md' | 'lg';
  /** Override theme detection — used in Storybook / tests */
  variant?: 'light' | 'dark';
  className?: string;
}
```

---

## Chat Panel Components (`src/components/chat/`)

All existing props interfaces are **preserved**. Only visual implementation changes.

### `ChatPanel` — `src/components/chat/ChatPanel.tsx`

No props changes. Visual changes:
- Welcome state: full-panel branded empty state with "Start a conversation" CTA.
- Toolbar: uses design token colours, `border-border`, `bg-card`.
- Error banner: uses `bg-destructive/10 text-destructive border-destructive/20` instead of hardcoded red.

### `MessageInput` — `src/components/chat/MessageInput.tsx`

No props changes. Visual: `bg-background border-border`, focus ring via `ring-ring`.

### `StreamingMessage` — `src/components/chat/StreamingMessage.tsx`

No props changes. Visual: `streaming-cursor` animation retained; cursor colour via `text-primary`.

---

## Document Q&A Components (`src/components/`)

### `DocumentQAPanel` — `src/components/DocumentQAPanel.tsx` *(NEW)*

Composite panel component wrapping the full Document Q&A experience. Replaces direct inclusion of individual components in `page.tsx`.

```ts
interface DocumentQAPanelProps {
  /** Active conversation ID — passed through to CitationPanel */
  conversationId: string | null;
}
```

### `CitationPanel` — `src/components/CitationPanel.tsx`

No props changes. Visual: citation cards use `bg-card border-border rounded-lg shadow-sm`.

### `DocumentUpload` — `src/components/DocumentUpload.tsx`

No props changes. Visual: drop-zone uses `border-2 border-dashed border-border` idle, `border-primary` on drag-over.

### `DocumentLibrary` — `src/components/DocumentLibrary.tsx`

No props changes. Visual: document rows use `bg-card`, skeleton placeholders shown during load.

### `DocumentStatus` — `src/components/DocumentStatus.tsx`

No props changes. Visual: status badge variants mapped to design tokens (`bg-success/10 text-success`, `bg-destructive/10 text-destructive`, `bg-muted text-muted-foreground`).

---

## Code Assistant Panel

### `CodeAssistant` — `src/components/CodeAssistant.tsx`

No props changes (stateless component). Visual:
- Mode toggle uses `bg-muted` tab bar.
- Code output uses `bg-card` with existing `rehype-highlight` classes re-mapped to design token colours.
- Graph entity sidebar (if present): `bg-sidebar border-l border-border`.

---

## Graph Panel

### `GraphPanel` — `src/components/GraphPanel.tsx`

No props changes. Visual:
- Container: `bg-card rounded-lg border border-border`.
- Loading overlay: uses `<Skeleton>` component.
- Empty state: centred card with `<Network />` icon and "No graph data yet" message.
- Error state: uses `bg-destructive/10 text-destructive` card.
- Node colours: `nodeAutoColorBy="type"` retained; background of canvas matches `--card` token.
- Filter controls (NEW inline UI): small panel anchored top-right inside the graph container.

```ts
// Filter controls shape (internal state — not a prop)
interface GraphFilterState {
  search: string;        // filter nodes by label substring
  selectedTypes: string[]; // show/hide by node type
  zoomLevel: number;     // 0.5–3.0, default 1.0
}
```

---

## Shared UI Primitives (`src/components/ui/`)

Scaffolded by Shadcn CLI. Listed here for completeness:

| Component | Shadcn command | Used by |
|-----------|---------------|---------|
| `Button` | `shadcn add button` | All panels |
| `Badge` | `shadcn add badge` | DocumentStatus, CitationPanel |
| `Skeleton` | `shadcn add skeleton` | DocumentLibrary, GraphPanel, MessageList |
| `Tooltip` | `shadcn add tooltip` | NavSidebar item labels |
| `ScrollArea` | `shadcn add scroll-area` | NavSidebar, MessageList |
| `Separator` | `shadcn add separator` | TopBar, shell layout |
| `Sheet` | `shadcn add sheet` | Mobile NavSidebar drawer |
| `DropdownMenu` | `shadcn add dropdown-menu` | ConversationItem actions, ModelSwitcher |
| `Select` | `shadcn add select` | PersonaSelector, language picker in CodeAssistant |

---

## Settings Panel

### `SettingsPanel` — `src/components/SettingsPanel.tsx` *(NEW)*

Placeholder settings view. V1 scope: read-only display of active provider configs and persona list. No mutation UI in this version.

```ts
// No props — fully self-contained, reads from /api/providers and /api/personas
interface SettingsPanelProps {}
```
