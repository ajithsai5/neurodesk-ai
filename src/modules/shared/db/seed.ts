// File: src/modules/shared/db/seed.ts
/**
 * Database Seeding Script
 * Populates the database with default personas and provider configurations.
 * Only inserts data when the respective tables are empty (idempotent).
 * Run via: npm run db:seed
 * (Why: provides sensible defaults so the app works immediately after setup)
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { personas, providerConfigs } from './schema';
import { count } from 'drizzle-orm';

const DB_PATH = path.join(process.cwd(), 'data', 'neurodesk.db');

// Ensure data directory exists before opening DB
// (Why: better-sqlite3 will fail if the parent directory doesn't exist)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);

// Seed the database with default personas and providers
// Checks each table for existing data before inserting to prevent duplicates
// (Why: makes the script safe to run multiple times without side effects)
async function seed() {
  // Seed personas if none exist
  // (Why: app requires at least one persona for conversation creation)
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
  // (Why: app requires at least one available provider to stream LLM responses)
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

  // Close the connection after seeding
  // (Why: this is a standalone script, not the app's long-lived connection)
  sqlite.close();
  console.log('Seed complete');
}

seed().catch(console.error);
