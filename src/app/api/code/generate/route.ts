export const dynamic = 'force-dynamic';

// File: src/app/api/code/generate/route.ts
/**
 * POST /api/code/generate
 * Accepts { language, description, sessionId? } → returns { code: string }.
 * Validates input with Zod; delegates to code-service for LLM generation.
 * (Why: thin route handler keeps business logic in the service layer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateCode } from '@/modules/code';

const bodySchema = z.object({
  /** Target programming language */
  language: z.string().min(1),
  /** Natural-language description of what to generate (max 2 000 chars) */
  description: z.string().min(1).max(2_000),
  /** Optional session ID for graph context enrichment */
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
    const code = await generateCode(parsed.data);
    return NextResponse.json({ code });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
