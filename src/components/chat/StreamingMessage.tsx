// File: src/components/chat/StreamingMessage.tsx
/**
 * Streaming Message Component
 * Renders a single chat message bubble with different styling for user vs assistant.
 * Assistant messages are rendered as Markdown with syntax highlighting.
 * Displays a streaming cursor animation while the AI response is being generated.
 * (Why: separating message rendering allows consistent styling and streaming UX)
 */

'use client';

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
// User messages appear right-aligned in blue; assistant messages left-aligned with markdown rendering
// @param content - Message text content
// @param role - 'user' or 'assistant' — determines alignment and styling
// @param isStreaming - Adds a cursor animation to the last assistant message while generating
// @param citations - Source citations shown in a collapsible panel below the message
export function StreamingMessage({ content, role, isStreaming, citations = [] }: StreamingMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white border border-slate-200 text-slate-800'
        }`}
      >
        {/* User messages render as plain text; assistant messages render as Markdown */}
        {/* (Why: user input is shown verbatim, but AI responses contain code blocks and formatting) */}
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <>
            <div className={`prose prose-sm max-w-none ${isStreaming ? 'streaming-cursor' : ''}`}>
              {/* ReactMarkdown with GFM tables/strikethrough and code syntax highlighting */}
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
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
