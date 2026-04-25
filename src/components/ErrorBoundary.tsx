'use client';
// File: src/components/ErrorBoundary.tsx
/**
 * ErrorBoundary Component
 *
 * React class component that catches rendering errors in its child tree and
 * displays a fallback UI instead of crashing the whole page.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *     <MyComponent />
 *   </ErrorBoundary>
 *
 * (Why: React error boundaries must be class components — hooks cannot catch errors)
 */

import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Content to render when an error is caught. Defaults to a generic message. */
  fallback?: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log the error server-side or to an error reporting service
    // (Why: observability — we need to know what broke even if the UI recovered)
    console.error('[ErrorBoundary] Caught rendering error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" className="p-4 text-red-700 bg-red-50 rounded-md">
          <p className="font-semibold">Something went wrong</p>
          <p className="text-sm mt-1 text-red-600">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
