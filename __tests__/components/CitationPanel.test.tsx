// File: __tests__/components/CitationPanel.test.tsx
/**
 * Unit tests for CitationPanel component (T030-T031).
 * Verifies citation rendering, expand/collapse behaviour,
 * and the optional graph-score badge introduced in F003.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CitationPanel } from '@/components/CitationPanel';
import type { Citation } from '@/modules/rag';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeCitation = (overrides: Partial<Citation> = {}): Citation => ({
  documentName: 'report.pdf',
  pageNumber: 3,
  excerpt: 'The quick brown fox.',
  ...overrides,
});

// ─── Basic rendering ──────────────────────────────────────────────────────────

describe('CitationPanel', () => {
  it('renders nothing when citations array is empty', () => {
    const { container } = render(<CitationPanel citations={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a Sources toggle button with count', () => {
    render(<CitationPanel citations={[makeCitation()]} />);
    expect(screen.getByRole('button', { name: /sources \(1\)/i })).toBeDefined();
  });

  it('does not show citation content before expanding', () => {
    render(<CitationPanel citations={[makeCitation({ excerpt: 'Hidden text' })]} />);
    expect(screen.queryByText('Hidden text')).toBeNull();
  });

  it('shows citation content after clicking the toggle', () => {
    render(<CitationPanel citations={[makeCitation({ excerpt: 'Visible text' })]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Visible text')).toBeDefined();
  });

  it('shows document name and page number when expanded', () => {
    render(<CitationPanel citations={[makeCitation({ documentName: 'manual.pdf', pageNumber: 7 })]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/manual\.pdf/)).toBeDefined();
    expect(screen.getByText(/Page 7/)).toBeDefined();
  });

  it('collapses again on second click', () => {
    render(<CitationPanel citations={[makeCitation({ excerpt: 'Toggle me' })]} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByText('Toggle me')).toBeDefined();
    fireEvent.click(btn);
    expect(screen.queryByText('Toggle me')).toBeNull();
  });

  it('renders multiple citations when expanded', () => {
    render(
      <CitationPanel
        citations={[
          makeCitation({ excerpt: 'First chunk' }),
          makeCitation({ documentName: 'other.pdf', pageNumber: 2, excerpt: 'Second chunk' }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('First chunk')).toBeDefined();
    expect(screen.getByText('Second chunk')).toBeDefined();
  });
});

// ─── Graph score badge (T030-T031) ───────────────────────────────────────────

describe('CitationPanel graphScore badge', () => {
  it('shows graph score badge when graphScore is present', () => {
    render(
      <CitationPanel citations={[makeCitation({ graphScore: 0.85 })]} />,
    );
    fireEvent.click(screen.getByRole('button'));
    // Badge should display the score rounded to 2 decimal places
    expect(screen.getByText(/0\.85/)).toBeDefined();
  });

  it('omits graph score badge when graphScore is undefined', () => {
    render(<CitationPanel citations={[makeCitation()]} />);
    fireEvent.click(screen.getByRole('button'));
    // No score text — just the citation header and excerpt
    expect(screen.queryByTestId('graph-score-badge')).toBeNull();
  });

  it('shows badge for each citation that has a graphScore', () => {
    render(
      <CitationPanel
        citations={[
          makeCitation({ graphScore: 0.9 }),
          makeCitation({ documentName: 'b.pdf', pageNumber: 2 }), // no score
          makeCitation({ documentName: 'c.pdf', pageNumber: 3, graphScore: 0.4 }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    const badges = screen.getAllByTestId('graph-score-badge');
    expect(badges).toHaveLength(2);
  });

  it('formats score to two decimal places', () => {
    render(<CitationPanel citations={[makeCitation({ graphScore: 0.12345 })]} />);
    fireEvent.click(screen.getByRole('button'));
    // Should show "0.12" not the full float
    expect(screen.getByTestId('graph-score-badge').textContent).toContain('0.12');
  });
});
