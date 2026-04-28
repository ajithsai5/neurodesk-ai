// File: src/modules/code/types.ts
/**
 * Type definitions for the Code Assistant module.
 * Stateless generate + explain operations — no conversation context required.
 * (Why: clean separation keeps the public API surface minimal and easy to version)
 */

/** Request body for code generation */
export interface GenerateCodeRequest {
  /** Target programming language (e.g., "typescript", "python") */
  language: string;
  /** Natural-language description of what to generate */
  description: string;
  /** Optional session ID — used to inject codebase graph context */
  sessionId?: string;
}

/** Response body from code generation */
export interface GenerateCodeResponse {
  /** The generated code string */
  code: string;
}

/** Request body for code explanation */
export interface ExplainCodeRequest {
  /** The source code to explain */
  code: string;
  /** Optional language hint for the system prompt */
  language?: string;
  /** Optional session ID for future graph enrichment */
  sessionId?: string;
}

/** Response body from code explanation */
export interface ExplainCodeResponse {
  /** Plain-English explanation of the code */
  explanation: string;
}
