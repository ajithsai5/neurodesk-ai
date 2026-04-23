// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonaSelector } from '@/components/PersonaSelector';

const fakePersonas = [
  { id: 'p1', name: 'Tutor', description: 'Explains concepts clearly' },
  { id: 'p2', name: 'Coder', description: 'Writes clean code' },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ personas: fakePersonas }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('PersonaSelector', () => {
  // T028a — renders trigger button with placeholder when no selection
  it('renders trigger button with "Select Persona" placeholder', () => {
    render(React.createElement(PersonaSelector, { selectedPersonaId: null, onSelect: vi.fn() }));
    expect(screen.getByText('Select Persona')).toBeTruthy();
  });

  // T028b — fetches personas and shows them in dropdown after clicking trigger
  it('shows personas in dropdown when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(React.createElement(PersonaSelector, { selectedPersonaId: null, onSelect: vi.fn() }));

    // Wait for the fetch to complete
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/personas'));

    // Click the trigger button to open the dropdown
    const trigger = screen.getByText('Select Persona');
    await user.click(trigger);

    expect(screen.getByText('Tutor')).toBeTruthy();
    expect(screen.getByText('Explains concepts clearly')).toBeTruthy();
  });

  // T028c — clicking a persona calls onSelect with its ID and closes dropdown
  it('calls onSelect with persona ID when persona is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(React.createElement(PersonaSelector, { selectedPersonaId: null, onSelect }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    // Open dropdown
    await user.click(screen.getByText('Select Persona'));
    // Click Tutor persona
    await user.click(screen.getByText('Tutor'));

    expect(onSelect).toHaveBeenCalledWith('p1');
    // Dropdown should close after selection
    expect(screen.queryByText('Explains concepts clearly')).toBeNull();
  });

  // T028d — shows selected persona name when selectedPersonaId is set
  it('shows selected persona name when selectedPersonaId is provided', async () => {
    render(React.createElement(PersonaSelector, { selectedPersonaId: 'p1', onSelect: vi.fn() }));

    // After personas load, the button should show the selected name
    await waitFor(() => expect(screen.getByText('Tutor')).toBeTruthy());
  });
});
