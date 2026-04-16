import { describe, it, expect } from 'vitest';
import {
  chatInputSchema,
  createConversationSchema,
  updateConversationSchema,
  archiveToggleSchema,
} from '@/modules/shared/validation';

describe('chatInputSchema', () => {
  it('should accept valid input', () => {
    const result = chatInputSchema.safeParse({
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      message: 'Hello, world!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty message', () => {
    const result = chatInputSchema.safeParse({
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      message: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject whitespace-only message', () => {
    const result = chatInputSchema.safeParse({
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      message: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('should reject message exceeding 10,000 characters', () => {
    const result = chatInputSchema.safeParse({
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      message: 'a'.repeat(10_001),
    });
    expect(result.success).toBe(false);
  });

  it('should accept message at exactly 10,000 characters', () => {
    const result = chatInputSchema.safeParse({
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      message: 'a'.repeat(10_000),
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID for conversationId', () => {
    const result = chatInputSchema.safeParse({
      conversationId: 'not-a-uuid',
      message: 'Hello',
    });
    expect(result.success).toBe(false);
  });
});

describe('createConversationSchema', () => {
  it('should accept empty object (all optional)', () => {
    const result = createConversationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid persona and provider IDs', () => {
    const result = createConversationSchema.safeParse({
      personaId: '550e8400-e29b-41d4-a716-446655440000',
      providerId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid persona ID', () => {
    const result = createConversationSchema.safeParse({
      personaId: 'not-valid',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateConversationSchema', () => {
  it('should accept a valid title', () => {
    const result = updateConversationSchema.safeParse({ title: 'My Chat' });
    expect(result.success).toBe(true);
  });

  it('should reject empty title', () => {
    const result = updateConversationSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('should reject title exceeding 200 characters', () => {
    const result = updateConversationSchema.safeParse({ title: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('should accept title at exactly 200 characters', () => {
    const result = updateConversationSchema.safeParse({ title: 'a'.repeat(200) });
    expect(result.success).toBe(true);
  });
});

describe('archiveToggleSchema', () => {
  it('should accept archived: true', () => {
    const result = archiveToggleSchema.safeParse({ archived: true });
    expect(result.success).toBe(true);
  });

  it('should accept archived: false', () => {
    const result = archiveToggleSchema.safeParse({ archived: false });
    expect(result.success).toBe(true);
  });

  it('should reject non-boolean archived', () => {
    const result = archiveToggleSchema.safeParse({ archived: 'yes' });
    expect(result.success).toBe(false);
  });
});
