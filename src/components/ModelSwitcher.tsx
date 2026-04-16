'use client';

import { useState, useEffect, useRef } from 'react';
import type { ProviderConfig } from '@/modules/shared/types';

interface ModelSwitcherProps {
  selectedProviderId: string | null;
  onSelect: (providerId: string) => void;
}

export function ModelSwitcher({ selectedProviderId, onSelect }: ModelSwitcherProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/providers')
      .then((res) => res.json())
      .then((data) => setProviders(data.providers))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = providers.find((p) => p.id === selectedProviderId);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <span>{selected?.displayName ?? 'Select Model'}</span>
        <span className="text-xs text-slate-400">&#9662;</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[220px]">
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => {
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
