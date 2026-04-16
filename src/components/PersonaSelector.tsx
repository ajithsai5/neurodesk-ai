'use client';

import { useState, useEffect, useRef } from 'react';
import type { PersonaListItem } from '@/modules/shared/types';

interface PersonaSelectorProps {
  selectedPersonaId: string | null;
  onSelect: (personaId: string) => void;
}

export function PersonaSelector({ selectedPersonaId, onSelect }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/personas')
      .then((res) => res.json())
      .then((data) => setPersonas(data.personas))
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

  const selected = personas.find((p) => p.id === selectedPersonaId);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <span>{selected?.name ?? 'Select Persona'}</span>
        <span className="text-xs text-slate-400">&#9662;</span>
      </button>

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
