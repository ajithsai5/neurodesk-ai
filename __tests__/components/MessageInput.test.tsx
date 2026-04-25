// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '@/components/chat/MessageInput';
import { config } from '@/lib/config';
import { fireEvent } from '@testing-library/react';

afterEach(() => {
  vi.clearAllMocks();
});

describe('MessageInput', () => {
  // T027a — Enter key submits with trimmed text and clears input
  it('submits trimmed message on Enter and clears input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(React.createElement(MessageInput, { onSubmit, isLoading: false }));

    const textarea = screen.getByPlaceholderText('Type a message...');
    await user.type(textarea, '  Hello world  ');
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith('Hello world');
    // Input should be cleared after submit
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  // T027b — empty input does NOT call onSubmit
  it('does not call onSubmit when input is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(React.createElement(MessageInput, { onSubmit, isLoading: false }));

    const textarea = screen.getByPlaceholderText('Type a message...');
    await user.click(textarea);
    await user.keyboard('{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  // T027c — isLoading=true disables the textarea
  it('disables textarea when isLoading is true', () => {
    const onSubmit = vi.fn();
    render(React.createElement(MessageInput, { onSubmit, isLoading: true }));

    const textarea = screen.getByPlaceholderText('Type a message...');
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
  });

  // T027d — isLoading=true disables the submit button and shows "Sending..."
  it('shows "Sending..." and disables submit button when loading', () => {
    render(React.createElement(MessageInput, { onSubmit: vi.fn(), isLoading: true }));
    const button = screen.getByText('Sending...');
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  // T027e — Shift+Enter inserts a newline instead of submitting
  it('inserts newline on Shift+Enter instead of submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(React.createElement(MessageInput, { onSubmit, isLoading: false }));

    const textarea = screen.getByPlaceholderText('Type a message...');
    await user.type(textarea, 'line1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  // T027f — form submit button click triggers onSubmit
  it('submits when Send button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(React.createElement(MessageInput, { onSubmit, isLoading: false }));

    const textarea = screen.getByPlaceholderText('Type a message...');
    await user.type(textarea, 'Hello via button');
    const btn = screen.getByText('Send');
    await user.click(btn);

    expect(onSubmit).toHaveBeenCalledWith('Hello via button');
  });

  // ─────────────────────────────────────────────────────────────────
  // Coverage backfill — over-limit branch (lines 113-117),
  // canSubmit=false form-submit guard (line 41), and keydown guard.
  // ─────────────────────────────────────────────────────────────────

  it('does not call onSubmit when form submits with empty input (canSubmit=false guard)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(React.createElement(MessageInput, { onSubmit, isLoading: false }));
    // Submit button is disabled when empty — submit the form via JS to bypass the disabled attr
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the over-limit error and disables submit when value exceeds maxMessageLength', () => {
    const onSubmit = vi.fn();
    render(React.createElement(MessageInput, { onSubmit, isLoading: false }));
    const textarea = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement;

    // fireEvent.change is much faster than user.type for 10k+ characters.
    fireEvent.change(textarea, { target: { value: 'x'.repeat(config.maxMessageLength + 1) } });

    // Inline error renders
    expect(
      screen.getByText(
        new RegExp(`exceeds ${config.maxMessageLength.toLocaleString()} character limit`, 'i')
      )
    ).toBeTruthy();
    // Send button is disabled
    expect((screen.getByText('Send') as HTMLButtonElement).disabled).toBe(true);

    // Pressing Enter must not submit when over the limit
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
