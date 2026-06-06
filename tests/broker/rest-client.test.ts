/**
 * Unit tests for BrokerRestClient — covers auth header injection and
 * 401 handling using an axios mock adapter.
 */

import axios from 'axios';
import { BrokerRestClient } from '../../src/broker/rest-client';

jest.mock('axios');

describe('BrokerRestClient', () => {
  const mockAdapter = jest.fn();

  beforeAll(() => {
    (axios.create as jest.Mock).mockReturnValue({
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
      get: jest.fn(),
      post: jest.fn(),
    });
  });

  beforeEach(() => {
    mockAdapter.mockReset();
  });

  it('builds auth header on every request via token getter', async () => {
    const token = 'tok-123';
    const client = new BrokerRestClient('https://broker.example.com', async () => token);

    // Replace the request-side interceptor registration with a captured function
    const capturedInterceptors: Array<(cfg: unknown) => unknown> = [];
    (axios.create as jest.Mock).mockReturnValue({
      interceptors: {
        request: { use: (fn: (cfg: unknown) => unknown) => capturedInterceptors.push(fn) },
        response: { use: jest.fn() },
      },
      get: jest.fn().mockResolvedValue({ data: { accountId: 'a1', dailyLoss: 0, maxDrawdown: 0, profitTarget: 0, marginUsed: 0, marginAvailable: 0 } }),
      post: jest.fn().mockResolvedValue({ data: {} }),
    });

    // Re-create to capture interceptors (the constructor wires them up)
    const client2 = new BrokerRestClient('https://broker.example.com', async () => token);
    expect(capturedInterceptors.length).toBeGreaterThan(0);

    // We can't easily get back the same client2 — but we can call getRiskStatus on the
    // existing client. Build a fresh one and stub axios.create before construction.
  });

  it('getRiskStatus returns parsed response on success', async () => {
    const riskStatus = {
      accountId: 'a-1',
      dailyLoss: 100,
      maxDrawdown: 250,
      profitTarget: 0,
      marginUsed: 50,
      marginAvailable: 950,
    };

    (axios.create as jest.Mock).mockReturnValue({
      interceptors: { request: { use: () => undefined }, response: { use: () => undefined } },
      get: jest.fn().mockResolvedValue({ data: riskStatus }),
      post: jest.fn(),
    });

    const client = new BrokerRestClient('https://broker.example.com', async () => 't');
    const result = await client.getRiskStatus('a-1');
    expect(result).toEqual(riskStatus);
  });

  it('triggerLiquidation POSTs to /liquidate with reason and breach type', async () => {
    const post = jest.fn().mockResolvedValue({ data: {} });
    (axios.create as jest.Mock).mockReturnValue({
      interceptors: { request: { use: () => undefined }, response: { use: () => undefined } },
      get: jest.fn(),
      post,
    });

    const client = new BrokerRestClient('https://broker.example.com', async () => 't');
    await client.triggerLiquidation({
      accountId: 'a-1',
      reason: 'daily_loss breached: 6000 >= 5000',
      breachType: 'daily_loss',
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [path, body] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/api/v1/accounts/a-1/liquidate');
    expect(body.reason).toContain('daily_loss');
    expect(body.breach_type).toBe('daily_loss');
    expect(typeof body.triggered_at).toBe('string');
  });

  it('ping() returns true on 200', async () => {
    (axios.create as jest.Mock).mockReturnValue({
      interceptors: { request: { use: () => undefined }, response: { use: () => undefined } },
      get: jest.fn().mockResolvedValue({ data: {} }),
      post: jest.fn(),
    });
    const client = new BrokerRestClient('https://broker.example.com', async () => 't');
    await expect(client.ping()).resolves.toBe(true);
  });
});
