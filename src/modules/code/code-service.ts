// File: src/modules/code/code-service.ts
/**
 * Code Service — stateless code generation and explanation.
 *
 * generateCode: turns a natural-language description into working code in the target language.
 * explainCode:  turns source code into a plain-English explanation.
 *
 * Both functions use the first available provider config from the database.
 * Graph enrichment (CODE_ENTITY lookup) is best-effort: failures degrade silently.
 * (Why: FR-021 requires graceful degradation when the graph store is unavailable)
 */

import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/modules/shared/db';
import { getLLMModel } from '@/modules/chat/llm-client';
import { queryCodeEntities } from '@/modules/graph/graph-service';
import { logger } from '@/modules/shared/logger';
import type { GenerateCodeRequest, ExplainCodeRequest } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the first available LLM model from the database.
 * Throws if no provider is configured and available.
 */
function resolveModel() {
  const provider = db
    .select()
    .from(schema.providerConfigs)
    .where(eq(schema.providerConfigs.isAvailable, true))
    .get();

  if (!provider) {
    throw new Error('No available LLM provider configured');
  }

  return getLLMModel(provider.providerName, provider.modelId);
}

// ─── generateCode ─────────────────────────────────────────────────────────────

/**
 * Generate code for a given language and natural-language description.
 * Optionally injects relevant CODE_ENTITY nodes from the knowledge graph
 * so the model is aware of existing codebase symbols.
 *
 * @param req - Language, description, and optional sessionId
 * @returns The generated code string (no surrounding prose)
 */
export async function generateCode(req: GenerateCodeRequest): Promise<string> {
  const sessionId = req.sessionId ?? '';
  let contextBlock = '';

  // Best-effort graph enrichment — never blocks code generation
  try {
    const entities = await queryCodeEntities(sessionId, req.description, 20);
    if (entities.length > 0) {
      contextBlock =
        '\n\n[CODEBASE CONTEXT]\n' +
        entities
          .map((e) => {
            try {
              const p = JSON.parse(e.properties) as { kind?: string; filePath?: string };
              return `${p.kind ?? 'symbol'} \`${e.label}\` in ${p.filePath ?? 'unknown'}`;
            } catch {
              return `symbol \`${e.label}\``;
            }
          })
          .join('\n') +
        '\n[END CODEBASE CONTEXT]';
    }
  } catch (err) {
    logger.warn('[CodeService] queryCodeEntities failed (degraded)', { err: String(err) });
  }

  const system =
    `You are an expert software engineer. Generate clean, production-ready ${req.language} code.${contextBlock}\n` +
    'Respond with ONLY the code, no explanation or markdown fences.';

  const model = resolveModel();
  const { text } = await generateText({ model, system, prompt: req.description });
  return text;
}

// ─── explainCode ──────────────────────────────────────────────────────────────

/**
 * Explain a piece of source code in plain English.
 *
 * @param req - Code to explain plus optional language hint and sessionId
 * @returns Plain-English explanation string
 */
export async function explainCode(req: ExplainCodeRequest): Promise<string> {
  const lang = req.language ?? 'code';
  const system =
    `You are an expert software engineer. Explain the following ${lang} code in plain English. ` +
    'Be concise and clear. Focus on what the code does and why.';

  const model = resolveModel();
  const { text } = await generateText({ model, system, prompt: req.code });
  return text;
}
