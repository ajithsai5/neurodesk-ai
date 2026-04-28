#!/usr/bin/env npx ts-node
// File: scripts/benchmark-rag.ts
/**
 * RAG Benchmark Script — F02 vs F03 strategy comparison.
 *
 * For each question in the eval-set, runs two retrieval strategies:
 *   F02: retrieveChunks(q, 5) — pure vector top-5
 *   F03: retrieveAndRerank(q, 'benchmark') — top-20 pool → graph rerank → top-5
 *
 * Scores each answer by counting expected key-phrase matches (case-insensitive).
 * Outputs a Markdown table to stdout and writes results to benchmark.md.
 *
 * Prerequisites:
 *   - npm run dev running (or DB accessible at data/neurodesk.db)
 *   - Ollama running at localhost:11434 with nomic-embed-text + llama3.1:8b
 *   - At least one document indexed with status 'ready'
 *
 * Usage: npx ts-node scripts/benchmark-rag.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

// ─── Eval set ──────────────────────────────────────────────────────────────────

interface EvalQuestion {
  id: number;
  question: string;
  phrases: string[];
}

const EVAL_SET: EvalQuestion[] = [
  { id: 1,  question: 'What database does NeuroDesk AI use for storing conversations?',      phrases: ['sqlite', 'drizzle', 'better-sqlite3'] },
  { id: 2,  question: 'How does the context window trimming work?',                           phrases: ['token', '20 messages', '100k', 'tiktoken'] },
  { id: 3,  question: 'What embedding model is used for document search?',                    phrases: ['nomic-embed-text', 'ollama', '768'] },
  { id: 4,  question: 'How are citations attached to assistant messages?',                    phrases: ['StreamData', 'annotation', 'sources panel', 'useChat'] },
  { id: 5,  question: 'What is the graph reranking strategy?',                               phrases: ['edge weight', 'rerankWithGraph', 'writeChunkNodes', 'CHUNK'] },
  { id: 6,  question: 'How does the RAG pipeline retrieve document chunks?',                  phrases: ['vec_document_chunks', 'cosine', 'sqlite-vec', 'distance'] },
  { id: 7,  question: 'What LLM providers are supported?',                                   phrases: ['openai', 'anthropic', 'ollama', 'providerConfigs'] },
  { id: 8,  question: 'How is the system prompt constructed for RAG?',                        phrases: ['DOCUMENT CONTEXT', 'persona', 'systemPrompt', 'basePrompt'] },
  { id: 9,  question: 'What is the maximum message length allowed?',                          phrases: ['10000', 'maxMessageLength', 'validation'] },
  { id: 10, question: 'How are conversation titles generated?',                               phrases: ['200 characters', 'defaultConversationTitle'] },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

function score(answer: string, phrases: string[]): number {
  const lower = answer.toLowerCase();
  const hits = phrases.filter((p) => lower.includes(p.toLowerCase()));
  return hits.length / phrases.length;
}

// ─── LLM call helper ──────────────────────────────────────────────────────────

async function askLLM(context: string | null, question: string): Promise<string> {
  const system = context
    ? `${context}\n\nAnswer concisely using only the document context above.`
    : 'You are a helpful assistant. Answer concisely.';

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      system,
      prompt: question,
      stream: false,
    }),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json() as { response: string };
  return data.response;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading retrieval functions…');

  // Dynamic imports after path setup (ts-node runs from project root)
  const { retrieveChunks, retrieveAndRerank, formatRagContext } =
    await import('../src/modules/rag/retrieval-service');

  const rows: string[] = [];
  let f02Total = 0;
  let f03Total = 0;

  console.log(`\nRunning ${EVAL_SET.length} questions…\n`);

  for (const q of EVAL_SET) {
    process.stdout.write(`Q${q.id}: ${q.question.slice(0, 60)}… `);

    // ── F02 strategy ──
    let f02Score = 0;
    try {
      const f02Chunks = await retrieveChunks(q.question, 5);
      const f02Context = formatRagContext(f02Chunks);
      const f02Answer = await askLLM(f02Context, q.question);
      f02Score = score(f02Answer, q.phrases);
    } catch (err) {
      process.stdout.write('[F02 error] ');
    }

    // ── F03 strategy ──
    let f03Score = 0;
    try {
      const f03Chunks = await retrieveAndRerank('benchmark', q.question);
      const f03Context = formatRagContext(f03Chunks);
      const f03Answer = await askLLM(f03Context, q.question);
      f03Score = score(f03Answer, q.phrases);
    } catch (err) {
      process.stdout.write('[F03 error] ');
    }

    const delta = f03Score - f02Score;
    const deltaStr = delta >= 0 ? `+${(delta * 100).toFixed(0)}%` : `${(delta * 100).toFixed(0)}%`;
    console.log(`F02=${(f02Score * 100).toFixed(0)}% F03=${(f03Score * 100).toFixed(0)}% Δ=${deltaStr}`);

    rows.push(
      `| ${q.id} | ${q.question.slice(0, 55)} | ${(f02Score * 100).toFixed(0)}% | ${(f03Score * 100).toFixed(0)}% | ${deltaStr} |`,
    );
    f02Total += f02Score;
    f03Total += f03Score;
  }

  const f02Avg = (f02Total / EVAL_SET.length) * 100;
  const f03Avg = (f03Total / EVAL_SET.length) * 100;
  const improvement = f03Avg - f02Avg;
  const verdict = improvement >= 10 ? '✅ PASS' : '❌ FAIL';

  // ─── Markdown report ────────────────────────────────────────────────────────

  const report = [
    '# RAG Benchmark Results — F02 vs F03',
    '',
    `**Run date**: ${new Date().toISOString().slice(0, 10)}`,
    `**Questions**: ${EVAL_SET.length}`,
    '',
    '## Per-Question Scores',
    '',
    '| # | Question | F02 Score | F03 Score | Δ |',
    '|---|----------|-----------|-----------|---|',
    ...rows,
    '',
    '## Aggregate',
    '',
    `| Strategy | Avg Score |`,
    `|----------|-----------|`,
    `| F02 (top-5 pure vector) | ${f02Avg.toFixed(1)}% |`,
    `| F03 (top-20 + graph rerank → top-5) | ${f03Avg.toFixed(1)}% |`,
    `| **Improvement** | **${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%** |`,
    '',
    `## Verdict: ${verdict}`,
    '',
    improvement >= 10
      ? 'F03 achieves ≥ 10% improvement over F02. Graph reranking is effective.'
      : 'F03 does not yet achieve 10% improvement. More graph data (additional Q&A turns) needed to build meaningful edge weights.',
    '',
    '## Notes',
    '',
    '- Scores measure key-phrase recall, not semantic correctness',
    '- Graph edge weights accumulate over Q&A turns; first-run scores reflect empty graph (F02 ≈ F03)',
    '- Re-run after 5+ conversations to observe graph reranking effect',
  ].join('\n');

  const outPath = join(process.cwd(), 'specs', '003-ai-code-assistant-graph-rag', 'benchmark.md');
  writeFileSync(outPath, report, 'utf8');

  console.log('\n─────────────────────────────────────');
  console.log(`F02 avg: ${f02Avg.toFixed(1)}%  F03 avg: ${f03Avg.toFixed(1)}%  Improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`);
  console.log(`Verdict: ${verdict}`);
  console.log(`Report written to: ${outPath}`);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
