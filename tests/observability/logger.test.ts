/**
 * Unit tests for the structured logger.
 */

import { logger, log, LogEntry } from '../../src/observability/logger';

describe('logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const getEntry = (): LogEntry => JSON.parse(consoleSpy.mock.calls[0][0]) as LogEntry;

  it('emits a JSON line to stdout', () => {
    logger.info('hello world');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const entry = getEntry();
    expect(entry.level).toBe('info');
    expect(entry.service).toBe('broker-integration');
    expect(entry.message).toBe('hello world');
  });

  it('includes timestamp in ISO format', () => {
    logger.warn('something');
    const entry = getEntry();
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.level).toBe('warn');
  });

  it('merges extra fields at top level', () => {
    logger.error('boom', { userId: 42, context: 'auth' });
    const entry = getEntry();
    expect(entry.userId).toBe(42);
    expect(entry.context).toBe('auth');
  });

  it('supports debug level via direct call', () => {
    log('debug', 'trace', { fn: 'foo' });
    const entry = getEntry();
    expect(entry.level).toBe('debug');
    expect(entry.fn).toBe('foo');
  });
});
