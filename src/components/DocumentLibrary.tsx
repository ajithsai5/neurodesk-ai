// File: src/components/DocumentLibrary.tsx
/**
 * DocumentLibrary — Lists all uploaded documents with status badges and delete controls.
 * Fetches GET /api/documents on mount, polls every 2 s while any document is pending,
 * and optimistically removes documents when the user clicks delete.
 * (Why: polling is the simplest mechanism to reflect async ingestion progress without
 * requiring WebSockets or server-sent events for this low-frequency update)
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { DocumentStatus } from './DocumentStatus';

interface DocumentRecord {
  id: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  pageCount: number | null;
  status: 'pending' | 'ready' | 'failed';
  errorMessage: string | null;
  createdAt: string;
}

interface Props {
  /** Incremented by parent to trigger a fresh fetch (e.g., after a new upload) */
  refreshKey?: number;
}

const POLL_INTERVAL_MS = 2000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// DocumentLibrary fetches and displays the document list, polling for pending status changes.
export function DocumentLibrary({ refreshKey = 0 }: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { documents: DocumentRecord[] };
      setDocs(data.documents);
      setFetchError(null);
    } catch (err) {
      setFetchError('Failed to load documents.');
      console.error('[DocumentLibrary] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + re-fetch when parent signals a new upload
  useEffect(() => {
    setLoading(true);
    void fetchDocs();
  }, [fetchDocs, refreshKey]);

  // Poll while any document is pending (stop once all are settled)
  useEffect(() => {
    const hasPending = docs.some((d) => d.status === 'pending');

    if (hasPending && !pollingRef.current) {
      pollingRef.current = setInterval(() => { void fetchDocs(); }, POLL_INTERVAL_MS);
    } else if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [docs, fetchDocs]);

  async function handleDelete(id: number) {
    // Optimistic removal: remove from UI immediately, revert on error
    setDocs((prev) => prev.filter((d) => d.id !== id));

    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) void fetchDocs();
    } catch {
      void fetchDocs();
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-3) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {[1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ padding: 'var(--space-3) 0', fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
        {fetchError}
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div style={{
        padding: 'var(--space-5) 0',
        fontSize: 'var(--text-xs)',
        color: 'var(--fg-muted)',
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        No documents yet. Upload a PDF or TXT file.
      </div>
    );
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', overflowY: 'auto', maxHeight: 220 }}>
      {docs.map((doc) => (
        <li
          key={doc.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-subtle)',
            transition: 'background var(--duration-fast)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'var(--bg-muted)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'var(--bg-subtle)'; }}
          className="group"
        >
          {/* Document name + metadata */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--fg-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }} title={doc.originalName}>
              {doc.originalName}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--fg-muted)', marginTop: 2 }}>
              {formatBytes(doc.fileSize)}
              {doc.pageCount != null && ` · ${doc.pageCount}p`}
            </p>
          </div>

          {/* Status badge */}
          <DocumentStatus status={doc.status} errorMessage={doc.errorMessage} />

          {/* Delete button — only shown when not pending */}
          {doc.status !== 'pending' && (
            <button
              onClick={() => void handleDelete(doc.id)}
              title="Remove document"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                color: 'var(--fg-muted)',
                padding: 'var(--space-1)',
                lineHeight: 1,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-muted)'; }}
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
