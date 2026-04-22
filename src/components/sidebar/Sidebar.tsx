// File: src/components/sidebar/Sidebar.tsx
/**
 * Sidebar Component
 * Left-side navigation panel showing the conversation list with new conversation button.
 * Supports switching between active and archived conversation views.
 * Handles conversation CRUD operations (rename, delete, archive) via API calls.
 * (Why: provides navigation and conversation management in a persistent sidebar layout)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConversationItem } from './ConversationItem';
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { DocumentUpload } from '@/components/DocumentUpload';
import type { Conversation } from '@/modules/shared/types';

// @field activeConversationId - Currently selected conversation (highlighted in the list)
// @field onSelectConversation - Callback when a conversation is clicked
// @field onNewConversation - Callback when the "New Conversation" button is clicked
interface SidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

// Render the sidebar with conversation list, new conversation button, and archive toggle
// Fetches conversations from the API and re-fetches after any mutation
// @param activeConversationId - ID of the currently selected conversation
// @param onSelectConversation - Navigate to a conversation
// @param onNewConversation - Create a new conversation
export function Sidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // Toggle between active and archived conversation views
  const [showArchived, setShowArchived] = useState(false);
  // Toggle document panel visibility; key used to refresh library after upload
  const [showDocs, setShowDocs] = useState(false);
  const [docRefreshKey, setDocRefreshKey] = useState(0);

  // ============================================
  // Conversation List & CRUD Handlers
  // Fetch, rename, delete, and archive conversations via API.
  // Each handler re-fetches the list after mutation to stay in sync.
  // ============================================

  // Fetch conversations from the API, filtered by current view (active/archived)
  // (Why: re-called after any mutation to keep the list in sync with the database)
  const loadConversations = useCallback(async () => {
    const status = showArchived ? 'archived' : 'active';
    const res = await fetch(`/api/conversations?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations);
    }
  }, [showArchived]);

  // Load conversations on mount and when the view filter changes
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Rename a conversation via PATCH API, then refresh the list
  // @param id - Conversation to rename
  // @param title - New title text
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

  // Delete a conversation via DELETE API, then refresh the list
  // Clears active selection if the deleted conversation was selected
  // @param id - Conversation to delete
  const handleDelete = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      loadConversations();
      // Clear selection if the deleted conversation was active
      // (Why: prevents showing a stale conversation that no longer exists)
      if (id === activeConversationId) {
        onSelectConversation('');
      }
    },
    [loadConversations, activeConversationId, onSelectConversation]
  );

  // Toggle archive status via POST API, then refresh the list
  // Archives active conversations, restores archived ones
  // @param id - Conversation to archive/restore
  const handleArchive = useCallback(
    async (id: string) => {
      // If viewing archived conversations, the action is "restore" (archived: false)
      const isArchived = showArchived;
      await fetch(`/api/conversations/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !isArchived }),
      });
      loadConversations();
      // Clear selection if the archived conversation was active
      // (Why: archived conversations leave the active view, so selection should clear)
      if (id === activeConversationId) {
        onSelectConversation('');
      }
    },
    [loadConversations, showArchived, activeConversationId, onSelectConversation]
  );

  return (
    <aside className="w-[280px] h-full bg-white border-r border-slate-200 flex flex-col">
      {/* Header with new conversation button */}
      <div className="p-4 border-b border-slate-200">
        <button
          onClick={onNewConversation}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + New Conversation
        </button>
      </div>

      {/* Scrollable conversation list */}
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

      {/* Document Library — collapsible panel above the footer */}
      <div className="border-t border-slate-200">
        <button
          onClick={() => setShowDocs((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <span className="font-medium">Documents</span>
          <span className="text-slate-400 text-xs">{showDocs ? '▲' : '▼'}</span>
        </button>
        {showDocs && (
          <div className="pb-2">
            <DocumentUpload onUploaded={() => setDocRefreshKey((k) => k + 1)} />
            <DocumentLibrary refreshKey={docRefreshKey} />
          </div>
        )}
      </div>

      {/* Footer toggle between active and archived views */}
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
