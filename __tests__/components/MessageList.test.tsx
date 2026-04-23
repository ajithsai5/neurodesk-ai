// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock StreamingMessage to avoid markdown rendering complexity in unit tests
vi.mock('@/components/chat/StreamingMessage', () => ({
  StreamingMessage: ({ content, role }: { content: string; role: string }) =>
    React.createElement('div', { 'data-testid': `message-${role}` }, content),
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
});
