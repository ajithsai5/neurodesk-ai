// File: src/modules/shared/index.ts
/**
 * Shared Module Public API
 * Barrel export for the shared module — exposes database, logger, types, and validation.
 * All other modules import from here rather than reaching into internal files.
 * (Why: single entry point enforces module boundaries and simplifies import paths)
 */

export { db, schema } from './db';
export { logger } from './logger';
export * from './types';
export * from './validation';
