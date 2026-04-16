import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/modules/shared/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/neurodesk.db',
  },
});
