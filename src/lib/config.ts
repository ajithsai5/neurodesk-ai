export const config = {
  /** Maximum number of recent messages to include in context */
  contextWindowSize: 20,

  /** Maximum token count for context window (safety cap) */
  contextTokenCap: 100_000,

  /** Maximum characters allowed per user message */
  maxMessageLength: 10_000,

  /** Default conversation title for new conversations */
  defaultConversationTitle: 'New Conversation',

  /** Maximum characters allowed for conversation titles */
  maxTitleLength: 200,

  /** Tiktoken encoding used for token counting */
  tiktokenEncoding: 'cl100k_base' as const,
} as const;
