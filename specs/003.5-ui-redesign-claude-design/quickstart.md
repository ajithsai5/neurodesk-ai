# Quickstart: UI Redesign — Claude Design System

**Feature**: 003.5-ui-redesign-claude-design  
**Date**: 2026-05-03

---

## Prerequisites

- Node.js 20+, npm
- Existing `.env` with at least one LLM provider key (for smoke-testing chat)
- Database seeded: `npx drizzle-kit push && npm run db:seed`

---

## 1. Install new dependencies

```bash
npm install next-themes lucide-react class-variance-authority clsx tailwind-merge tailwindcss-animate
npm install @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-separator \
  @radix-ui/react-sheet @radix-ui/react-dropdown-menu @radix-ui/react-select \
  @radix-ui/react-slot
```

> **Note**: Shadcn component source files are scaffolded with the CLI below — the packages above are their runtime dependencies.

---

## 2. Initialise Shadcn

From the project root (answer prompts as shown):

```bash
npx shadcn@latest init
# ✔ Which style would you like to use? › Default
# ✔ Which color would you like to use as base color? › Slate   (we override all values in globals.css)
# ✔ Would you like to use CSS variables for colors? › Yes
```

Then scaffold the required primitives:

```bash
npx shadcn@latest add button badge skeleton tooltip scroll-area separator sheet dropdown-menu select
```

This creates `src/components/ui/` with the scaffolded source files.

---

## 3. Apply design tokens

Replace the generated `:root` / `.dark` blocks in `src/app/globals.css` with the full token set from `data-model.md` section 1.

Replace `tailwind.config.ts` with the configuration from `data-model.md` section 2.

---

## 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the redesigned shell with the top bar, logo, and 5-item navigation sidebar.

---

## 5. Verify dark mode

Click the dark mode toggle in the top bar. Reload the page — the preference should persist (no flash of light mode on load).

---

## 6. Run tests

```bash
npm test
```

All existing tests should pass after the redesign. New component snapshot tests are added alongside each track.

```bash
npm run test:e2e
```

Playwright E2E tests verify the golden path (new conversation → send message → see response) still works in the redesigned UI.

---

## 7. Build check

```bash
npm run build
```

TypeScript strict mode must compile with zero errors. ESLint must pass with zero warnings.

---

## Troubleshooting

**Dark mode flashes on reload**: Ensure `ThemeProvider` wraps the root layout `children` with `attribute="class"` and `enableSystem`. Check that `suppressHydrationWarning` is on `<html>`.

**Tailwind classes not applying**: Confirm `darkMode: ['class']` in `tailwind.config.ts` and that the `content` glob includes `./src/**/*.{ts,tsx}`.

**Shadcn component styles look wrong**: Check that `globals.css` token values are valid HSL numbers (no `hsl()` wrapper — just `H S% L%`).

**Graph canvas dark background**: `react-force-graph-2d` defaults to a transparent background. Set `backgroundColor="transparent"` on `<ForceGraph2D>` and control the background via the container `div`'s `bg-card` class.
