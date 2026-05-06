'use client';

import { useState } from 'react';
import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentLibrary } from '@/components/DocumentLibrary';
interface DocumentQAPanelProps {
  conversationId: string | null;
  /** T060: Called when the user changes the active document filter */
  onFilterChange?: (selectedDocumentIds: number[]) => void;
}

export function DocumentQAPanel({ conversationId, onFilterChange }: DocumentQAPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, background: 'var(--bg-canvas)' }}>
      {/* Left column — upload + library */}
      <div style={{
        width: 320, flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' }}>Documents</h2>
        </div>
        <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <DocumentUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
          <DocumentLibrary refreshKey={refreshKey} onFilterChange={onFilterChange} />
        </div>
      </div>

      {/* Right column — citations */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <p className="empty-state__title">Citations</p>
          <p className="empty-state__body">Ask a question in the Chat panel to see cited sources here.</p>
        </div>
      </div>
    </div>
  );
}
