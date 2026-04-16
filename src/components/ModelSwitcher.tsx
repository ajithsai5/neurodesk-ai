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
    <div ref={dropdownRef} className="relative">
      {/* Toggle button shows selected model name or placeholder */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <span>{selected?.displayName ?? 'Select Model'}</span>
        <span className="text-xs text-slate-400">&#9662;</span>
      </button>

      {/* Dropdown list of providers — only shown when isOpen is true */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[220px]">
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
              className={`w-full text-left px-3 py-2 ${
                !provider.isAvailable
                  ? 'opacity-50 cursor-not-allowed'
                  : provider.id === selectedProviderId
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-slate-50'
              }`}
            >
              <p className="text-sm font-medium">{provider.displayName}</p>
              {/* Show unavailable badge for providers that can't be used */}
              {!provider.isAvailable && (
                <p className="text-xs text-red-500">Unavailable</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
