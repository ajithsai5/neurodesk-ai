// File: src/modules/shared/db/index.ts
/**
 * Database Connection Singleton
 * Initializes and exports the SQLite database connection via Drizzle ORM.
 * Uses better-sqlite3 as the underlying driver with WAL mode for concurrent reads.
 * Loads the sqlite-vec extension for vector similarity search (RAG feature).
 * (Why: single connection instance prevents multiple DB handles and ensures consistent pragmas)
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import * as sqliteVec from 'sqlite-vec';
import * as schema from './schema';

// Database file lives in data/ directory at project root (gitignored)
const DB_PATH = path.join(process.cwd(), 'data', 'neurodesk.db');

// Create the SQLite connection with performance and safety pragmas
const sqlite = new Database(DB_PATH);
// WAL mode allows concurrent reads while writing, improving performance
// (Why: prevents read queries from blocking during write transactions)
sqlite.pragma('journal_mode = WAL');
// Enable foreign key enforcement (SQLite disables this by default)
// (Why: ensures referential integrity, especially cascade deletes on messages and chunks)
sqlite.pragma('foreign_keys = ON');

// Load the sqlite-vec extension for cosine similarity vector search
// (Why: enables vec_document_chunks virtual table used by the RAG retrieval pipeline)
sqliteVec.load(sqlite);

// Create the vector virtual table for document chunk embeddings if it doesn't exist.
// This is a sqlite-vec virtual table — Drizzle ORM does not manage virtual tables,
// so it must be created with raw SQL here on every startup.
// (Why: vec0 tables require the extension to be loaded first; 768 dims matches nomic-embed-text)
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
    chunk_id INTEGER PRIMARY KEY,
    embedding FLOAT[768]
  )
`);

// Export the Drizzle ORM instance with schema for type-safe queries
export const db = drizzle(sqlite, { schema });
// Export raw sqlite instance for vec queries and transactions not supported by Drizzle
export { sqlite, schema };
