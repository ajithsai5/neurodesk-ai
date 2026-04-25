// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock StreamingMessage — also surface citations count so we can assert
// extractCitations() picked up the annotation correctly.
vi.mock('@/components/chat/StreamingMessage', () => ({
  StreamingMessage: ({
    content,
    role,
    citations,
    isStreaming,
  }: {
    content: string;
    role: string;
    citations?: unknown[];
    isStreaming?: boolean;
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': `message-${role}`,
        'data-citations': String(citations?.length ?? 0),
        'data-streaming': String(!!isStreaming),
      },
      content
    ),
}));

import { MessageList } from '@/components/chat/MessageList';

// jsdom doesn't implement scrollIntoView — stub it to avoid TypeError in useEffect
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

// Helper to build a fake Vercel AI SDK Message object
function makeMessage(id: string, role: 'user' | 'assistant', content: string) {
  return { id, role, content };
}

describe('MessageList', () => {
  it('shows empty state when there are no messages', () => {
    render(React.createElement(MessageList, { messages: [], isLoading: false }));
    expect(screen.getByText('Start a conversation')).toBeTruthy();
    expect(screen.getByText('Type a message below to begin')).toBeTruthy();
  });

  it('renders user messages', () => {
    const messages = [makeMessage('1', 'user', 'Hello!')];
    render(React.createElement(MessageList, { messages: messages as any, isLoading: false }));
    expect(screen.getByText('Hello!')).toBeTruthy();
    expect(screen.getByTestId('message-user')).toBeTruthy();
  });

  it('renders assistant messages', () => {
    const messages = [makeMessage('2', 'assistant', 'Hi there!')];
    render(React.createElement(MessageList, { messages: messages as any, isLoading: false }));
    expect(screen.getByText('Hi there!')).toBeTruthy();
    expect(screen.getByTestId('message-assistant')).toBeTruthy();
  });

  it('renders multiple messages in order', () => {
    const messages = [
      makeMessage('1', 'user', 'Hello!'),
      makeMessage('2', 'assistant', 'Hi there!'),
      makeMessage('3', 'user', 'How are you?'),
    ];
    render(React.createElement(MessageList, { messages: messages as any, isLoading: false }));
    expect(screen.getAllByTestId(/^message-/).length).toBe(3);
  });

  // ─────────────────────────────────────────────────────────────────
  // Coverage backfill — extractCitations() branches and the
  // isLastAssistant streaming-cursor toggle.
  // ─────────────────────────────────────────────────────────────────

  it('extracts citations from annotations on assistant messages', () => {
    const messages = [
      {
        id: '1',
        role: 'assistant',
        content: 'See sources',
        annotations: [
          { citations: [{ id: 'c1', source: 'a.pdf' }, { id: 'c2', source: 'b.pdf' }] },
        ],
      },
    ];
    render(React.createElement(MessageList, { messages: messages as any, isLoading: false }));
    const node = screen.getByTestId('message-assistant');
    expect(node.getAttribute('data-citations')).toBe('2');
  });

  it('returns no citations when annotations exist but contain no citations key', () => {
    const messages = [
      {
        id: '1',
        role: 'assistant',
        content: 'Plain response',
        annotations: [{ unrelated: 'metadata' }],
      },
    ];
    render(React.createElement(MessageList, { messages: messages as any, isLoading: false }));
    expect(screen.getByTestId('message-assistant').getAttribute('data-citations')).toBe('0');
  });

  it('returns no citations when citations field is not an array', () => {
    const messages = [
      {
        id: '1',
        role: 'assistant',
        content: 'Bad metadata',
        annotations: [{ citations: 'not-an-array' }],
      },
    ];
    render(React.createElement(MessageList, { messages: messages as any, isLoading: false }));
    expect(screen.getByTestId('message-assistant').getAttribute('data-citations')).toBe('0');
  });

  it('does not extract citations on user messages', () => {
    const messages = [
      {
        id: '1',
        role: 'user',
        content: 'a question',
        annotations: [{ citations: [{ id: 'c1' }] }],
      },
    ];
    render(React.createElement(MessageList, { messages: messages as any, isLoading: false }));
    expect(screen.getByTestId('message-user').getAttribute('data-citations')).toBe('0');
  });

  it('marks the last assistant message as streaming when isLoading is true', () => {
    const messages = [
      makeMessage('1', 'user', 'q'),
      makeMessage('2', 'assistant', 'partial...'),
    ];
    render(React.createElement(MessageList, { messages: messages as any, isLoading: true }));
    expect(
      screen.getByTestId('message-assistant').getAttribute('data-streaming')
    ).toBe('true');
  });
});
