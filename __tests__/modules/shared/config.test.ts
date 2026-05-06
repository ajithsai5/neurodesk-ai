// File: __tests__/modules/shared/config.test.ts
/**
 * Unit tests for F004 config constants — T003–T005
 * These tests MUST FAIL before T006 (adding the constants) is implemented.
 */

import { describe, it, expect } from 'vitest';
import { config } from '@/lib/config';

describe('config — F004 library limits', () => {
  // T003: Library document count cap
  it('exposes libraryMaxDocuments = 50', () => {
    expect((config as Record<string, unknown>).libraryMaxDocuments).toBe(50);
  });

  // T003: Library storage cap (500 MB in bytes)
  it('exposes libraryMaxBytes = 524_288_000 (500 MB)', () => {
    expect((config as Record<string, unknown>).libraryMaxBytes).toBe(524_288_000);
  });
});

describe('config — F004 dynamic RAG pool', () => {
  // T004: Base multiplier for candidate pool formula: min(ragDynamicPoolBase × N, ragDynamicPoolMax)
  it('exposes ragDynamicPoolBase = 20', () => {
    expect((config as Record<string, unknown>).ragDynamicPoolBase).toBe(20);
  });

  // T005: Hard ceiling for candidate pool
  it('exposes ragDynamicPoolMax = 100', () => {
    expect((config as Record<string, unknown>).ragDynamicPoolMax).toBe(100);
  });

  // T005: Verify pool formula behaviour at scale
  it('pool formula min(base×N, max) yields correct values', () => {
    const base = (config as Record<string, unknown>).ragDynamicPoolBase as number;
    const max  = (config as Record<string, unknown>).ragDynamicPoolMax  as number;
    // 1 document  → 20
    expect(Math.min(base * 1, max)).toBe(20);
    // 3 documents → 60
    expect(Math.min(base * 3, max)).toBe(60);
    // 5 documents → 100 (hits ceiling)
    expect(Math.min(base * 5, max)).toBe(100);
    // 10 documents → 100 (stays at ceiling)
    expect(Math.min(base * 10, max)).toBe(100);
  });
});
