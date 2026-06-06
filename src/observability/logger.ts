export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  [key: string]: unknown;
}

export function log(level: LogEntry['level'], message: string, extra: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'broker-integration',
    message,
    ...extra,
  };
  // Write to stdout as JSON for structured logging (Docker / CloudWatch / etc.)
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (msg: string, extra?: Record<string, unknown>) => log('info', msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => log('warn', msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => log('error', msg, extra),
  debug: (msg: string, extra?: Record<string, unknown>) => log('debug', msg, extra),
};