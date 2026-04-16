// File: src/modules/shared/logger.ts
/**
 * Structured JSON Logger
 * Provides leveled logging (info, warn, error, debug) with structured JSON output.
 * Debug logs are suppressed in production to reduce noise.
 * (Why: structured JSON logs are parseable by log aggregation tools like Datadog/ELK)
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// Shape of each log entry — includes level, message, timestamp, and optional metadata
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

// Core logging function that formats and routes output to the appropriate console method
// @param level - Severity level determining which console method to use
// @param message - Human-readable log message
// @param meta - Optional key-value metadata merged into the log entry
function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  // Build structured log entry with timestamp and optional metadata
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // Serialize to JSON for structured logging
  // (Why: JSON format allows log aggregation tools to parse and index fields)
  const output = JSON.stringify(entry);

  // Route to the appropriate console method based on severity
  // (Why: ensures errors show in stderr, warnings are distinguishable from info)
  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'debug':
      // Only emit debug logs in development
      // (Why: debug output is too verbose for production and can leak sensitive details)
      if (process.env.NODE_ENV === 'development') {
        console.debug(output);
      }
      break;
    default:
      console.log(output);
  }
}

// Public logger interface — convenience methods for each log level
// @param message - Human-readable log message
// @param meta - Optional key-value metadata (e.g., { conversationId, error })
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
};
