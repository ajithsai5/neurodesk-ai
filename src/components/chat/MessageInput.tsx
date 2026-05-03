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
    <form
      onSubmit={handleSubmit}
      style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: 'var(--space-4) var(--space-5)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="input"
            style={{
              width: '100%',
              resize: 'none',
              paddingRight: 64,
              minHeight: 44,
              maxHeight: 200,
              display: 'block',
            }}
            disabled={isLoading}
          />
          {/* Character counter — turns red when over the limit */}
          <span
            style={{
              position: 'absolute',
              bottom: 'var(--space-2)',
              right: 'var(--space-3)',
              fontSize: 'var(--text-xs)',
              color: isOverLimit ? 'var(--color-danger)' : 'var(--fg-muted)',
              fontWeight: isOverLimit ? 'var(--weight-medium)' : undefined,
              pointerEvents: 'none',
            }}
          >
            {charCount.toLocaleString()}/{config.maxMessageLength.toLocaleString()}
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn--primary"
          style={{ flexShrink: 0, minWidth: 72 }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
      {/* Over-limit error message shown below the input */}
      {isOverLimit && (
        <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', marginBottom: 0 }}>
          Message exceeds {config.maxMessageLength.toLocaleString()} character limit
        </p>
      )}
    </form>
  );
}
