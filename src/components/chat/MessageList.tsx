// File: src/components/chat/MessageList.tsx
/**
 * Message List Component
 * Renders the scrollable list of chat messages in a conversation.
 * Auto-scrolls to the bottom when new messages arrive.
 * Shows an empty state prompt when no messages exist yet.
 * (Why: handles message rendering, scroll behavior, and empty state in one place)
 */

'use client';

import { useEffect, useRef } from 'react';
import { StreamingMessage } from './StreamingMessage';
import type { Message } from 'ai';
import type { Citation } from '@/modules/rag';

// @field messages - Array of messages from the Vercel AI SDK useChat hook
// @field isLoading - Whether the AI is currently generating a response
interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

// Extract Citation objects from a useChat message's annotations array.
// The chat route encodes citations as { citations: Citation[] } in a message annotation.
// Returns an empty array when no annotation is present or when the message has no sources.
function extractCitations(annotations?: Message['annotations']): Citation[] {
  if (!annotations) return [];
  for (const annotation of annotations) {
    if (annotation && typeof annotation === 'object' && 'citations' in annotation) {
      const cits = (annotation as unknown as { citations: Citation[] }).citations;
      if (Array.isArray(cits)) return cits;
    }
  }
  return [];
}

// Render the scrollable message list with auto-scroll and empty state
// @param messages - Chat messages to display
// @param isLoading - Controls streaming cursor on the last assistant message
export function MessageList({ messages, isLoading }: MessageListProps) {
  // Ref to an invisible div at the bottom of the list for scroll targeting
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change (new message or streaming update)
  // (Why: keeps the most recent message visible without manual scrolling)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show empty state when no messages exist yet
  // (Why: guides the user to start typing instead of showing a blank area)
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="text-lg font-medium">Start a conversation</p>
          <p className="text-sm mt-1">Type a message below to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
      {messages.map((msg, i) => {
        // Only the last assistant message gets the streaming cursor while loading
        // (Why: indicates which message is actively being generated)
        const isLastAssistant =
          msg.role === 'assistant' && i === messages.length - 1 && isLoading;

        // Extract citations from the message annotation added by the chat route (US4)
        const citations = msg.role === 'assistant' ? extractCitations(msg.annotations) : [];

        return (
          <StreamingMessage
            key={msg.id}
            content={msg.content}
            role={msg.role as 'user' | 'assistant'}
            isStreaming={isLastAssistant}
            citations={citations}
          />
        );
      })}
      {/* Invisible scroll anchor at the bottom of the message list */}
      <div ref={bottomRef} />
    </div>
  );
}
