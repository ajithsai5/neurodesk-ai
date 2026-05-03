# Data Model: UI Redesign — Claude Design System

**Phase**: 1 — Design  
**Feature**: 003.5-ui-redesign-claude-design  
**Date**: 2026-05-03

---

## 1. Design Token Schema

All tokens are CSS custom properties defined in `src/app/globals.css`. Tailwind references them via `hsl(var(--token))` in `tailwind.config.ts`.

### Colour Tokens

```css
/* src/app/globals.css */

:root {
  /* Backgrounds */
  --background:         40 33% 98%;   /* warm off-white page bg */
  --foreground:         40 10%  8%;   /* near-black primary text */
  --card:                0  0% 100%;  /* white surface / card */
  --card-foreground:    40 10%  8%;

  /* Subdued surfaces */
  --muted:             40 20% 94%;   /* light warm grey */
  --muted-foreground:  40  5% 44%;   /* secondary text */

  /* Borders & inputs */
  --border:            40 20% 87%;
  --input:             40 20% 87%;

  /* Navigation sidebar */
  --sidebar:           40 25% 96%;
  --sidebar-foreground: 40 10% 30%;
  --sidebar-active:    24 90% 53%;   /* primary accent on active nav item */

  /* Brand accent (amber/orange — Claude-inspired) */
  --primary:           24 90% 53%;
  --primary-foreground: 0  0% 100%;

  /* Secondary surfaces */
  --secondary:         40 20% 92%;
  --secondary-foreground: 40 10% 20%;

  /* Hover accent */
  --accent:            40 20% 90%;
  --accent-foreground: 40 10%  8%;

  /* Semantic */
  --destructive:        0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --success:           142 71% 45%;
  --success-foreground: 0  0% 100%;
  --warning:           38 92% 50%;
  --warning-foreground: 0  0% 100%;

  /* Focus ring */
  --ring:              24 90% 53%;

  /* Shape */
  --radius:            0.5rem;
}

.dark {
  --background:        40 10%  8%;
  --foreground:        40 15% 93%;
  --card:              40  8% 12%;
  --card-foreground:   40 15% 93%;

  --muted:             40  8% 16%;
  --muted-foreground:  40  5% 58%;

  --border:            40  8% 20%;
  --input:             40  8% 20%;

  --sidebar:           40  8% 10%;
  --sidebar-foreground: 40 10% 70%;
  --sidebar-active:    24 90% 60%;

  --primary:           24 90% 60%;
  --primary-foreground: 0  0% 100%;

  --secondary:         40  8% 18%;
  --secondary-foreground: 40 10% 80%;

  --accent:            40  8% 20%;
  --accent-foreground: 40 15% 93%;

  --destructive:        0 84% 65%;
  --destructive-foreground: 0 0% 100%;
  --success:           142 71% 50%;
  --warning:           38 92% 55%;

  --ring:              24 90% 60%;
}
```

### Typography Tokens

Applied via `tailwind.config.ts` font-size scale. No custom values needed — Tailwind defaults (`text-xs` through `text-2xl`) are sufficient. Font family is set in `globals.css` body rule using the system stack already present.

### Spacing & Shape Tokens

```ts
// tailwind.config.ts (extend block)
borderRadius: {
  lg: 'var(--radius)',           // 0.5rem
  md: 'calc(var(--radius) - 2px)', // 0.375rem
  sm: 'calc(var(--radius) - 4px)', // 0.25rem
}
```

### Shadow Tokens

```css
:root {
  --shadow-sm:  0 1px 2px 0 hsl(40 10% 8% / 0.05);
  --shadow:     0 1px 3px 0 hsl(40 10% 8% / 0.08), 0 1px 2px -1px hsl(40 10% 8% / 0.08);
  --shadow-md:  0 4px 6px -1px hsl(40 10% 8% / 0.08), 0 2px 4px -2px hsl(40 10% 8% / 0.08);
}
.dark {
  --shadow-sm:  0 1px 2px 0 hsl(0 0% 0% / 0.2);
  --shadow:     0 1px 3px 0 hsl(0 0% 0% / 0.25);
  --shadow-md:  0 4px 6px -1px hsl(0 0% 0% / 0.3);
}
```

---

## 2. Tailwind Configuration Shape

```ts
// tailwind.config.ts
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border:   'hsl(var(--border))',
        input:    'hsl(var(--input))',
        ring:     'hsl(var(--ring))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        sidebar: {
          DEFAULT:    'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          active:     'hsl(var(--sidebar-active))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],  // required by shadcn
};
```

---

## 3. Shell State Shape

The shell layout is managed in `src/app/page.tsx`. The state shape is:

```ts
type PanelId = 'chat' | 'documents' | 'code' | 'graph' | 'settings';

interface ShellState {
  activePanel: PanelId;           // currently displayed panel
  activeConversationId: string | null;  // chat panel only
  sidebarOpen: boolean;           // mobile sidebar toggle
  refreshKey: number;             // forces sidebar re-fetch
}
```

No new database tables or API routes are required. This state is ephemeral React state.

---

## 4. Theme Preference Persistence

`next-themes` stores the user's colour mode preference in `localStorage` under the key `theme` with values `'light'` or `'dark'`. On initial render, it reads this value before hydration to prevent FOUC. This is handled entirely by the library — no application-level persistence code is required.

---

## 5. Logo Asset Variants

| File | Purpose | Dimensions |
|------|---------|-----------|
| `public/logo-light.svg` | Wordmark on light background | 180×32 viewBox |
| `public/logo-dark.svg` | Wordmark on dark background | 180×32 viewBox |
| `public/favicon-16.png` | Browser favicon | 16×16 |
| `public/favicon-32.png` | Browser favicon (retina) | 32×32 |
| `public/icon-512.png` | App icon (PWA / bookmark) | 512×512 |

The `<NeuroLogo>` component selects between `logo-light.svg` and `logo-dark.svg` based on `useTheme()`.

---

## 6. Component Variant Definitions (CVA)

Key shared component variants defined in `src/components/ui/`. These are created by the Shadcn scaffolder and extended with project token values.

### Button

```ts
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:     'border border-input bg-background hover:bg-accent',
        ghost:       'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link:        'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 px-3 text-xs',
        lg:      'h-10 px-6',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);
```

### Skeleton

```ts
// Skeleton component — pulsing placeholder for loading states
// Usage: <Skeleton className="h-4 w-[200px]" />
```

---

## 7. Reduced Motion

```css
/* globals.css — appended */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This satisfies FR-012 (suppressed when "reduce motion" is enabled) without any JS involvement.
