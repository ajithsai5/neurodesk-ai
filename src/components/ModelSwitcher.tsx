// File: src/components/ModelSwitcher.tsx
/**
 * Model Switcher — LLM Provider Dropdown
 * Dropdown button that fetches available LLM providers from the API
 * and lets the user switch which model powers the chat.
 * (Why: users need to select between providers like OpenAI/Anthropic per conversation)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import type { ProviderConfig } from '@/modules/shared/types';

// Props for the ModelSwitcher component
// @param selectedProviderId - Currently active provider ID (null if none selected)
// @param onSelect - Callback fired when user picks a different provider
interface ModelSwitcherProps {
  selectedProviderId: string | null;
  onSelect: (providerId: string) => void;
}

// Model switcher dropdown component
// Fetches providers on mount and renders a toggle-able dropdown list
// @param selectedProviderId - The currently active provider's ID
// @param onSelect - Callback when user selects a provider from the dropdown
// @returns A dropdown button with a list of available LLM providers
export function ModelSwitcher({ selectedProviderId, onSelect }: ModelSwitcherProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Ref for click-outside detection to close the dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available providers from API on mount
  // (Why: provider list comes from DB, not hardcoded — supports dynamic provider config)
  useEffect(() => {
    fetch('/api/providers')
      .then((res) => res.json())
      .then((data) => setProviders(data.providers))
      .catch(() => {});
  }, []);

  // Close dropdown when user clicks outside of it
  // (Why: standard UX pattern — dropdown should dismiss on outside click)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find the currently selected provider object for display
  const selected = providers.find((p) => p.id === selectedProviderId);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Toggle button shows selected model name or placeholder */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn--ghost btn--sm"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <span>{selected?.displayName ?? 'Select Model'}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>

      {/* Dropdown list of providers — only shown when isOpen is true */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 'var(--space-1)',
          zIndex: 20,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-1) 0',
          minWidth: 220,
        }}>
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => {
                // Only allow selection of available providers
                // (Why: unavailable providers are shown but disabled for visibility)
                if (provider.isAvailable) {
                  onSelect(provider.id);
                  setIsOpen(false);
                }
              }}
              disabled={!provider.isAvailable}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-2) var(--space-4)',
                background: provider.id === selectedProviderId ? 'var(--color-accent-50)' : 'transparent',
                color: !provider.isAvailable
                  ? 'var(--fg-disabled)'
                  : provider.id === selectedProviderId
                    ? 'var(--color-accent-700)'
                    : 'var(--fg-primary)',
                border: 'none',
                cursor: provider.isAvailable ? 'pointer' : 'not-allowed',
                opacity: provider.isAvailable ? 1 : 0.5,
                display: 'block',
              }}
              data-selected={provider.id === selectedProviderId ? 'true' : undefined}
              onMouseEnter={(e) => {
                if (provider.isAvailable && provider.id !== selectedProviderId) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)';
                }
              }}
              onMouseLeave={(e) => {
                if (provider.id !== selectedProviderId) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }
              }}
            >
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{provider.displayName}</p>
              {/* Show unavailable badge for providers that can't be used */}
              {!provider.isAvailable && (
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 2 }}>Unavailable</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
