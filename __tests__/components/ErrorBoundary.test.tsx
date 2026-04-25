// File: __tests__/components/ErrorBoundary.test.tsx
/**
 * Tests for the ErrorBoundary class component (FR-002).
 * Verifies that rendering errors in children are caught and the fallback UI renders.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Suppress React's console.error for the expected error during tests
// (Why: React always calls console.error for caught errors — mocking prevents noisy test output)
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  consoleSpy.mockClear();
});

// Component that unconditionally throws during render.
// Return type annotation ensures TS treats it as a valid JSX component.
function BrokenChild(): React.ReactNode {
  throw new Error('Intentional render error for testing');
}

// Component that renders normally
function GoodChild() {
  return <p>All good</p>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders default fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    // The error message should be displayed
    expect(screen.getByText('Intentional render error for testing')).toBeTruthy();
  });

  it('renders custom fallback when provided and child throws', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
        <BrokenChild />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
    expect(screen.getByText('Custom error UI')).toBeTruthy();
  });

  it('calls console.error when error is caught (componentDidCatch)', () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );
    // componentDidCatch calls console.error with the error
    expect(consoleSpy).toHaveBeenCalled();
  });
});
