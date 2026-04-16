import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { personas, providerConfigs } from './schema';
import { count } from 'drizzle-orm';

const DB_PATH = path.join(process.cwd(), 'data', 'neurodesk.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);

async function seed() {
  // Seed personas if none exist
  const [personaCount] = await db.select({ value: count() }).from(personas);
  if (personaCount.value === 0) {
    await db.insert(personas).values([
      {
        id: uuidv4(),
        name: 'General Assistant',
        description: 'Helpful all-purpose AI assistant for development tasks',
        systemPrompt: 'You are a helpful AI assistant for software development. Provide clear, accurate, and concise responses. When showing code, use proper formatting and explain your reasoning.',
        icon: 'assistant',
        sortOrder: 0,
      },
      {
        id: uuidv4(),
        name: 'Tutor',
        description: 'Patient teacher that explains concepts step-by-step with examples',
        systemPrompt: 'You are a patient and encouraging programming tutor. Explain concepts step-by-step, use simple analogies, and provide examples. Ask clarifying questions when the student seems confused. Build on what the student already knows.',
        icon: 'tutor',
        sortOrder: 1,
      },
      {
        id: uuidv4(),
        name: 'Code Reviewer',
        description: 'Strict reviewer focused on bugs, best practices, and improvements',
        systemPrompt: 'You are a thorough code reviewer. Focus on finding bugs, security issues, performance problems, and deviations from best practices. Be constructive but direct. Suggest specific improvements with code examples. Prioritize issues by severity.',
        icon: 'reviewer',
        sortOrder: 2,
      },
    ]);
    console.log('Seeded 3 personas');
  }

  // Seed provider configs if none exist
  const [providerCount] = await db.select({ value: count() }).from(providerConfigs);
  if (providerCount.value === 0) {
    await db.insert(providerConfigs).values([
      {
        id: uuidv4(),
        providerName: 'openai',
        modelId: 'gpt-4o',
        displayName: 'GPT-4o (OpenAI)',
        isAvailable: true,
        sortOrder: 0,
      },
      {
        id: uuidv4(),
        providerName: 'anthropic',
        modelId: 'claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4 (Anthropic)',
        isAvailable: true,
        sortOrder: 1,
      },
    ]);
    console.log('Seeded 2 provider configs');
  }

  sqlite.close();
  console.log('Seed complete');
}

seed().catch(console.error);
