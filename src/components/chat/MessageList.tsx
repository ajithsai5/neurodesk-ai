'use client';

import { useEffect, useRef } from 'react';
import { StreamingMessage } from './StreamingMessage';
import type { Message } from 'ai';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        const isLastAssistant =
          msg.role === 'assistant' && i === messages.length - 1 && isLoading;

        return (
          <StreamingMessage
            key={msg.id}
            content={msg.content}
            role={msg.role as 'user' | 'assistant'}
            isStreaming={isLastAssistant}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
