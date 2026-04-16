// File: src/app/page.tsx
/**
 * Home Page — Main Application Entry Point
 * Composes the Sidebar and ChatPanel into a two-column layout.
 * Manages the active conversation state and coordinates navigation
 * between conversation list (sidebar) and chat view (main panel).
 * (Why: single page app — all state lives here and flows down as props)
 */

'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatPanel } from '@/components/chat/ChatPanel';

// Home page component — top-level orchestrator for sidebar + chat layout
// @returns The full application UI with sidebar navigation and active chat panel
export default function Home() {
  // Track which conversation is currently displayed in the chat panel
  // (Why: null means no conversation selected — ChatPanel shows empty state)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Counter that forces Sidebar to re-mount and re-fetch conversation list
  // (Why: incrementing the key prop causes React to destroy and recreate the component)
  const [refreshKey, setRefreshKey] = useState(0);

  // Create a new conversation via API, then switch to it and refresh sidebar
  // (Why: POST creates the DB record, then we update local state to show it immediately)
  const handleNewConversation = useCallback(async () => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      const data = await res.json();
      setActiveConversationId(data.id);
      setRefreshKey((k) => k + 1);
    }
  }, []);

  // Switch active conversation when user clicks a sidebar item
  // (Why: converts empty string to null for consistent "no selection" state)
  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id || null);
  }, []);

  return (
    <>
      {/* Sidebar re-mounts on refreshKey change to pick up new conversations */}
      <Sidebar
        key={`sidebar-${refreshKey}`}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />
      {/* ChatPanel re-mounts when conversation changes to reset chat state */}
      <ChatPanel
        key={`chat-${activeConversationId}`}
        conversationId={activeConversationId}
      />
    </>
  );
}
