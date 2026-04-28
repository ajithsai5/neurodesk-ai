export const dynamic = 'force-dynamic';

// File: src/app/api/code/explain/route.ts
/**
 * POST /api/code/explain
 * Accepts { code, language?, sessionId? } → returns { explanation: string }.
 * Validates input with Zod; delegates to code-service for LLM explanation.
 * (Why: thin route handler keeps business logic in the service layer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { explainCode } from '@/modules/code';

const bodySchema = z.object({
  /** Source code to explain (max 10 000 chars — matches maxMessageLength) */
  code: z.string().min(1).max(10_000),
  /** Optional language hint for the system prompt */
  language: z.string().optional(),
  /** Optional session ID for future graph enrichment */
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Parse JSON body — 400 on malformed JSON
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate schema — 400 with field errors on invalid input
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const explanation = await explainCode(parsed.data);
    return NextResponse.json({ explanation });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
