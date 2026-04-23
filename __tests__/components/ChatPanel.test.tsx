// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the Vercel AI SDK useChat hook — avoids real SSE connections
vi.mock('ai/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    isLoading: false,
    error: null,
    append: vi.fn(),
    setMessages: vi.fn(),
    reload: vi.fn(),
  })),
}));

// Mock PersonaSelector and ModelSwitcher — their own tests cover them
vi.mock('@/components/PersonaSelector', () => ({
  PersonaSelector: () => React.createElement('div', { 'data-testid': 'persona-selector' }),
}));
vi.mock('@/components/ModelSwitcher', () => ({
  ModelSwitcher: () => React.createElement('div', { 'data-testid': 'model-switcher' }),
}));
// Mock MessageList — chat message list rendering
vi.mock('@/components/chat/MessageList', () => ({
  MessageList: ({ messages }: { messages: { id: string; role: string; content: string }[] }) =>
    React.createElement(
      'div',
      { 'data-testid': 'message-list' },
      messages.map(m => React.createElement('div', { key: m.id, 'data-testid': 'message' }, m.content))
    ),
}));
// Mock MessageInput — form is tested separately
vi.mock('@/components/chat/MessageInput', () => ({
  MessageInput: ({ onSubmit, isLoading }: { onSubmit: () => void; isLoading: boolean }) =>
    React.createElement('button', { 'data-testid': 'message-input', onClick: onSubmit, disabled: isLoading }, 'Send'),
}));

import { ChatPanel } from '@/components/chat/ChatPanel';
import { useChat } from 'ai/react';

describe('ChatPanel', () => {
  beforeEach(() => {
    // Stub fetch so useEffect API calls don't fail
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        personaId: 'p-1',
        providerId: 'pr-1',
        messages: [],
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // T026a — renders welcome screen when conversationId is null
  it('renders welcome screen when no conversation is selected', () => {
    render(React.createElement(ChatPanel, { conversationId: null }));
    expect(screen.getByText('NeuroDesk AI')).toBeTruthy();
    expect(screen.getByText(/select a conversation/i)).toBeTruthy();
  });

  // T026b — renders chat panel when conversationId is provided
  it('renders chat interface when a conversationId is given', () => {
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    expect(screen.getByTestId('persona-selector')).toBeTruthy();
    expect(screen.getByTestId('model-switcher')).toBeTruthy();
    expect(screen.getByTestId('message-input')).toBeTruthy();
  });

  // T026c — renders messages returned by useChat
  it('renders messages from useChat', () => {
    vi.mocked(useChat).mockReturnValueOnce({
      messages: [{ id: '1', role: 'user', content: 'Hello there' }],
      isLoading: false,
      error: null,
      append: vi.fn(),
      setMessages: vi.fn(),
      reload: vi.fn(),
    } as any);
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    expect(screen.getByText('Hello there')).toBeTruthy();
  });

  // T026d — renders error banner when useChat has an error
  it('renders error banner when there is an error', () => {
    vi.mocked(useChat).mockReturnValueOnce({
      messages: [],
      isLoading: false,
      error: new Error('Connection failed'),
      append: vi.fn(),
      setMessages: vi.fn(),
      reload: vi.fn(),
    } as any);
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    expect(screen.getByText('Connection failed')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
