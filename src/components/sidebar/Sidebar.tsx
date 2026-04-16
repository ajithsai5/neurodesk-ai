'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConversationItem } from './ConversationItem';
import type { Conversation } from '@/modules/shared/types';

interface SidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function Sidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const loadConversations = useCallback(async () => {
    const status = showArchived ? 'archived' : 'active';
    const res = await fetch(`/api/conversations?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations);
    }
  }, [showArchived]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleRename = useCallback(
    async (id: string, title: string) => {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      loadConversations();
    },
    [loadConversations]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      loadConversations();
      if (id === activeConversationId) {
        onSelectConversation('');
      }
    },
    [loadConversations, activeConversationId, onSelectConversation]
  );

  const handleArchive = useCallback(
    async (id: string) => {
      const isArchived = showArchived;
      await fetch(`/api/conversations/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !isArchived }),
      });
      loadConversations();
      if (id === activeConversationId) {
        onSelectConversation('');
      }
    },
    [loadConversations, showArchived, activeConversationId, onSelectConversation]
  );

  return (
    <aside className="w-[280px] h-full bg-white border-r border-slate-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <button
          onClick={onNewConversation}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + New Conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {conversations.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            {showArchived ? 'No archived conversations' : 'No conversations yet'}
          </p>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              id={conv.id}
              title={conv.title}
              updatedAt={conv.updatedAt}
              isActive={conv.id === activeConversationId}
              onSelect={onSelectConversation}
              onRename={handleRename}
              onDelete={handleDelete}
              onArchive={handleArchive}
            />
          ))
        )}
      </div>

      {/* Archive Toggle */}
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          {showArchived ? 'Show Active' : 'Show Archived'}
        </button>
      </div>
    </aside>
  );
}
