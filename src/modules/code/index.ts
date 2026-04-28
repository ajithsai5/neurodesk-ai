// File: src/modules/code/index.ts
/**
 * Code Assistant Module — Public API
 *
 *   generateCode(req: GenerateCodeRequest): Promise<string>
 *   explainCode(req: ExplainCodeRequest): Promise<string>
 *
 * Stateless operations: no conversation required.
 * Provider config loaded from the database; graph enrichment is best-effort.
 */

export { generateCode, explainCode } from './code-service';
export type {
  GenerateCodeRequest,
  GenerateCodeResponse,
  ExplainCodeRequest,
  ExplainCodeResponse,
} from './types';
