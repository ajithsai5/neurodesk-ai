// File: src/components/DocumentUpload.tsx
/**
 * DocumentUpload — File picker and upload trigger for the document library.
 * Accepts .pdf and .txt files up to 50 MB, posts to POST /api/documents,
 * and notifies the parent when upload is accepted so polling can begin.
 * (Why: upload is a distinct interaction from the library list — separating them
 * keeps each component's responsibility focused)
 */

'use client';

import { useRef, useState } from 'react';

interface Props {
  /** Called when the server accepts the upload (202). Parent should refresh library. */
  onUploaded: () => void;
}

const MAX_SIZE_BYTES = 52_428_800; // 50 MB — mirrors server-side limit

// DocumentUpload renders a styled file picker button and upload feedback
export function DocumentUpload({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    // Client-side size check (server validates again — this just improves UX)
    if (file.size > MAX_SIZE_BYTES) {
      setError('File exceeds 50 MB limit.');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/documents', { method: 'POST', body: form });

      if (res.status === 202) {
        onUploaded();
      } else if (res.status === 409) {
        // Duplicate file — server already has it
        const data = await res.json();
        setError(`Already in library (ID ${data.existingId as number}).`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Upload failed.');
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected after an error
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // T028: handle multiple files — upload each sequentially so errors surface per-file
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    // Upload each file; chain uploads so the spinner stays visible throughout
    const uploadAll = files.reduce(
      (chain, file) => chain.then(() => handleFile(file)),
      Promise.resolve(),
    );
    void uploadAll;
  }

  return (
    <div>
      {/* T028: multiple attribute enables multi-file selection in the OS picker */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={uploading}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn btn--primary"
        style={{ width: '100%', justifyContent: 'center', gap: 'var(--space-2)' }}
      >
        {uploading ? (
          <>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
            Uploading…
          </>
        ) : (
          <>
            <span>+</span>
            Upload Document
          </>
        )}
      </button>
      {error && (
        <p style={{
          marginTop: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-danger)',
          textAlign: 'center',
          marginBottom: 0,
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
