// File: src/app/page.tsx
/**
 * Home Page — Main Application Entry Point
 * Composes the Sidebar, ChatPanel, and CodeAssistant into a two-column layout.
 * The main panel has two top-level modes: Chat (conversation-based) and
 * Code Assistant (stateless generate + explain).
 * (Why: single page app — all state lives here and flows down as props)
 */

'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { CodeAssistant } from '@/components/CodeAssistant';

type MainTab = 'chat' | 'code';

// Home page component — top-level orchestrator for sidebar + main panel
// @returns The full application UI with sidebar navigation and active panel
export default function Home() {
  // Top-level tab: 'chat' or 'code'
  const [mainTab, setMainTab] = useState<MainTab>('chat');

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
      setMainTab('chat'); // switch to chat so user sees the new conversation
    }
  }, []);

  // Switch active conversation when user clicks a sidebar item
  // (Why: converts empty string to null for consistent "no selection" state)
  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id || null);
    setMainTab('chat'); // selecting a conversation switches to Chat mode
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

      {/* Main panel — tab bar + content area */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-200 px-4 pt-2 bg-white shrink-0">
          <button
            onClick={() => setMainTab('chat')}
            className={`px-4 py-1.5 text-sm font-medium rounded-t transition-colors ${
              mainTab === 'chat'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMainTab('code')}
            className={`px-4 py-1.5 text-sm font-medium rounded-t transition-colors ${
              mainTab === 'code'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Code Assistant
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {mainTab === 'chat' ? (
            /* ChatPanel re-mounts when conversation changes to reset chat state */
            <ChatPanel
              key={`chat-${activeConversationId}`}
              conversationId={activeConversationId}
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <CodeAssistant />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
