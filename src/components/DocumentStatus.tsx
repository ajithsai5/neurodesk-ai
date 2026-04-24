// File: src/components/DocumentStatus.tsx
/**
 * DocumentStatus — Colour-coded processing status badge.
 * Renders 'pending', 'ready', or 'failed' with appropriate colours and
 * shows the error message on hover for failed documents.
 * (Why: status feedback is needed in both DocumentLibrary rows and any detail views)
 */

'use client';

interface Props {
  status: 'pending' | 'ready' | 'failed';
  errorMessage?: string | null;
}

const styles: Record<Props['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  ready:   'bg-green-100  text-green-700  border border-green-300',
  failed:  'bg-red-100    text-red-700    border border-red-300',
};

const labels: Record<Props['status'], string> = {
  pending: '⟳ Processing',
  ready:   '✓ Ready',
  failed:  '✗ Failed',
};

// DocumentStatus renders a small pill badge for document processing state.
// For 'failed' status, a title tooltip shows the underlying error message.
export function DocumentStatus({ status, errorMessage }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${styles[status]}`}
      title={status === 'failed' && errorMessage ? errorMessage : undefined}
    >
      {labels[status]}
    </span>
  );
}
