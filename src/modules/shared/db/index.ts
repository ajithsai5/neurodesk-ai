// File: src/modules/shared/db/index.ts
/**
 * Database Connection Singleton
 * Initializes and exports the SQLite database connection via Drizzle ORM.
 * Uses better-sqlite3 as the underlying driver with WAL mode for concurrent reads.
 * (Why: single connection instance prevents multiple DB handles and ensures consistent pragmas)
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import * as schema from './schema';

// Database file lives in data/ directory at project root (gitignored)
const DB_PATH = path.join(process.cwd(), 'data', 'neurodesk.db');

// Create the SQLite connection with performance and safety pragmas
const sqlite = new Database(DB_PATH);
// WAL mode allows concurrent reads while writing, improving performance
// (Why: prevents read queries from blocking during write transactions)
sqlite.pragma('journal_mode = WAL');
// Enable foreign key enforcement (SQLite disables this by default)
// (Why: ensures referential integrity, especially cascade deletes on messages)
sqlite.pragma('foreign_keys = ON');

// Export the Drizzle ORM instance with schema for type-safe queries
export const db = drizzle(sqlite, { schema });
export { schema };
