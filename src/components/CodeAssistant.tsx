// File: src/components/CodeAssistant.tsx
/**
 * CodeAssistant — Two-tab UI for code generation and explanation.
 *
 * Generate tab: user enters a language + description → gets generated code back.
 * Explain tab: user pastes code (+ optional language) → gets a plain-English explanation.
 *
 * Both operations call the /api/code/* routes; results are displayed in a
 * scrollable output area below the form.
 * (Why: stateless UI — no conversation needed; each request is independent)
 */

'use client';

import { useState } from 'react';

type Tab = 'generate' | 'explain';

// ─── Component ────────────────────────────────────────────────────────────────

export function CodeAssistant() {
  const [activeTab, setActiveTab] = useState<Tab>('generate');

  // Generate state
  const [genLanguage, setGenLanguage] = useState('');
  const [genDescription, setGenDescription] = useState('');
  const [genResult, setGenResult] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  // Explain state
  const [expCode, setExpCode] = useState('');
  const [expLanguage, setExpLanguage] = useState('');
  const [expResult, setExpResult] = useState<string | null>(null);
  const [expError, setExpError] = useState<string | null>(null);
  const [expLoading, setExpLoading] = useState(false);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenResult(null);
    setGenError(null);
    setGenLoading(true);
    try {
      const res = await fetch('/api/code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: genLanguage, description: genDescription }),
      });
      const data = await res.json() as { code?: string; error?: unknown };
      if (!res.ok) {
        setGenError(`Request failed (${res.status})`);
      } else {
        setGenResult(data.code ?? '');
      }
    } catch {
      setGenError('Failed to reach the server. Please try again.');
    } finally {
      setGenLoading(false);
    }
  }

  async function handleExplain(e: React.FormEvent) {
    e.preventDefault();
    setExpResult(null);
    setExpError(null);
    setExpLoading(true);
    try {
      const res = await fetch('/api/code/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: expCode,
          ...(expLanguage && { language: expLanguage }),
        }),
      });
      const data = await res.json() as { explanation?: string; error?: unknown };
      if (!res.ok) {
        setExpError(`Request failed (${res.status})`);
      } else {
        setExpResult(data.explanation ?? '');
      }
    } catch {
      setExpError('Failed to reach the server. Please try again.');
    } finally {
      setExpLoading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('generate')}
          className={`px-4 py-1.5 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'generate'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Generate
        </button>
        <button
          onClick={() => setActiveTab('explain')}
          className={`px-4 py-1.5 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'explain'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Explain
        </button>
      </div>

      {/* ── Generate tab ── */}
      {activeTab === 'generate' && (
        <form onSubmit={handleGenerate} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Language (e.g. typescript, python)"
            value={genLanguage}
            onChange={(e) => setGenLanguage(e.target.value)}
            required
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <textarea
            placeholder="Description — describe what code to generate"
            value={genDescription}
            onChange={(e) => setGenDescription(e.target.value)}
            required
            rows={4}
            maxLength={2000}
            className="border border-slate-300 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={genLoading}
            className="self-start px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {genLoading ? 'Generating…' : 'Generate Code'}
          </button>

          {genError && (
            <p className="text-red-600 text-sm">{genError}</p>
          )}

          {genResult !== null && (
            <pre className="mt-2 bg-slate-900 text-slate-100 rounded p-4 text-xs overflow-auto whitespace-pre-wrap">
              {genResult}
            </pre>
          )}
        </form>
      )}

      {/* ── Explain tab ── */}
      {activeTab === 'explain' && (
        <form onSubmit={handleExplain} className="flex flex-col gap-3">
          <textarea
            placeholder="Paste your code here to explain"
            value={expCode}
            onChange={(e) => setExpCode(e.target.value)}
            required
            rows={8}
            maxLength={10000}
            className="border border-slate-300 rounded px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="text"
            placeholder="Language (optional, e.g. rust)"
            value={expLanguage}
            onChange={(e) => setExpLanguage(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={expLoading}
            className="self-start px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {expLoading ? 'Explaining…' : 'Explain Code'}
          </button>

          {expError && (
            <p className="text-red-600 text-sm">{expError}</p>
          )}

          {expResult !== null && (
            <div className="mt-2 bg-slate-50 border border-slate-200 rounded p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {expResult}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
