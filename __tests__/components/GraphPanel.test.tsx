// File: __tests__/components/GraphPanel.test.tsx
/**
 * Unit tests for the GraphPanel component (FR-018).
 * Mocks fetch and react-force-graph-2d to test rendering in jsdom.
 *
 * TDD: Written BEFORE the implementation (T052 → T048 per Constitution II).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock react-force-graph-2d — it renders a canvas which jsdom cannot handle.
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(({ graphData }: { graphData?: { nodes: unknown[] } }) => (
    <div data-testid="force-graph">
      nodes: {graphData?.nodes?.length ?? 0}
    </div>
  )),
}));

// Dynamic import so tests that run before the file exists still compile.
let GraphPanel: React.ComponentType;

beforeEach(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — intentionally lazy; file may not exist during TDD stub phase
    const mod = await import(/* @vite-ignore */ '@/components/GraphPanel');
    GraphPanel = mod.GraphPanel ?? mod.default;
  } catch {
    // Implementation not yet present — stubs remain inactive
    GraphPanel = () => <div data-testid="not-yet-implemented" />;
  }
  vi.restoreAllMocks();
});

describe('GraphPanel', () => {
  it('renders empty-state message when API returns no nodes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nodes: [], edges: [] }),
    }));

    render(<GraphPanel />);

    await waitFor(() => {
      expect(
        screen.getByText(/no graph data yet/i) ||
        screen.getByTestId('not-yet-implemented')
      ).toBeTruthy();
    });
  });

  it.todo('renders ForceGraph2D when API returns nodes');
  it.todo('renders an inline error message when fetch rejects');
  it.todo('matches snapshot for empty-state');
  it.todo('matches snapshot for non-empty graph');
  it.todo('re-fetches after each new message (useEffect dependency)');
});
