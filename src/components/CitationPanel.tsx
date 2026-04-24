// File: src/components/CitationPanel.tsx
/**
 * CitationPanel — Collapsible "Sources" section rendered below assistant messages.
 * Displays each retrieved document chunk as a [DocumentName, Page N] citation with
 * an expandable excerpt so users can verify the source passage.
 * (Why: US4 — citations must be visible and verifiable, not just embedded in prose)
 */

'use client';

import { useState } from 'react';
import type { Citation } from '@/modules/rag';

// @field citations - Array of source citations returned with the assistant message
interface Props {
  citations: Citation[];
}

// Render a collapsible sources panel below an assistant message bubble
// Shows a "Sources (N)" toggle; each citation lists document name, page, and excerpt
export function CitationPanel({ citations }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Nothing to show when no citations were retrieved
  if (citations.length === 0) return null;

  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      {/* Toggle button — shows count and expand/collapse indicator */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <span>{expanded ? '▾' : '▸'}</span>
        Sources ({citations.length})
      </button>

      {/* Citation list — only rendered when expanded */}
      {expanded && (
        <ul className="mt-2 space-y-2">
          {citations.map((c, i) => (
            <li
              key={i}
              className="text-xs border border-slate-200 rounded p-2 bg-slate-50"
            >
              {/* Citation header: [DocumentName, Page N] */}
              <p className="font-medium text-slate-700">
                [{c.documentName}, Page {c.pageNumber}]
              </p>
              {/* Excerpt — clamped to 3 lines to keep the panel compact */}
              <p className="text-slate-500 mt-1 line-clamp-3">{c.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
