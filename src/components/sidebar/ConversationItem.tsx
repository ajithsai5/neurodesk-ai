'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';

interface ConversationItemProps {
  id: string;
  title: string;
  updatedAt: string;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

export function ConversationItem({
  id,
  title,
  updatedAt,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onArchive,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = useCallback(() => {
    setEditValue(title);
    setIsEditing(true);
    setShowMenu(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [title]);

  const handleSaveEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(id, trimmed);
    }
    setIsEditing(false);
  }, [editValue, title, id, onRename]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveEdit();
      if (e.key === 'Escape') setIsEditing(false);
    },
    [handleSaveEdit]
  );

  const formattedDate = new Date(updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-100 text-slate-700'
      }`}
      onClick={() => !isEditing && onSelect(id)}
    >
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            className="w-full text-sm bg-white border border-blue-300 rounded px-2 py-0.5 focus:outline-none"
            maxLength={200}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-xs text-slate-400">{formattedDate}</p>
          </>
        )}
      </div>

      {!isEditing && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-400 text-xs transition-opacity"
          >
            &#8942;
          </button>

          {showMenu && (
            <div className="absolute right-0 top-6 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[120px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit();
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(id);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Archive
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(id);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
