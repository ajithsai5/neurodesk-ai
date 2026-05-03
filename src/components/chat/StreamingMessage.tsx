// File: src/components/chat/StreamingMessage.tsx
/**
 * Streaming Message Component
 * Renders a single chat message bubble with different styling for user vs assistant.
 * Assistant messages are rendered as Markdown with syntax highlighting.
 * Displays a streaming cursor animation while the AI response is being generated.
 * (Why: separating message rendering allows consistent styling and streaming UX)
 */

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CitationPanel } from '@/components/CitationPanel';
import type { Citation } from '@/modules/rag';

// @field content - The message text to display
// @field role - Whether this is a user or assistant message (controls styling)
// @field isStreaming - Whether the assistant is still generating this message
// @field citations - Source citations to display below assistant messages (US4)
interface StreamingMessageProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean;
  citations?: Citation[];
}

// Render a single chat message bubble with role-based styling
// User messages appear right-aligned in accent color; assistant messages left-aligned with markdown
// @param content - Message text content
// @param role - 'user' or 'assistant' — determines alignment and styling
// @param isStreaming - Adds a cursor animation to the last assistant message while generating
// @param citations - Source citations shown in a collapsible panel below the message
// Markdown link renderer — blocks javascript: and data: URIs to prevent XSS
// (Why: react-markdown with remark-gfm renders <a href="..."> from AI output verbatim;
//  without this guard a prompt-injected "javascript:" link would execute in the page origin)
const markdownComponents = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => {
    const safe = href?.startsWith('http://') || href?.startsWith('https://') || href?.startsWith('/') || href?.startsWith('#');
    if (!safe) return <span title={href ?? ''}>{children}</span>;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export function StreamingMessage({ content, role, isStreaming, citations = [] }: StreamingMessageProps) {
  const isUser = role === 'user';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 'var(--space-4)',
    }}>
      <div
        style={{
          maxWidth: '80%',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3) var(--space-4)',
          ...(isUser
            ? {
                background: 'var(--color-accent-600)',
                color: '#fff',
              }
            : {
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--fg-primary)',
              }),
        }}
      >
        {/* User messages render as plain text; assistant messages render as Markdown */}
        {/* (Why: user input is shown verbatim, but AI responses contain code blocks and formatting) */}
        {isUser ? (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 'var(--text-sm)' }}>{content}</p>
        ) : (
          <>
            <div className={`prose prose-sm max-w-none ${isStreaming ? 'streaming-cursor' : ''}`}>
              {/* ReactMarkdown with GFM tables/strikethrough and code syntax highlighting */}
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
            </div>
            {/* CitationPanel renders below the message text when sources are available (US4) */}
            <CitationPanel citations={citations} />
          </>
        )}
      </div>
    </div>
  );
}
