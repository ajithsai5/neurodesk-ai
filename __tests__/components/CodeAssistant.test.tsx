// File: __tests__/components/CodeAssistant.test.tsx
/**
 * Unit tests for CodeAssistant component (T026-T029).
 * Uses vi.stubGlobal fetch mocking so no server setup is needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeAssistant } from '@/components/CodeAssistant';

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Basic rendering ──────────────────────────────────────────────────────────

describe('CodeAssistant', () => {
  it('renders Generate and Explain tab buttons', () => {
    render(<CodeAssistant />);
    // Use exact tab names (not regexes) to avoid matching the submit buttons too
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Explain' })).toBeDefined();
  });

  it('shows the Generate tab content by default', () => {
    render(<CodeAssistant />);
    expect(screen.getByPlaceholderText(/language/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/description/i)).toBeDefined();
  });

  it('switches to Explain tab when clicked', () => {
    render(<CodeAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    expect(screen.getByPlaceholderText(/paste.*code/i)).toBeDefined();
  });

  it('switches back to Generate tab', () => {
    render(<CodeAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(screen.getByPlaceholderText(/description/i)).toBeDefined();
  });
});

// ─── Generate flow ────────────────────────────────────────────────────────────

describe('CodeAssistant generate flow', () => {
  beforeEach(() => {
    mockFetchOnce({ code: 'function hello() {\n  console.log("hi");\n}' });
  });

  it('calls POST /api/code/generate with language and description', async () => {
    render(<CodeAssistant />);
    fireEvent.change(screen.getByPlaceholderText(/language/i), {
      target: { value: 'typescript' },
    });
    fireEvent.change(screen.getByPlaceholderText(/description/i), {
      target: { value: 'a hello function' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate code/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/code/generate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('displays the generated code after submission', async () => {
    render(<CodeAssistant />);
    fireEvent.change(screen.getByPlaceholderText(/language/i), {
      target: { value: 'typescript' },
    });
    fireEvent.change(screen.getByPlaceholderText(/description/i), {
      target: { value: 'a hello function' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate code/i }));

    await waitFor(() => {
      expect(screen.getByText(/function hello/i)).toBeDefined();
    });
  });

  it('shows error message when API returns 500', async () => {
    vi.unstubAllGlobals();
    mockFetchOnce({ error: 'LLM down' }, 500);

    render(<CodeAssistant />);
    fireEvent.change(screen.getByPlaceholderText(/language/i), {
      target: { value: 'ts' },
    });
    fireEvent.change(screen.getByPlaceholderText(/description/i), {
      target: { value: 'anything' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate code/i }));

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeDefined();
    });
  });

  it('shows error message when fetch throws (network error)', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

    render(<CodeAssistant />);
    fireEvent.change(screen.getByPlaceholderText(/language/i), {
      target: { value: 'ts' },
    });
    fireEvent.change(screen.getByPlaceholderText(/description/i), {
      target: { value: 'anything' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate code/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to reach/i)).toBeDefined();
    });
  });
});

// ─── Explain flow ─────────────────────────────────────────────────────────────

describe('CodeAssistant explain flow', () => {
  it('calls POST /api/code/explain with the pasted code', async () => {
    mockFetchOnce({ explanation: 'This adds two numbers.' });

    render(<CodeAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    fireEvent.change(screen.getByPlaceholderText(/paste.*code/i), {
      target: { value: 'const add = (a, b) => a + b;' },
    });
    fireEvent.click(screen.getByRole('button', { name: /explain code/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/code/explain',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('displays the explanation after submission', async () => {
    mockFetchOnce({ explanation: 'This adds two numbers.' });

    render(<CodeAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    fireEvent.change(screen.getByPlaceholderText(/paste.*code/i), {
      target: { value: 'const add = (a, b) => a + b;' },
    });
    fireEvent.click(screen.getByRole('button', { name: /explain code/i }));

    await waitFor(() => {
      expect(screen.getByText('This adds two numbers.')).toBeDefined();
    });
  });

  it('shows error when explain API returns 500', async () => {
    mockFetchOnce({ error: 'LLM down' }, 500);

    render(<CodeAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    fireEvent.change(screen.getByPlaceholderText(/paste.*code/i), {
      target: { value: 'const x = 1;' },
    });
    fireEvent.click(screen.getByRole('button', { name: /explain code/i }));

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeDefined();
    });
  });

  it('shows error when explain fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

    render(<CodeAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    fireEvent.change(screen.getByPlaceholderText(/paste.*code/i), {
      target: { value: 'const x = 1;' },
    });
    fireEvent.click(screen.getByRole('button', { name: /explain code/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to reach/i)).toBeDefined();
    });
  });
});
