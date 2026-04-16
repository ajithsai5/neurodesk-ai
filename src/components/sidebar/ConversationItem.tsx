// File: src/components/sidebar/ConversationItem.tsx
/**
 * Conversation Item Component
 * Renders a single conversation entry in the sidebar with inline rename editing
 * and a context menu for rename, archive, and delete actions.
 * (Why: encapsulates per-item UI logic so the Sidebar component stays clean)
 */

'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';

// @field id - Conversation UUID for identifying which item to act on
// @field title - Display title shown in the sidebar
// @field updatedAt - ISO timestamp for showing relative date
// @field isActive - Whether this conversation is currently selected
// @field onSelect - Callback when the item is clicked (navigates to this conversation)
// @field onRename - Callback with new title when rename is confirmed
// @field onDelete - Callback to delete this conversation
// @field onArchive - Callback to toggle archive status
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

// Render a conversation sidebar item with inline editing and context menu
// Supports: click to select, inline title editing, and 3-dot menu for actions
// @param props - ConversationItemProps with callbacks for each user action
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
  // State for inline rename editing mode
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  // State for the 3-dot context menu visibility
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Enter edit mode: populate input with current title and focus it
  // (Why: auto-focus provides immediate keyboard input without extra clicks)
  const handleStartEdit = useCallback(() => {
    setEditValue(title);
    setIsEditing(true);
    setShowMenu(false);
    // setTimeout needed because the input isn't rendered yet during this callback
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [title]);

  // Save the edited title if it changed, then exit edit mode
  // (Why: only calls onRename if the title actually changed to avoid unnecessary API calls)
  const handleSaveEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(id, trimmed);
    }
    setIsEditing(false);
  }, [editValue, title, id, onRename]);

  // Handle keyboard events in edit mode: Enter saves, Escape cancels
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveEdit();
      if (e.key === 'Escape') setIsEditing(false);
    },
    [handleSaveEdit]
  );

  // Format the updatedAt timestamp as a short date (e.g., "Apr 16")
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
        {/* Show inline edit input when editing, otherwise show title + date */}
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

      {/* Context menu trigger — only visible on hover, hidden during editing */}
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

          {/* Dropdown context menu with Rename, Archive, Delete actions */}
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
