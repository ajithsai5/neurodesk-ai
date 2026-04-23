import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    // Use the automatic JSX runtime so source components (Next.js style)
    // don't need `import React from 'react'` — matches how Next.js compiles them
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // Only instrument the application source files — excludes config/infra
      include: ['src/**'],
      exclude: [
        // Framework infrastructure — no meaningful unit test surface
        'src/app/layout.tsx',
        'src/app/page.tsx',
        // Type-only files — no executable statements to cover
        '**/types.ts',
        // Database seed — init script, not unit-testable
        '**/seed.ts',
        // Barrel re-exports — no business logic
        '**/index.ts',
        // Drizzle schema — DDL declarations, not unit-testable logic
        'src/modules/shared/db/schema.ts',
        // Sidebar components — out of scope for this sprint (F01.5)
        'src/components/sidebar/**',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 85,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
