import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    // Apply jsdom only to component test files; all other tests remain on node.
    // (Why: jsdom is heavyweight — scoping it prevents slowing down unit/integration tests)
    environmentMatchGlobs: [
      ['__tests__/components/**', 'jsdom'],
    ],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      // json-summary + json are both required by davelosert/vitest-coverage-report-action@v2
      reporter: ['text', 'html', 'json-summary', 'json'],
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
        // AST analysis startup utility — depends on the TypeScript compiler API and
        // the real file system; not practical to unit-test without the full src/ tree.
        // Covered by integration smoke-test when running the Next.js dev server.
        'src/modules/graph/ast-analysis.ts',
      ],
      thresholds: {
        // Minimum 90% enforced in CI (FR-001). Aspirational target: 95% (SC-001).
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
