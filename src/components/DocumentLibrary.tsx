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
      if (!res.ok) {
        // Revert: re-fetch the true list
        void fetchDocs();
      }
    } catch {
      void fetchDocs();
    }
  }

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400">Loading documents…</div>
    );
  }

  if (fetchError) {
    return (
      <div className="px-3 py-2 text-xs text-red-500">{fetchError}</div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400 italic">
        No documents yet. Upload a PDF or TXT file.
      </div>
    );
  }

  return (
    <ul className="px-2 space-y-1 overflow-y-auto max-h-52 scrollbar-thin">
      {docs.map((doc) => (
        <li
          key={doc.id}
          className="flex items-start gap-2 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 group transition-colors"
        >
          {/* Document name + metadata */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs text-slate-800 truncate font-medium"
              title={doc.originalName}
            >
              {doc.originalName}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
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
              className="text-slate-400 hover:text-red-500 transition-colors text-xs opacity-0 group-hover:opacity-100"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
