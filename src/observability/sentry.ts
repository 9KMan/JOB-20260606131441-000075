import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN ?? '';

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}

export function captureBreachEvent(breachType: string, accountId: string, actual: number): void {
  Sentry.captureMessage(
    `[RISK BREACH] ${breachType} triggered for account ${accountId}: ${actual}`,
    { level: 'error', tags: { breachType, accountId } }
  );
}

export function captureError(error: Error, context: Record<string, unknown> = {}): void {
  Sentry.captureException(error, { extra: context });
}