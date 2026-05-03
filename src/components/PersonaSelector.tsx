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
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger button showing current persona name */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn--ghost btn--sm"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <span>{selected?.name ?? 'Select Persona'}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>

      {/* Dropdown menu listing all personas with name and description */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 'var(--space-1)',
          zIndex: 20,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-1) 0',
          minWidth: 220,
        }}>
          {personas.map((persona) => (
            <button
              key={persona.id}
              onClick={() => {
                onSelect(persona.id);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-2) var(--space-4)',
                background: persona.id === selectedPersonaId ? 'var(--color-accent-50)' : 'transparent',
                color: persona.id === selectedPersonaId ? 'var(--color-accent-700)' : 'var(--fg-primary)',
                border: 'none',
                cursor: 'pointer',
                display: 'block',
              }}
              data-selected={persona.id === selectedPersonaId ? 'true' : undefined}
              onMouseEnter={(e) => {
                if (persona.id !== selectedPersonaId) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)';
                }
              }}
              onMouseLeave={(e) => {
                if (persona.id !== selectedPersonaId) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }
              }}
            >
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{persona.name}</p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginTop: 2 }}>{persona.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
