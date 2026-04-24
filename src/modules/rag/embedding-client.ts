// File: src/modules/rag/embedding-client.ts
/**
 * Embedding Client
 * Calls Ollama's /api/embed endpoint to generate 768-dim vector embeddings
 * using the nomic-embed-text model. All embedding generation is local — no
 * external API calls are made.
 * (Why: nomic-embed-text via Ollama satisfies FR-010 local-only requirement)
 */

// Use 127.0.0.1 explicitly — Node.js/Undici resolves 'localhost' to ::1 (IPv6) first,
// but Ollama only listens on IPv4, so the connection fails with 'localhost'.
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const EMBEDDING_MODEL = 'nomic-embed-text';
const EXPECTED_DIMS = 768;

/** Thrown when Ollama is unreachable or returns an unexpected response */
export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/**
 * Generate a 768-dimensional embedding vector for the given text using
 * Ollama's nomic-embed-text model.
 * @param text - The text to embed (should be ≤ 512 tokens for best results)
 * @param signal - Optional AbortSignal (e.g. AbortSignal.timeout(5000) for the pre-flight check)
 * @returns A 768-element float array representing the text's semantic vector
 * @throws EmbeddingError if Ollama is unreachable, times out, or returns an invalid response
 */
export async function generateEmbedding(text: string, signal?: AbortSignal): Promise<number[]> {
  let response: Response;

  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
      signal,
    });
  } catch (cause) {
    // AbortError means the timeout fired — surface a clear message
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new EmbeddingError(
        `Ollama unreachable at ${OLLAMA_BASE_URL}: request timed out. Ensure Ollama is running with: ollama serve`
      );
    }
    throw new EmbeddingError(
      `Ollama unreachable at ${OLLAMA_BASE_URL}. Ensure Ollama is running with: ollama serve`
    );
  }

  if (!response.ok) {
    throw new EmbeddingError(
      `Ollama embedding request failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  let body: { embeddings?: number[][] };
  try {
    body = await response.json() as { embeddings?: number[][] };
  } catch {
    throw new EmbeddingError('Ollama returned an invalid JSON response for embedding request');
  }

  const embedding = body.embeddings?.[0];

  if (!Array.isArray(embedding) || embedding.length !== EXPECTED_DIMS) {
    throw new EmbeddingError(
      `Expected ${EXPECTED_DIMS}-dimensional embedding from Ollama, got ${Array.isArray(embedding) ? embedding.length : typeof embedding}`
    );
  }

  return embedding;
}
