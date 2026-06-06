/**
 * Unit tests for RiskEngine — verifies breach detection and DB writes.
 * Uses an in-memory pool stub.
 */

import { RiskEngine } from '../../src/risk/engine';
import { BrokerRestClient } from '../../src/broker/rest-client';

const mockRestClient = (riskStatus: unknown) =>
  ({
    getRiskStatus: jest.fn().mockResolvedValue(riskStatus),
    triggerLiquidation: jest.fn().mockResolvedValue(undefined),
    resetAccount: jest.fn().mockResolvedValue(undefined),
  } as unknown as BrokerRestClient);

const fakePool = (impl: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>) =>
  ({ query: jest.fn(impl) } as unknown as import('pg').Pool);

describe('RiskEngine', () => {
  const thresholds = {
    dailyLossLimit: 5_000,
    maxDrawdownLimit: 10_000,
    profitTargetLimit: 50_000,
  };

  it('returns null when no thresholds are breached', async () => {
    const rest = mockRestClient({
      accountId: 'a-1',
      dailyLoss: 100,
      maxDrawdown: 200,
      profitTarget: 0,
      marginUsed: 0,
      marginAvailable: 1000,
    });
    const db = fakePool(async () => ({ rows: [], rowCount: 0 }));

    const engine = new RiskEngine(db, rest, thresholds);
    const result = await engine.checkAndRespond('a-1');

    expect(result).toBeNull();
    expect(rest.triggerLiquidation).not.toHaveBeenCalled();
  });

  it('triggers liquidation when daily loss exceeds limit', async () => {
    const rest = mockRestClient({
      accountId: 'a-1',
      dailyLoss: 6_000,
      maxDrawdown: 100,
      profitTarget: 0,
      marginUsed: 0,
      marginAvailable: 0,
    });

    const db = fakePool(async (sql: string) => {
      if (sql.startsWith('INSERT INTO risk_events')) {
        return {
          rows: [{
            id: 'evt-1',
            account_id: 'a-1',
            breach_type: 'daily_loss',
            threshold_value: '5000',
            actual_value: '6000',
            triggered_at: new Date(),
            liquidation_triggered: false,
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('UPDATE risk_events')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const engine = new RiskEngine(db, rest, thresholds);
    await engine.checkAndRespond('a-1');

    expect(rest.triggerLiquidation).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'a-1',
        breachType: 'daily_loss',
      })
    );
  });

  it('triggers liquidation for max_drawdown breach', async () => {
    const rest = mockRestClient({
      accountId: 'a-1',
      dailyLoss: 0,
      maxDrawdown: 12_000,
      profitTarget: 0,
      marginUsed: 0,
      marginAvailable: 0,
    });

    const db = fakePool(async (sql: string) => {
      if (sql.startsWith('INSERT INTO risk_events')) {
        return {
          rows: [{
            id: 'evt-2',
            account_id: 'a-1',
            breach_type: 'max_drawdown',
            threshold_value: '10000',
            actual_value: '12000',
            triggered_at: new Date(),
            liquidation_triggered: false,
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('UPDATE risk_events')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const engine = new RiskEngine(db, rest, thresholds);
    await engine.checkAndRespond('a-1');

    expect(rest.triggerLiquidation).toHaveBeenCalledWith(
      expect.objectContaining({ breachType: 'max_drawdown' })
    );
  });

  it('triggers liquidation for profit_target when actual <= limit and > 0', async () => {
    const rest = mockRestClient({
      accountId: 'a-1',
      dailyLoss: 0,
      maxDrawdown: 0,
      profitTarget: 30_000,
      marginUsed: 0,
      marginAvailable: 0,
    });

    const db = fakePool(async (sql: string) => {
      if (sql.startsWith('INSERT INTO risk_events')) {
        return {
          rows: [{
            id: 'evt-3',
            account_id: 'a-1',
            breach_type: 'profit_target',
            threshold_value: '50000',
            actual_value: '30000',
            triggered_at: new Date(),
            liquidation_triggered: false,
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('UPDATE risk_events')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const engine = new RiskEngine(db, rest, thresholds);
    await engine.checkAndRespond('a-1');

    expect(rest.triggerLiquidation).toHaveBeenCalledWith(
      expect.objectContaining({ breachType: 'profit_target' })
    );
  });

  it('does NOT trigger profit_target when actual is 0', async () => {
    const rest = mockRestClient({
      accountId: 'a-1',
      dailyLoss: 0,
      maxDrawdown: 0,
      profitTarget: 0,
      marginUsed: 0,
      marginAvailable: 0,
    });
    const db = fakePool(async () => ({ rows: [], rowCount: 0 }));

    const engine = new RiskEngine(db, rest, thresholds);
    await engine.checkAndRespond('a-1');

    expect(rest.triggerLiquidation).not.toHaveBeenCalled();
  });

  it('resetAccount delegates to restClient', async () => {
    const rest = mockRestClient({});
    const db = fakePool(async () => ({ rows: [], rowCount: 0 }));

    const engine = new RiskEngine(db, rest, thresholds);
    await engine.resetAccount('a-1');

    expect(rest.resetAccount).toHaveBeenCalledWith('a-1');
  });
});
