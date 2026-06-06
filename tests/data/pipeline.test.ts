/**
 * Unit tests for DataPipeline — verifies DB writes for each event type.
 */

import { DataPipeline } from '../../src/data/pipeline';

const fakePool = (impl: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>) =>
  ({ query: jest.fn(impl) } as unknown as import('pg').Pool);

describe('DataPipeline', () => {
  it('handleEquityEvent inserts into equity_history with broker-ws device tag', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const db = fakePool(async (sql, params) => {
      queries.push({ sql, params: params ?? [] });
      return { rows: [], rowCount: 1 };
    });
    const pipeline = new DataPipeline(db);

    await pipeline.handleEquityEvent({
      type: 'cashBalance',
      accountId: 'a-1',
      data: { equity: 10_000, cashBalance: 8_000, marginUsed: 2_000 },
      timestamp: 1_700_000_000_000,
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toMatch(/INSERT INTO equity_history/);
    expect(queries[0].params[5]).toBe('broker-ws');
  });

  it('handlePositionEvent upserts each position with computed unrealized PnL', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const db = fakePool(async (sql, params) => {
      queries.push({ sql, params: params ?? [] });
      return { rows: [], rowCount: 1 };
    });
    const pipeline = new DataPipeline(db);

    await pipeline.handlePositionEvent({
      type: 'positions',
      accountId: 'a-1',
      data: [
        { symbol: 'AAPL', quantity: 10, avgPrice: 150, currentPrice: 160 },
        { symbol: 'TSLA', quantity: 5, avgPrice: 250, currentPrice: 240 },
      ],
      timestamp: 1_700_000_000_000,
    });

    expect(queries).toHaveLength(2);
    // AAPL: (160-150)*10 = 100
    expect(queries[0].params[1]).toBe('AAPL');
    expect(queries[0].params[5]).toBe(100);
    // TSLA: (240-250)*5 = -50
    expect(queries[1].params[1]).toBe('TSLA');
    expect(queries[1].params[5]).toBe(-50);
  });

  it('handleFillEvent inserts into fills with the fill id from payload', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const db = fakePool(async (sql, params) => {
      queries.push({ sql, params: params ?? [] });
      return { rows: [], rowCount: 1 };
    });
    const pipeline = new DataPipeline(db);

    await pipeline.handleFillEvent({
      type: 'fills',
      accountId: 'a-1',
      data: {
        id: 'fill-xyz',
        accountId: 'a-1',
        symbol: 'MSFT',
        quantity: 2,
        price: 305.5,
        side: 'buy',
        executedAt: new Date('2025-01-15T10:00:00Z'),
      },
      timestamp: 1_700_000_000_000,
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toMatch(/INSERT INTO fills/);
    expect(queries[0].params[0]).toBe('fill-xyz');
    expect(queries[0].params[3]).toBe(2);
    expect(queries[0].params[5]).toBe('buy');
  });
});
