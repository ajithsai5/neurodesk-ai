import { db } from '@/modules/shared/db';
import { personas } from '@/modules/shared/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
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
