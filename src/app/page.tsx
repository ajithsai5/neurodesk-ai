'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatPanel } from '@/components/chat/ChatPanel';

export default function Home() {
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
    }
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id || null);
  }, []);

  return (
    <>
      <Sidebar
        key={`sidebar-${refreshKey}`}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />
      <ChatPanel
        key={`chat-${activeConversationId}`}
        conversationId={activeConversationId}
      />
    </>
  );
}
