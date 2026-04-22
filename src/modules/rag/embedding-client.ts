// File: src/modules/rag/embedding-client.ts
/**
 * Embedding Client
 * Calls Ollama's /api/embed endpoint to generate 768-dim vector embeddings
 * using the nomic-embed-text model. All embedding generation is local — no
 * external API calls are made.
 * (Why: nomic-embed-text via Ollama satisfies FR-010 local-only requirement)
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';
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
 * @returns A 768-element float array representing the text's semantic vector
 * @throws EmbeddingError if Ollama is unreachable or returns an invalid response
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  let response: Response;

  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    });
  } catch (cause) {
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
