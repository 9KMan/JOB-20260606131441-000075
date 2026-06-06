import express, { Express, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { config } from './config';
import { logger } from './observability/logger';
import { initSentry } from './observability/sentry';
import { createHealthHandler } from './observability/health';
import { BrokerConnector } from './broker/connector';
import { BrokerRestClient } from './broker/rest-client';
import { createBrokerRoutes } from './api/broker.routes';

export function buildApp(db: Pool, connector: BrokerConnector, restClient: BrokerRestClient): Express {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logger
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  });

  // ── Health ────────────────────────────────────────────────────────────
  app.get('/health', createHealthHandler(db, async () => {
    try {
      // Best-effort broker reachability check
      return await restClient.ping().then(() => true).catch(() => false);
    } catch {
      return false;
    }
  }));

  // ── Broker API (versioned) ────────────────────────────────────────────
  app.use('/api/v1/broker', createBrokerRoutes(connector, restClient));

  // ── 404 + error handlers ──────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('unhandled', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'internal_server_error' });
  });

  return app;
}

async function main(): Promise<void> {
  initSentry();

  // Database pool
  const db = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  // Broker connector + REST client
  const connector = new BrokerConnector(
    config.broker.baseUrl,
    config.broker.clientId,
    config.broker.clientSecret,
    db
  );

  // Attempt to load stored tokens on startup
  try {
    await connector.loadStoredTokens();
    logger.info('broker_tokens_loaded');
  } catch (err) {
    logger.warn('broker_tokens_load_failed', { error: (err as Error).message });
  }

  const restClient = new BrokerRestClient(
    config.broker.baseUrl,
    () => connector.ensureAccessToken()
  );

  const app = buildApp(db, connector, restClient);
  const port = parseInt(process.env.PORT ?? '3000', 10);

  const server = app.listen(port, () => {
    logger.info('server_started', { port, env: process.env.NODE_ENV ?? 'development' });
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info('shutdown_initiated', { signal });
    server.close(() => {
      db.end().then(() => process.exit(0)).catch(() => process.exit(1));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
