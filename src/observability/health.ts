import { Request, Response } from 'express';
import { Pool } from 'pg';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: 'ok' | 'fail';
    brokerConnection: 'ok' | 'fail' | 'unknown';
  };
  uptimeSeconds: number;
}

const startTime = Date.now();

export function createHealthHandler(db: Pool, checkBroker: () => Promise<boolean>) {
  return async (_req: Request, res: Response): Promise<void> => {
    let dbOk = false;
    let brokerOk = false;

    try {
      await db.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }

    try {
      brokerOk = await checkBroker();
    } catch {
      brokerOk = false;
    }

    const status: HealthStatus = {
      status: dbOk && brokerOk ? 'healthy' : dbOk ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'ok' : 'fail',
        brokerConnection: brokerOk ? 'ok' : 'fail',
      },
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    };

    const httpStatus = status.status === 'unhealthy' ? 503 : 200;
    res.status(httpStatus).json(status);
  };
}