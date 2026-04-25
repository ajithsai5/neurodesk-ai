// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

// Mock PersonaSelector and ModelSwitcher — expose buttons that invoke onSelect with
// a fixed test payload so the parent's handlers are exercised.
vi.mock('@/components/PersonaSelector', () => ({
  PersonaSelector: ({ onSelect }: { onSelect: (id: string) => void }) =>
    React.createElement(
      'button',
      { 'data-testid': 'persona-selector', onClick: () => onSelect('new-persona') },
      'persona'
    ),
}));
vi.mock('@/components/ModelSwitcher', () => ({
  ModelSwitcher: ({ onSelect }: { onSelect: (id: string) => void }) =>
    React.createElement(
      'button',
      { 'data-testid': 'model-switcher', onClick: () => onSelect('new-provider') },
      'provider'
    ),
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
// Mock MessageInput — invokes onSubmit with a fixed string for handler coverage.
vi.mock('@/components/chat/MessageInput', () => ({
  MessageInput: ({ onSubmit, isLoading }: { onSubmit: (content: string) => void; isLoading: boolean }) =>
    React.createElement(
      'button',
      { 'data-testid': 'message-input', onClick: () => onSubmit('hello'), disabled: isLoading },
      'Send'
    ),
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

  it('falls back to a generic error string when the error has no message', () => {
    vi.mocked(useChat).mockReturnValueOnce({
      messages: [],
      isLoading: false,
      error: new Error(''), // empty message — must hit the || fallback
      append: vi.fn(),
      setMessages: vi.fn(),
      reload: vi.fn(),
    } as any);
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    expect(screen.getByText(/an error occurred/i)).toBeTruthy();
  });

  it('clicking Retry invokes useChat.reload', () => {
    const reload = vi.fn();
    vi.mocked(useChat).mockReturnValueOnce({
      messages: [],
      isLoading: false,
      error: new Error('boom'),
      append: vi.fn(),
      setMessages: vi.fn(),
      reload,
    } as any);
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    fireEvent.click(screen.getByText('Retry'));
    expect(reload).toHaveBeenCalled();
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

  // ─────────────────────────────────────────────────────────────────
  // Coverage backfill — handleSend, handlePersonaChange, handleProviderChange,
  // and the load() effect's success branch (setMessages mapping).
  // ─────────────────────────────────────────────────────────────────

  it('calls append with the user message when MessageInput submits', () => {
    const append = vi.fn();
    vi.mocked(useChat).mockReturnValueOnce({
      messages: [],
      isLoading: false,
      error: null,
      append,
      setMessages: vi.fn(),
      reload: vi.fn(),
    } as any);
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    fireEvent.click(screen.getByTestId('message-input'));
    expect(append).toHaveBeenCalledWith({ role: 'user', content: 'hello' });
  });

  it('PATCHes the conversation when persona changes', async () => {
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    fireEvent.click(screen.getByTestId('persona-selector'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/conversations/conv-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ personaId: 'new-persona' }),
        })
      );
    });
  });

  it('PATCHes the conversation when provider changes', async () => {
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    fireEvent.click(screen.getByTestId('model-switcher'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/conversations/conv-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ providerId: 'new-provider' }),
        })
      );
    });
  });

  it('hydrates messages from GET /api/conversations/:id on mount', async () => {
    const setMessages = vi.fn();
    vi.mocked(useChat).mockReturnValueOnce({
      messages: [],
      isLoading: false,
      error: null,
      append: vi.fn(),
      setMessages,
      reload: vi.fn(),
    } as any);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        personaId: 'p-1',
        providerId: 'pr-1',
        messages: [
          { id: 'm1', role: 'user', content: 'first' },
          { id: 'm2', role: 'assistant', content: 'reply' },
        ],
      }),
    }));
    render(React.createElement(ChatPanel, { conversationId: 'conv-1' }));
    await waitFor(() => {
      expect(setMessages).toHaveBeenCalledWith([
        { id: 'm1', role: 'user', content: 'first' },
        { id: 'm2', role: 'assistant', content: 'reply' },
      ]);
    });
  });

  it('silently ignores fetch failure on conversation hydrate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    // Should not throw; the catch block in load() swallows the error.
    expect(() =>
      render(React.createElement(ChatPanel, { conversationId: 'conv-1' }))
    ).not.toThrow();
    // Wait a microtask for the promise rejection to settle
    await new Promise((r) => setTimeout(r, 0));
  });
});
