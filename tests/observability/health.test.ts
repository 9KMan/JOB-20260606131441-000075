/**
 * Unit tests for the health check handler.
 */

import { Request, Response } from 'express';
import { createHealthHandler } from '../../src/observability/health';

const mockReq = () => ({}) as Request;
const mockRes = (): Response => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

describe('createHealthHandler', () => {
  it('returns 200 healthy when db and broker both succeed', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{}] }) } as unknown as import('pg').Pool;
    const handler = createHealthHandler(db, async () => true);
    const res = mockRes();

    await handler(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('healthy');
    expect(body.checks.database).toBe('ok');
    expect(body.checks.brokerConnection).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('returns 200 degraded when db ok but broker down', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{}] }) } as unknown as import('pg').Pool;
    const handler = createHealthHandler(db, async () => false);
    const res = mockRes();

    await handler(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('degraded');
    expect(body.checks.brokerConnection).toBe('fail');
  });

  it('returns 503 unhealthy when db fails', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('db down')) } as unknown as import('pg').Pool;
    const handler = createHealthHandler(db, async () => true);
    const res = mockRes();

    await handler(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('unhealthy');
    expect(body.checks.database).toBe('fail');
  });

  it('returns 200 degraded when broker check throws (DB still ok)', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{}] }) } as unknown as import('pg').Pool;
    const handler = createHealthHandler(db, async () => { throw new Error('broker unreachable'); });
    const res = mockRes();

    await handler(mockReq(), res);

    // When the broker is unreachable but DB is up, we report 'degraded' (200)
    // rather than 'unhealthy' (503) so that load balancers don't take the
    // service out of rotation during a transient broker outage.
    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.status).toBe('degraded');
    expect(body.checks.brokerConnection).toBe('fail');
  });
});
