'use client';

import { useState, useCallback } from 'react';
import { NavSidebar, type PanelId } from '@/components/shell/NavSidebar';
import { TopBar } from '@/components/shell/TopBar';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { CodeAssistant } from '@/components/CodeAssistant';
import { GraphPanel } from '@/components/GraphPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { DocumentQAPanel } from '@/components/DocumentQAPanel';

export default function Home() {
  const [activePanel, setActivePanel] = useState<PanelId>('chat');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
      setActivePanel('chat');
    }
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id || null);
    setActivePanel('chat');
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <TopBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <NavSidebar
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          sidebarRefreshKey={refreshKey}
        />
        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activePanel === 'chat' && (
            <ChatPanel key={`chat-${activeConversationId}`} conversationId={activeConversationId} />
          )}
          {activePanel === 'documents' && (
            <DocumentQAPanel conversationId={activeConversationId} />
          )}
          {activePanel === 'code' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <CodeAssistant />
            </div>
          )}
          {activePanel === 'graph' && (
            <div style={{ flex: 1, overflow: 'hidden', padding: 'var(--space-6)' }}>
              <GraphPanel conversationId={activeConversationId ?? undefined} />
            </div>
          )}
          {activePanel === 'settings' && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}
