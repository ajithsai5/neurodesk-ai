// File: src/components/chat/ChatPanel.tsx
/**
 * Chat Panel Component — Main Chat Interface
 * Composes the full chat experience: toolbar (persona/model selectors),
 * message list, error banner, and message input.
 * Uses Vercel AI SDK's useChat hook for streaming SSE communication.
 * (Why: central orchestrator for the chat UI — manages conversation state and user interactions)
 */

'use client';

import { useChat } from 'ai/react';
import { useState, useCallback, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { PersonaSelector } from '@/components/PersonaSelector';
import { ModelSwitcher } from '@/components/ModelSwitcher';

// @field conversationId - Active conversation ID or null when no conversation is selected
interface ChatPanelProps {
  conversationId: string | null;
}

// Render the full chat panel with toolbar, messages, error banner, and input
// Manages conversation loading, message sending, and persona/provider switching
// @param conversationId - The active conversation, or null to show the welcome screen
export function ChatPanel({ conversationId }: ChatPanelProps) {
  // Track current persona and provider for the toolbar selectors
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);

  // Vercel AI SDK useChat hook — manages streaming SSE connection to POST /api/chat
  // (Why: handles message state, streaming, and error recovery automatically)
  const {
    messages,
    isLoading,
    error,
    append,
    setMessages,
    reload,
  } = useChat({
    api: '/api/chat',
    id: conversationId ?? undefined,
    // Pass conversationId in the request body for the chat service
    body: { conversationId },
    initialMessages: [],
  });

  // ============================================
  // Conversation Lifecycle Handlers
  // Load conversation on mount, send messages, and switch persona/provider.
  // Each handler interacts with the API and updates local state accordingly.
  // ============================================

  // Load conversation details (persona, provider, messages) when conversation changes
  // (Why: hydrates the chat panel with existing messages and settings from the DB)
  useEffect(() => {
    if (!conversationId) return;

    async function load() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (res.ok) {
          const data = await res.json();
          // Set toolbar selectors to match the conversation's current settings
          setPersonaId(data.personaId);
          setProviderId(data.providerId);
          // Load existing messages into the useChat state
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
        }
      } catch {
        // Failed to load — start with empty messages
      }
    }

    load();
  }, [conversationId, setMessages]);

  // Send a new user message via the useChat append method
  // (Why: append triggers the SSE stream to POST /api/chat and updates message state)
  const handleSend = useCallback(
    (content: string) => {
      if (!conversationId) return;
      append({ role: 'user', content });
    },
    [conversationId, append]
  );

  // Update the conversation's persona via PATCH API
  // (Why: changing persona mid-conversation switches the AI's system prompt)
  const handlePersonaChange = useCallback(
    async (newPersonaId: string) => {
      if (!conversationId) return;
      setPersonaId(newPersonaId);
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId: newPersonaId }),
      });
    },
    [conversationId]
  );

  // Update the conversation's LLM provider via PATCH API
  // (Why: changing provider mid-conversation switches which AI model responds)
  const handleProviderChange = useCallback(
    async (newProviderId: string) => {
      if (!conversationId) return;
      setProviderId(newProviderId);
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: newProviderId }),
      });
    },
    [conversationId]
  );

  // Show welcome screen when no conversation is selected
  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-center">
          <p className="text-xl font-medium">NeuroDesk AI</p>
          <p className="text-sm mt-2">Select a conversation or start a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      {/* Toolbar: Persona selector (left) + Model switcher (right) */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
        <PersonaSelector selectedPersonaId={personaId} onSelect={handlePersonaChange} />
        <ModelSwitcher selectedProviderId={providerId} onSelect={handleProviderChange} />
      </div>

      {/* Scrollable message list */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Error banner with retry button — shown when streaming fails */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between">
          <p className="text-red-600 text-sm">
            {error.message || 'An error occurred. Please try again.'}
          </p>
          <button
            onClick={() => reload()}
            className="text-red-600 text-sm font-medium hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Message input with character counter */}
      <MessageInput onSubmit={handleSend} isLoading={isLoading} />
    </div>
  );
}
