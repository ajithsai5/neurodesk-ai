// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSwitcher } from '@/components/ModelSwitcher';

const fakeProviders = [
  { id: 'pr1', providerName: 'openai', displayName: 'GPT-4o', isAvailable: true, sortOrder: 0 },
  { id: 'pr2', providerName: 'anthropic', displayName: 'Claude 3', isAvailable: false, sortOrder: 1 },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ providers: fakeProviders }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ModelSwitcher', () => {
  // T029a — renders trigger button with placeholder when no selection
  it('renders "Select Model" placeholder when no provider selected', () => {
    render(React.createElement(ModelSwitcher, { selectedProviderId: null, onSelect: vi.fn() }));
    expect(screen.getByText('Select Model')).toBeTruthy();
  });

  // T029b — fetches providers and shows them in dropdown after clicking trigger
  it('shows providers in dropdown when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(React.createElement(ModelSwitcher, { selectedProviderId: null, onSelect: vi.fn() }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/providers'));

    await user.click(screen.getByText('Select Model'));

    expect(screen.getByText('GPT-4o')).toBeTruthy();
    expect(screen.getByText('Claude 3')).toBeTruthy();
  });

  // T029c — clicking an available provider calls onSelect and closes dropdown
  it('calls onSelect with provider ID when available provider is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(React.createElement(ModelSwitcher, { selectedProviderId: null, onSelect }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await user.click(screen.getByText('Select Model'));
    await user.click(screen.getByText('GPT-4o'));

    expect(onSelect).toHaveBeenCalledWith('pr1');
    // Dropdown should close
    expect(screen.queryByText('Claude 3')).toBeNull();
  });

  // T029d — unavailable providers are shown but disabled (cannot be selected)
  it('shows unavailable badge for providers that are not available', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(React.createElement(ModelSwitcher, { selectedProviderId: null, onSelect }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await user.click(screen.getByText('Select Model'));

    // "Unavailable" badge should be visible for Claude 3
    expect(screen.getByText('Unavailable')).toBeTruthy();

    // Clicking unavailable provider should NOT call onSelect
    await user.click(screen.getByText('Claude 3'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  // T029e — shows selected provider name when selectedProviderId is set
  it('shows selected provider display name when selectedProviderId is provided', async () => {
    render(React.createElement(ModelSwitcher, { selectedProviderId: 'pr1', onSelect: vi.fn() }));
    await waitFor(() => expect(screen.getByText('GPT-4o')).toBeTruthy());
  });

  // Coverage: highlights the currently-selected provider in the dropdown list (line 88)
  it('highlights the currently-selected provider in the open dropdown', async () => {
    const user = userEvent.setup();
    render(React.createElement(ModelSwitcher, { selectedProviderId: 'pr1', onSelect: vi.fn() }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    // Open dropdown — the trigger label is now 'GPT-4o', not 'Select Model'
    const triggers = await screen.findAllByText('GPT-4o');
    await user.click(triggers[0]);
    // Both items render; the selected one carries data-selected="true"
    const items = screen.getAllByText('GPT-4o');
    expect(items.some((el) => el.closest('button')?.getAttribute('data-selected') === 'true')).toBe(true);
  });

  // Coverage: outside-click closes the dropdown (lines 47-49)
  it('closes the dropdown when the user clicks outside', async () => {
    const user = userEvent.setup();
    render(
      React.createElement('div', null,
        React.createElement(ModelSwitcher, { selectedProviderId: null, onSelect: vi.fn() }),
        React.createElement('div', { 'data-testid': 'outside' }, 'outside'),
      )
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await user.click(screen.getByText('Select Model'));
    expect(screen.getByText('GPT-4o')).toBeTruthy();
    // Clicking truly outside the dropdown should close it
    await user.click(screen.getByTestId('outside'));
    await waitFor(() => expect(screen.queryByText('GPT-4o')).toBeNull());
  });

  // Coverage: clicking inside the dropdown does NOT close it (the contains-branch of click-outside)
  it('clicking inside the dropdown leaves it open', async () => {
    const user = userEvent.setup();
    render(React.createElement(ModelSwitcher, { selectedProviderId: null, onSelect: vi.fn() }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await user.click(screen.getByText('Select Model'));
    // The trigger button is inside dropdownRef — clicking the SAME button toggles, not closes via outside-click
    // Click the unavailable item which doesn't trigger onSelect → dropdown still open
    await user.click(screen.getByText('Claude 3'));
    // Dropdown remains open since the click was inside the ref
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });
});
