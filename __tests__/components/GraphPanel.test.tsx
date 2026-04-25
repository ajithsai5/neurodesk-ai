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
  it('renders empty-state when no conversationId is supplied (effect short-circuits)', async () => {
    // No fetch should be made, and the empty-state message should render.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<GraphPanel />);
    expect(screen.getByText(/no graph data yet/i)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders empty-state message when API returns no nodes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nodes: [], edges: [] }),
    }));

    render(<GraphPanel conversationId="conv-1" />);

    await waitFor(() => {
      expect(screen.getByText(/no graph data yet/i)).toBeTruthy();
    });
  });

  it('renders ForceGraph2D when API returns nodes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        nodes: [
          { id: 'n1', label: 'A', type: 'MESSAGE' },
          { id: 'n2', label: 'B', type: 'CHUNK' },
        ],
        edges: [
          { id: 'e1', sourceId: 'n1', targetId: 'n2', relationship: 'CITES', weight: 1 },
        ],
      }),
    }));

    render(<GraphPanel conversationId="conv-1" />);

    await waitFor(() => {
      // Force graph mock prints the node count
      expect(screen.getByTestId('force-graph').textContent).toContain('nodes: 2');
    });
  });

  it('renders an inline error message when fetch returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));

    render(<GraphPanel conversationId="conv-1" />);

    await waitFor(() => {
      expect(screen.getByText(/graph unavailable/i)).toBeTruthy();
    });
  });

  it('renders an inline error message when fetch rejects (non-Abort)', async () => {
    const err = new Error('boom');
    err.name = 'TypeError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));

    render(<GraphPanel conversationId="conv-1" />);

    await waitFor(() => {
      expect(screen.getByText(/graph unavailable/i)).toBeTruthy();
      expect(screen.getByText(/boom/i)).toBeTruthy();
    });
  });

  it('shows loading overlay while fetch is in-flight (nodes available from prior state)', async () => {
    // We need nodes to be present AND isLoading=true simultaneously.
    // Strategy: first fetch succeeds with nodes, then a second fetch hangs so loading stays true.
    let resolveSecond!: (v: unknown) => void;
    const secondFetch = new Promise((res) => { resolveSecond = res; });

    vi.stubGlobal('fetch', vi.fn()
      // First call: succeeds with 2 nodes → ForceGraph2D renders (loading→false)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nodes: [{ id: 'n1', label: 'A', type: 'MSG' }],
          edges: [],
        }),
      })
      // Second call: never resolves → loading stays true
      .mockReturnValueOnce(secondFetch as Promise<Response>)
    );

    const { rerender } = render(<GraphPanel conversationId="conv-1" messageVersion={0} />);

    // Wait for first fetch to settle and graph to display
    await waitFor(() => expect(screen.getByTestId('force-graph')).toBeTruthy());

    // Trigger a re-fetch by bumping messageVersion — the second fetch hangs
    rerender(<GraphPanel conversationId="conv-1" messageVersion={1} />);

    // While the second fetch is pending, the loading overlay should appear alongside the graph
    await waitFor(() => {
      expect(screen.getByText(/loading graph/i)).toBeTruthy();
    });

    // Clean up: resolve the pending promise so timers / promises settle
    resolveSecond({ ok: true, json: async () => ({ nodes: [], edges: [] }) });
  });

  it('silently ignores AbortError (cancelled in-flight request)', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));

    render(<GraphPanel conversationId="conv-1" />);

    // Wait a tick for the rejection to settle, then assert no error message
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/graph unavailable/i)).toBeNull();
  });
});
