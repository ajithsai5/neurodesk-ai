import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from '@/modules/shared/logger';

// Logger tests run in Node environment (NODE_ENV='test' by default in vitest)
// The NODE_ENV=test guard in logger.ts means spies on console MUST NOT be called
// in the default test env. To test the actual output, we temporarily switch NODE_ENV.

afterEach(() => {
  vi.restoreAllMocks();
  // Restore NODE_ENV to 'test' after any test that changed it
  process.env.NODE_ENV = 'test';
});

describe('logger (NODE_ENV=test — silent mode)', () => {
  // T033 — logger.info is silent in test env
  it('logger.info is silent in NODE_ENV=test', () => {
    const spy = vi.spyOn(console, 'info');
    logger.info('test message');
    expect(spy).not.toHaveBeenCalled();
  });

  // T033b — logger.warn is silent in test env
  it('logger.warn is silent in NODE_ENV=test', () => {
    const spy = vi.spyOn(console, 'warn');
    logger.warn('test warning');
    expect(spy).not.toHaveBeenCalled();
  });

  // T033c — logger.error is silent in test env
  it('logger.error is silent in NODE_ENV=test', () => {
    const spy = vi.spyOn(console, 'error');
    logger.error('test error');
    expect(spy).not.toHaveBeenCalled();
  });

  // T033d — logger.debug is silent in test env
  it('logger.debug is silent in NODE_ENV=test', () => {
    const spy = vi.spyOn(console, 'debug');
    logger.debug('test debug');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('logger (NODE_ENV=development — active output)', () => {
  // T034 — logger.warn outputs to console.warn in development
  it('logger.warn calls console.warn with JSON containing level and message', () => {
    process.env.NODE_ENV = 'development';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('something happened');
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.level).toBe('warn');
    expect(output.message).toBe('something happened');
    expect(output.timestamp).toBeDefined();
  });

  // T035 — logger.error with meta outputs to console.error
  it('logger.error calls console.error with error message in output', () => {
    process.env.NODE_ENV = 'development';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('oops', { error: new Error('boom').message });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.message).toBe('oops');
    expect(output.error).toBe('boom');
  });

  // T036 — logger.debug is suppressed outside development mode
  it('logger.debug is NOT called in production', () => {
    process.env.NODE_ENV = 'production';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('verbose detail');
    expect(spy).not.toHaveBeenCalled();
  });

  // logger.info uses console.info (not console.log) in development
  it('logger.info calls console.info in development', () => {
    process.env.NODE_ENV = 'development';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('hello');
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled(); // must NOT use console.log for info level
  });
});
