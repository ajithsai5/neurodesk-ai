// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the markdown rendering libraries — not under test
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('div', { 'data-testid': 'markdown' }, children),
}));
vi.mock('remark-gfm', () => ({ default: vi.fn() }));
vi.mock('rehype-highlight', () => ({ default: vi.fn() }));

import { StreamingMessage } from '@/components/chat/StreamingMessage';

afterEach(() => {
  vi.clearAllMocks();
});

describe('StreamingMessage', () => {
  it('renders user message as plain text (right-aligned)', () => {
    render(React.createElement(StreamingMessage, { content: 'Hello', role: 'user' }));
    expect(screen.getByText('Hello')).toBeTruthy();
    // User messages use a <p> tag (plain text, no markdown)
    const p = screen.getByText('Hello').tagName;
    expect(p).toBe('P');
  });

  it('renders assistant message through markdown renderer', () => {
    render(React.createElement(StreamingMessage, { content: '**Bold**', role: 'assistant' }));
    // Markdown mock renders the content inside data-testid="markdown"
    expect(screen.getByTestId('markdown')).toBeTruthy();
    expect(screen.getByTestId('markdown').textContent).toBe('**Bold**');
  });

  it('adds streaming-cursor class when isStreaming is true', () => {
    const { container } = render(
      React.createElement(StreamingMessage, { content: 'Typing...', role: 'assistant', isStreaming: true })
    );
    const streamingEl = container.querySelector('.streaming-cursor');
    expect(streamingEl).toBeTruthy();
  });

  it('does not add streaming-cursor class when isStreaming is false', () => {
    const { container } = render(
      React.createElement(StreamingMessage, { content: 'Done', role: 'assistant', isStreaming: false })
    );
    const streamingEl = container.querySelector('.streaming-cursor');
    expect(streamingEl).toBeNull();
  });

  it('does not add streaming-cursor by default (isStreaming undefined)', () => {
    const { container } = render(
      React.createElement(StreamingMessage, { content: 'Done', role: 'assistant' })
    );
    expect(container.querySelector('.streaming-cursor')).toBeNull();
  });
});
