export const dynamic = 'force-dynamic';

// File: src/app/api/personas/route.ts
/**
 * Personas API Route Handler
 * GET /api/personas — List all available personas (without system prompts)
 * Read-only endpoint — personas are admin-managed, not user-editable in v1.
 * (Why: exposes persona metadata for the dropdown selector while keeping system prompts internal)
 */

import { db } from '@/modules/shared/db';
import { personas } from '@/modules/shared/db/schema';
import { asc } from 'drizzle-orm';

// List all personas sorted by display order, excluding systemPrompt field
// (Why: systemPrompt is internal to the chat service — exposing it would leak AI behavior details)
// @returns - JSON array of PersonaListItem objects (id, name, description, icon, sortOrder)
export async function GET() {
  // Select specific columns to exclude systemPrompt from the response
  const result = db
    .select({
      id: personas.id,
      name: personas.name,
      description: personas.description,
      icon: personas.icon,
      sortOrder: personas.sortOrder,
    })
    .from(personas)
    .orderBy(asc(personas.sortOrder))
    .all();

  return Response.json({ personas: result });
}
