// File: src/app/api/providers/route.ts
/**
 * Providers API Route Handler
 * GET /api/providers — List all configured LLM providers and their availability
 * Read-only endpoint — providers are admin-managed, not user-editable in v1.
 * (Why: exposes provider metadata for the model switcher dropdown in the chat toolbar)
 */

import { db } from '@/modules/shared/db';
import { providerConfigs } from '@/modules/shared/db/schema';
import { asc } from 'drizzle-orm';

// List all provider configurations sorted by display order
// Includes both available and unavailable providers (UI shows unavailable as disabled)
// @returns - JSON array of ProviderConfig objects
export async function GET() {
  const result = db
    .select()
    .from(providerConfigs)
    .orderBy(asc(providerConfigs.sortOrder))
    .all();

  return Response.json({ providers: result });
}
