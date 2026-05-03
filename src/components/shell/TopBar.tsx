'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

export function TopBar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => setMounted(true), []);

  function cycleTheme() {
    if (resolvedTheme === 'light') setTheme('dark');
    else setTheme('light');
  }

  return (
    <div className="topbar">
      <div className="topbar__left">
        {/* Logo mark */}
        <div
          style={{
            width: 28, height: 28,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent-600)',
            display: 'grid', placeItems: 'center',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
          }}
          aria-hidden="true"
        >
          N
        </div>
        <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-md)', letterSpacing: 'var(--tracking-snug)' }}>
          NeuroDesk AI
        </span>
      </div>

      <div className="topbar__right">
        {mounted && (
          <button
            className="btn btn--ghost btn--icon btn--sm"
            onClick={cycleTheme}
            aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
          >
            {resolvedTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}
