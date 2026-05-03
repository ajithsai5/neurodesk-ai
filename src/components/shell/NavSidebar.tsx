'use client';

import { MessageSquare, FileText, Code2, Network, Settings } from 'lucide-react';
import { ConversationSidebar } from '@/components/sidebar/ConversationSidebar';

export type PanelId = 'chat' | 'documents' | 'code' | 'graph' | 'settings';

interface NavSidebarProps {
  activePanel: PanelId;
  onPanelChange: (panel: PanelId) => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  sidebarRefreshKey: number;
}

const NAV_ITEMS: { id: PanelId; label: string; icon: React.ReactNode }[] = [
  { id: 'chat',      label: 'Chat',           icon: <MessageSquare size={16} /> },
  { id: 'documents', label: 'Document Q&A',   icon: <FileText size={16} /> },
  { id: 'code',      label: 'Code Assistant', icon: <Code2 size={16} /> },
  { id: 'graph',     label: 'Graph',          icon: <Network size={16} /> },
  { id: 'settings',  label: 'Settings',       icon: <Settings size={16} /> },
];

export function NavSidebar({
  activePanel,
  onPanelChange,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  sidebarRefreshKey,
}: NavSidebarProps) {
  return (
    <div className="sidebar">
      {/* Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__logo">N</div>
        <div>
          <div className="sidebar__brand-name">NeuroDesk</div>
          <div className="sidebar__brand-tag">AI · Portfolio</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav" aria-label="Main navigation">
        <div className="sidebar__section-label">Workspace</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${activePanel === item.id ? ' nav-item--active' : ''}`}
            onClick={() => onPanelChange(item.id)}
            aria-current={activePanel === item.id ? 'page' : undefined}
          >
            <span className="nav-item__icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-item__label">{item.label}</span>
          </button>
        ))}

        {/* Conversation list — shown only when Chat is active */}
        {activePanel === 'chat' && (
          <ConversationSidebar
            key={`conv-${sidebarRefreshKey}`}
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
            onNewConversation={onNewConversation}
          />
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <div className="avatar" aria-hidden="true">D</div>
        <div>
          <div className="sidebar__user-name">Developer</div>
          <div className="sidebar__user-role">Portfolio</div>
        </div>
      </div>
    </div>
  );
}
