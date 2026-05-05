// File: src/lib/config.ts
/**
 * Application Configuration
 * Central configuration constants for the NeuroDesk AI application.
 * Controls context window limits, message constraints, and token counting settings.
 * (Why: single source of truth prevents magic numbers scattered across the codebase)
 */

export const config = {
  // Maximum number of recent messages to include in context
  // (Why: prevents unbounded context growth that would exceed LLM limits)
  contextWindowSize: 20,

  // Maximum token count for context window (safety cap)
  // (Why: hard ceiling to ensure we never exceed the LLM's context window)
  contextTokenCap: 100_000,

  // Maximum characters allowed per user message
  // (Why: prevents abuse and ensures reasonable request sizes)
  maxMessageLength: 10_000,

  // Default conversation title for new conversations
  // (Why: placeholder title shown until auto-generated from first user message)
  defaultConversationTitle: 'New Conversation',

  // Maximum characters allowed for conversation titles
  // (Why: keeps sidebar UI clean and prevents excessively long titles)
  maxTitleLength: 200,

  // Tiktoken encoding used for token counting (cl100k_base = GPT-4o encoding)
  // (Why: must match the encoding used by target LLM for accurate token estimates)
  tiktokenEncoding: 'cl100k_base' as const,

  // RAG graph-enhanced retrieval: widen candidate pool then rerank, inject top-N
  // (Why: wider pool gives graph reranking more to work with; final context stays small)
  ragCandidatePoolSize: 20,
  ragFinalContextSize: 5,

  // F004: Document library hard limits (enforced at API boundary before ingestion)
  // (Why: prevents unbounded storage growth and keeps vector index query times predictable)
  libraryMaxDocuments: 50,
  libraryMaxBytes: 524_288_000, // 500 MB

  // F004: Dynamic candidate pool formula: min(ragDynamicPoolBase × N, ragDynamicPoolMax)
  // where N = number of in-scope documents (filtered set or full library when no filter active)
  // (Why: scales candidate breadth with library size while bounding query cost at ~100 chunks)
  ragDynamicPoolBase: 20,
  ragDynamicPoolMax: 100,
} as const;
