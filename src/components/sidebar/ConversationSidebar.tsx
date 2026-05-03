'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConversationItem } from './ConversationItem';
import { DocumentLibrary } from '@/components/DocumentLibrary';
import { DocumentUpload } from '@/components/DocumentUpload';
import type { Conversation } from '@/modules/shared/types';

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [docRefreshKey, setDocRefreshKey] = useState(0);

  const loadConversations = useCallback(async () => {
    const status = showArchived ? 'archived' : 'active';
    const res = await fetch(`/api/conversations?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations);
    }
  }, [showArchived]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const handleRename = useCallback(async (id: string, title: string) => {
    await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    loadConversations();
  }, [loadConversations]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    loadConversations();
    if (id === activeConversationId) onSelectConversation('');
  }, [loadConversations, activeConversationId, onSelectConversation]);

  const handleArchive = useCallback(async (id: string) => {
    await fetch(`/api/conversations/${id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: !showArchived }),
    });
    loadConversations();
    if (id === activeConversationId) onSelectConversation('');
  }, [loadConversations, showArchived, activeConversationId, onSelectConversation]);

  return (
    <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
      {/* New conversation */}
      <div style={{ padding: '0 var(--space-4) var(--space-3)' }}>
        <button className="btn btn--primary" style={{ width: '100%', fontSize: 'var(--text-sm)' }} onClick={onNewConversation}>
          + New Conversation
        </button>
      </div>

      {/* Conversation list */}
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', textAlign: 'center', padding: 'var(--space-5) var(--space-4)' }}>
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

      {/* Documents toggle */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-3)' }}>
        <button
          onClick={() => setShowDocs((v) => !v)}
          className="nav-item"
          style={{ width: '100%', fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)' }}
        >
          <span>Documents</span>
          <span style={{ marginLeft: 'auto' }}>{showDocs ? '▲' : '▼'}</span>
        </button>
        {showDocs && (
          <div style={{ padding: '0 var(--space-4)' }}>
            <DocumentUpload onUploaded={() => setDocRefreshKey((k) => k + 1)} />
            <DocumentLibrary refreshKey={docRefreshKey} />
          </div>
        )}
      </div>

      {/* Archive toggle */}
      <button
        onClick={() => setShowArchived(!showArchived)}
        style={{
          width: '100%', padding: 'var(--space-3) var(--space-4)',
          fontSize: 'var(--text-xs)', color: 'var(--fg-muted)',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center',
        }}
      >
        {showArchived ? 'Show Active' : 'Show Archived'}
      </button>
    </div>
  );
}
