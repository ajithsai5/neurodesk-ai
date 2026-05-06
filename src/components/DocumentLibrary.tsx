// File: src/components/DocumentLibrary.tsx
/**
 * DocumentLibrary — Lists all uploaded documents with status badges and delete controls.
 * Fetches GET /api/documents on mount, polls every 3 s while any document is pending,
 * and optimistically removes documents when the user clicks delete.
 * F004 additions:
 *  - T025: LibraryUsageBar shows count/50 docs and MB/500 MB usage
 *  - T026: 3 s poll interval; stops when all docs are ready/failed
 *  - T027: colour badge dot per document row from badgeColour field
 *  - T029: completion toast when a document transitions pending → ready
 *  - T059: filter checkbox per document row; "Filtering: N docs" indicator vs "All documents"
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
  /** F004 T027: hex badge colour assigned at upload time */
  badgeColour: string;
}

// T025: Library usage returned by GET /api/documents
interface LibraryUsage {
  count: number;
  totalBytes: number;
  maxCount: number;
  maxBytes: number;
}

interface Props {
  /** Incremented by parent to trigger a fresh fetch (e.g., after a new upload) */
  refreshKey?: number;
  /**
   * T059/T060: Called whenever the active document filter changes.
   * Empty array means "no filter active" (all documents are in scope).
   */
  onFilterChange?: (selectedDocumentIds: number[]) => void;
}

// T026: poll every 3 s while any doc is pending (was 2 s)
const POLL_INTERVAL_MS = 3000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// T025: LibraryUsageBar — shows count/50 docs and storage consumed
// ---------------------------------------------------------------------------
function LibraryUsageBar({ usage }: { usage: LibraryUsage }) {
  const countPct = Math.min(100, (usage.count / usage.maxCount) * 100);
  const bytesPct = Math.min(100, (usage.totalBytes / usage.maxBytes) * 100);
  const nearLimitCount = countPct >= 80;
  const nearLimitBytes = bytesPct >= 80;

  return (
    <div style={{ marginBottom: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {/* Document count bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 10, color: nearLimitCount ? 'var(--color-warning, #D4A842)' : 'var(--fg-muted)' }}>
            {usage.count} / {usage.maxCount} documents
          </span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-muted)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${countPct}%`,
            borderRadius: 2,
            background: nearLimitCount ? 'var(--color-warning, #D4A842)' : 'var(--color-accent)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
      {/* Storage bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 10, color: nearLimitBytes ? 'var(--color-warning, #D4A842)' : 'var(--fg-muted)' }}>
            {formatBytes(usage.totalBytes)} / {formatBytes(usage.maxBytes)}
          </span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-muted)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${bytesPct}%`,
            borderRadius: 2,
            background: nearLimitBytes ? 'var(--color-warning, #D4A842)' : 'var(--color-accent)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// T029: Toast — small pop-up shown when a doc becomes ready
// ---------------------------------------------------------------------------
interface Toast {
  id: number;
  message: string;
}

let toastSeq = 0;

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--space-2)' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-success-subtle, #d4edda)',
            border: '1px solid var(--color-success, #67B88F)',
            fontSize: 11,
            color: 'var(--color-success-fg, #1a5c35)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>✓</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentLibrary
// ---------------------------------------------------------------------------

// DocumentLibrary fetches and displays the document list, polling for pending status changes.
export function DocumentLibrary({ refreshKey = 0, onFilterChange }: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [usage, setUsage] = useState<LibraryUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // T029: toast queue for ready transitions
  const [toasts, setToasts] = useState<Toast[]>([]);
  // T059: set of checked document IDs; empty = no filter (all docs)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // T029: track previous statuses to detect pending → ready transitions
  const prevStatusRef = useRef<Map<number, DocumentRecord['status']>>(new Map());
  // T059: stable ref to onFilterChange so callbacks don't re-trigger effects
  const onFilterChangeRef = useRef(onFilterChange);
  useEffect(() => { onFilterChangeRef.current = onFilterChange; }, [onFilterChange]);

  // T059: toggle a document's checked state and notify parent
  const toggleCheck = useCallback((id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Notify parent — empty array signals "no filter active"
      onFilterChangeRef.current?.(Array.from(next));
      return next;
    });
  }, []);

  const addToast = useCallback((message: string) => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, message }]);
    // Auto-dismiss after 4 s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { documents: DocumentRecord[]; usage?: LibraryUsage };
      const incoming = data.documents;

      // T029: detect pending → ready transitions and fire toasts
      incoming.forEach((doc) => {
        const prev = prevStatusRef.current.get(doc.id);
        if (prev === 'pending' && doc.status === 'ready') {
          addToast(`"${doc.originalName}" is ready`);
        }
      });

      // Update previous status map for next poll cycle
      prevStatusRef.current = new Map(incoming.map((d) => [d.id, d.status]));

      setDocs(incoming);
      if (data.usage) setUsage(data.usage);
      setFetchError(null);
    } catch (err) {
      setFetchError('Failed to load documents.');
      console.error('[DocumentLibrary] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Initial fetch + re-fetch when parent signals a new upload
  useEffect(() => {
    setLoading(true);
    void fetchDocs();
  }, [fetchDocs, refreshKey]);

  // T026: Poll while any document is pending (stop once all are settled)
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
    // Also remove from prev status map so the deleted doc doesn't fire a toast
    prevStatusRef.current.delete(id);

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

  return (
    <div>
      {/* T025: Library usage bars */}
      {usage && <LibraryUsageBar usage={usage} />}

      {/* T029: Toast notifications */}
      <ToastStack toasts={toasts} />

      {docs.length === 0 ? (
        <div style={{
          padding: 'var(--space-5) 0',
          fontSize: 'var(--text-xs)',
          color: 'var(--fg-muted)',
          fontStyle: 'italic',
          textAlign: 'center',
        }}>
          No documents yet. Upload a PDF or TXT file.
        </div>
      ) : (
        <>
          {/* T059: filter indicator — shows when subset is selected */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 'var(--space-2)', fontSize: 10, color: 'var(--fg-muted)',
          }}>
            <span style={{ fontStyle: checkedIds.size > 0 ? 'normal' : 'italic' }}>
              {checkedIds.size > 0
                ? `Filtering: ${checkedIds.size} doc${checkedIds.size > 1 ? 's' : ''}`
                : 'All documents'}
            </span>
            {checkedIds.size > 0 && (
              <button
                onClick={() => { setCheckedIds(new Set()); onFilterChangeRef.current?.([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--color-accent)', padding: 0 }}
              >
                Clear filter
              </button>
            )}
          </div>
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
              {/* T059: filter checkbox — only for ready docs (pending can't be selected) */}
              {doc.status === 'ready' && (
                <input
                  type="checkbox"
                  checked={checkedIds.has(doc.id)}
                  onChange={() => toggleCheck(doc.id)}
                  title={checkedIds.has(doc.id) ? 'Remove from filter' : 'Add to filter'}
                  style={{ flexShrink: 0, marginTop: 2, accentColor: doc.badgeColour || 'var(--color-accent)', cursor: 'pointer' }}
                />
              )}

              {/* T027: Colour badge dot from BADGE_PALETTE */}
              {doc.badgeColour && (
                <span
                  title={`Document colour: ${doc.badgeColour}`}
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: doc.badgeColour,
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                />
              )}

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
                  {/* T026: inline spinner while ingesting */}
                  {doc.status === 'pending' && (
                    <span style={{ marginLeft: 4, display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                  )}
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
        </>
      )}
    </div>
  );
}
