import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbedding, EmbeddingError } from '@/modules/rag/embedding-client';

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the correct request shape to Ollama /api/embed', async () => {
    const mockEmbedding = Array(768).fill(0.1);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ embeddings: [mockEmbedding] }), { status: 200 })
    );

    await generateEmbedding('hello world');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://localhost:11434/api/embed');
    expect(options?.method).toBe('POST');
    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe('nomic-embed-text');
    expect(body.input).toBe('hello world');
  });

  it('returns a 768-dimensional float array on success', async () => {
    const mockEmbedding = Array(768).fill(0).map((_, i) => i * 0.001);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ embeddings: [mockEmbedding] }), { status: 200 })
    );

    const result = await generateEmbedding('test text');
    expect(result).toHaveLength(768);
    expect(typeof result[0]).toBe('number');
  });

  it('throws EmbeddingError when fetch fails (Ollama unreachable)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const err = await generateEmbedding('test').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmbeddingError);
    expect((err as EmbeddingError).message).toContain('Ollama unreachable');
  });

  it('throws EmbeddingError with timeout message when AbortSignal fires', async () => {
    // Simulate the AbortError that fetch throws when an AbortSignal times out
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortErr);

    const signal = AbortSignal.timeout(1); // immediate timeout for the test
    const err = await generateEmbedding('ping', signal).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmbeddingError);
    expect((err as EmbeddingError).message).toContain('timed out');
  });

  it('throws EmbeddingError on non-200 HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('model not found', { status: 404, statusText: 'Not Found' })
    );

    const err = await generateEmbedding('test').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmbeddingError);
    expect((err as EmbeddingError).message).toContain('HTTP 404');
  });

  it('throws EmbeddingError when response has wrong embedding dimensions', async () => {
    const wrongDims = Array(512).fill(0.1); // 512 instead of 768
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ embeddings: [wrongDims] }), { status: 200 })
    );

    const err = await generateEmbedding('test').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmbeddingError);
    expect((err as EmbeddingError).message).toContain('768');
  });

  it('throws EmbeddingError when response JSON is invalid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not json at all', { status: 200 })
    );

    const err = await generateEmbedding('test').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmbeddingError);
  });
});
