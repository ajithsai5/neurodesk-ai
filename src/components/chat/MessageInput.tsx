// File: src/components/chat/MessageInput.tsx
/**
 * Message Input Component
 * Auto-resizing textarea with character counter, Enter-to-send, and validation.
 * Enforces the max message length from config and disables during streaming.
 * (Why: provides a polished chat input UX with guardrails matching server-side validation)
 */

'use client';

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { config } from '@/lib/config';

// @field onSubmit - Callback with the trimmed message text when user sends
// @field isLoading - Disables input and shows "Sending..." while AI is responding
interface MessageInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
}

// Render the chat input form with auto-resizing textarea and character counter
// Handles both button click and Enter key submission (Shift+Enter for newlines)
// @param onSubmit - Called with trimmed message text on valid submission
// @param isLoading - Controls disabled state during AI response generation
export function MessageInput({ onSubmit, isLoading }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute validation state for submit button and error display
  const charCount = value.length;
  const isOverLimit = charCount > config.maxMessageLength;
  const isEmpty = value.trim().length === 0;
  // Submit requires non-empty, within limit, and not currently loading
  const canSubmit = !isEmpty && !isOverLimit && !isLoading;

  // Handle form submission via button click
  // Trims the message, clears the input, and resets textarea height
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      onSubmit(value.trim());
      setValue('');
      // Reset textarea height after clearing content
      // (Why: auto-resize grows the textarea, but clearing content should shrink it back)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
    [canSubmit, value, onSubmit]
  );

  // Handle Enter key to submit (Shift+Enter inserts a newline instead)
  // (Why: common chat UX pattern — Enter sends, Shift+Enter adds a new line)
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

  // Handle textarea input changes with auto-resize
  // (Why: textarea grows with content up to 200px max, then scrolls internally)
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize textarea to fit content, capped at 200px
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
          {/* Character counter — turns red when over the limit */}
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
      {/* Over-limit error message shown below the input */}
      {isOverLimit && (
        <p className="text-red-500 text-xs mt-1">
          Message exceeds {config.maxMessageLength.toLocaleString()} character limit
        </p>
      )}
    </form>
  );
}
