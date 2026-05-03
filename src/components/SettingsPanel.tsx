'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';

interface ProviderConfig {
  id: string;
  displayName: string;
  providerName: string;
  modelId: string;
  isAvailable: boolean;
}

interface Persona {
  id: string;
  name: string;
  description?: string;
}

export function SettingsPanel() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/providers').then((r) => r.ok ? r.json() : { providers: [] }),
      fetch('/api/personas').then((r) => r.ok ? r.json() : { personas: [] }),
    ]).then(([prov, pers]) => {
      setProviders(prov.providers ?? []);
      setPersonas(pers.personas ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8)', background: 'var(--bg-canvas)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          <Settings size={20} style={{ color: 'var(--fg-accent)' }} />
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)' }}>Settings</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 64, width: '100%' }} />
            ))}
          </div>
        ) : (
          <>
            {/* Providers */}
            <section style={{ marginBottom: 'var(--space-8)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-5)', color: 'var(--fg-secondary)' }}>
                LLM Providers
              </h2>
              {providers.length === 0 ? (
                <div className="card">
                  <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>No providers configured.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {providers.map((p) => (
                    <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)' }}>{p.displayName}</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-mono)' }}>{p.providerName} / {p.modelId}</div>
                      </div>
                      <span className={`badge ${p.isAvailable ? 'badge--success' : 'badge--danger'}`}>
                        <span className="badge__dot" />
                        {p.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Personas */}
            <section>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-5)', color: 'var(--fg-secondary)' }}>
                Personas
              </h2>
              {personas.length === 0 ? (
                <div className="card">
                  <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>No personas configured.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {personas.map((p) => (
                    <div key={p.id} className="card">
                      <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)' }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)', marginTop: 'var(--space-2)' }}>{p.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
