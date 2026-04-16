// File: src/components/PersonaSelector.tsx
/**
 * Persona Selector Dropdown Component
 * Dropdown menu in the chat toolbar for switching the AI's persona (system prompt).
 * Fetches available personas from GET /api/personas on mount.
 * (Why: allows users to change the AI's behavior mid-conversation without starting a new chat)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import type { PersonaListItem } from '@/modules/shared/types';

// @field selectedPersonaId - Currently selected persona ID (highlights in dropdown)
// @field onSelect - Callback when a persona is selected from the dropdown
interface PersonaSelectorProps {
  selectedPersonaId: string | null;
  onSelect: (personaId: string) => void;
}

// Render a dropdown button that lists available personas with name and description
// Fetches persona list on mount and closes on outside click
// @param selectedPersonaId - ID of the currently active persona
// @param onSelect - Called with the new persona ID when user makes a selection
export function PersonaSelector({ selectedPersonaId, onSelect }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  // Ref for click-outside detection to close the dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available personas from the API on mount
  // (Why: personas are admin-managed and loaded once — no need to refetch)
  useEffect(() => {
    fetch('/api/personas')
      .then((res) => res.json())
      .then((data) => setPersonas(data.personas))
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside of it
  // (Why: standard dropdown UX — clicking elsewhere dismisses the menu)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find the currently selected persona for display in the trigger button
  const selected = personas.find((p) => p.id === selectedPersonaId);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button showing current persona name */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <span>{selected?.name ?? 'Select Persona'}</span>
        <span className="text-xs text-slate-400">&#9662;</span>
      </button>

      {/* Dropdown menu listing all personas with name and description */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[220px]">
          {personas.map((persona) => (
            <button
              key={persona.id}
              onClick={() => {
                onSelect(persona.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                persona.id === selectedPersonaId ? 'bg-blue-50 text-blue-700' : ''
              }`}
            >
              <p className="text-sm font-medium">{persona.name}</p>
              <p className="text-xs text-slate-500">{persona.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
