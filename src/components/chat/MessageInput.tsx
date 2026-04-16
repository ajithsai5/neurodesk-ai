'use client';

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { config } from '@/lib/config';

interface MessageInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
}

export function MessageInput({ onSubmit, isLoading }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = value.length;
  const isOverLimit = charCount > config.maxMessageLength;
  const isEmpty = value.trim().length === 0;
  const canSubmit = !isEmpty && !isOverLimit && !isLoading;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      onSubmit(value.trim());
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
    [canSubmit, value, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSubmit) {
          onSubmit(value.trim());
          setValue('');
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
        }
      }
    },
    [canSubmit, value, onSubmit]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize textarea
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, []);

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4 bg-white">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <span
            className={`absolute bottom-2 right-3 text-xs ${
              isOverLimit ? 'text-red-500 font-medium' : 'text-slate-400'
            }`}
          >
            {charCount.toLocaleString()}/{config.maxMessageLength.toLocaleString()}
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
      {isOverLimit && (
        <p className="text-red-500 text-xs mt-1">
          Message exceeds {config.maxMessageLength.toLocaleString()} character limit
        </p>
      )}
    </form>
  );
}
