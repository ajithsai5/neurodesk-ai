import { db } from '@/modules/shared/db';
import { providerConfigs } from '@/modules/shared/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  const result = db
    .select()
    .from(providerConfigs)
    .orderBy(asc(providerConfigs.sortOrder))
    .all();

  return Response.json({ providers: result });
}
