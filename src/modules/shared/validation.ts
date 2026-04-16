// File: src/modules/shared/validation.ts
/**
 * Input Validation Schemas
 * Zod schemas for validating all API request bodies at the system boundary.
 * Each schema maps to a specific API route and enforces size limits from config.
 * (Why: validates untrusted user input before it reaches the service layer)
 */

import { z } from 'zod';
import { config } from '@/lib/config';

// ============================================
// Chat Validation
// Schema for POST /api/chat — validates the user's chat message
// ============================================

// Validates incoming chat messages with conversation ID and content constraints
// @field conversationId - Must be a valid UUID referencing an existing conversation
// @field message - Trimmed, non-empty, capped at maxMessageLength characters
export const chatInputSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(config.maxMessageLength, `Message cannot exceed ${config.maxMessageLength} characters`),
});

// ============================================
// Conversation Validation
// Schemas for conversation CRUD operations
// ============================================

// Validates POST /api/conversations — both fields optional (defaults resolved server-side)
// (Why: new conversations can use default persona/provider if none specified)
export const createConversationSchema = z.object({
  personaId: z.string().uuid('Invalid persona ID').optional(),
  providerId: z.string().uuid('Invalid provider ID').optional(),
});

// Validates PATCH /api/conversations/[id] — all fields optional for partial updates
// @field title - If provided, trimmed and capped at maxTitleLength characters
export const updateConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(config.maxTitleLength, `Title cannot exceed ${config.maxTitleLength} characters`)
    .optional(),
  personaId: z.string().uuid('Invalid persona ID').optional(),
  providerId: z.string().uuid('Invalid provider ID').optional(),
});

// Validates POST /api/conversations/[id]/archive — toggles archive status
// @field archived - true to archive, false to restore to active
export const archiveToggleSchema = z.object({
  archived: z.boolean(),
});

// Validates query params for GET /api/conversations — filters by status
export const conversationListQuerySchema = z.object({
  status: z.enum(['active', 'archived']).default('active'),
});

// ============================================
// Inferred Types
// TypeScript types derived from Zod schemas for use in service layer
// ============================================

export type ChatInput = z.infer<typeof chatInputSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type ArchiveToggleInput = z.infer<typeof archiveToggleSchema>;
