'use client';

import { useChat } from 'ai/react';
import { useState, useCallback, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { PersonaSelector } from '@/components/PersonaSelector';
import { ModelSwitcher } from '@/components/ModelSwitcher';

interface ChatPanelProps {
  conversationId: string | null;
}

export function ChatPanel({ conversationId }: ChatPanelProps) {
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);

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
    body: { conversationId },
    initialMessages: [],
  });

  // Load conversation details (persona, provider, messages) when conversation changes
  useEffect(() => {
    if (!conversationId) return;

    async function load() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (res.ok) {
          const data = await res.json();
          setPersonaId(data.personaId);
          setProviderId(data.providerId);
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
        }
      } catch {
        // Failed to load — start with empty
      }
    }

    load();
  }, [conversationId, setMessages]);

  const handleSend = useCallback(
    (content: string) => {
      if (!conversationId) return;
      append({ role: 'user', content });
    },
    [conversationId, append]
  );

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
      {/* Toolbar: Persona + Model selectors */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
        <PersonaSelector selectedPersonaId={personaId} onSelect={handlePersonaChange} />
        <ModelSwitcher selectedProviderId={providerId} onSelect={handleProviderChange} />
      </div>

      <MessageList messages={messages} isLoading={isLoading} />

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

      <MessageInput onSubmit={handleSend} isLoading={isLoading} />
    </div>
  );
}
