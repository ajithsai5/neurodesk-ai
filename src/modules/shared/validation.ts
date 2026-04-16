import { z } from 'zod';
import { config } from '@/lib/config';

export const chatInputSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(config.maxMessageLength, `Message cannot exceed ${config.maxMessageLength} characters`),
});

export const createConversationSchema = z.object({
  personaId: z.string().uuid('Invalid persona ID').optional(),
  providerId: z.string().uuid('Invalid provider ID').optional(),
});

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

export const archiveToggleSchema = z.object({
  archived: z.boolean(),
});

export const conversationListQuerySchema = z.object({
  status: z.enum(['active', 'archived']).default('active'),
});

export type ChatInput = z.infer<typeof chatInputSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type ArchiveToggleInput = z.infer<typeof archiveToggleSchema>;
