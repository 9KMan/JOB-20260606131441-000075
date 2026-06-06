import { Pool } from 'pg';
import { BrokerWebSocketEvent, EquityRecord, Position, Fill } from '../broker/types.js';

export class DataPipeline {
  constructor(private readonly db: Pool) {}

  /** Process equity history event → write to TimescaleDB */
  async handleEquityEvent(event: BrokerWebSocketEvent<{ equity: number; cashBalance: number; marginUsed: number }>): Promise<void> {
    const data = event.data;
    await this.db.query(
      `INSERT INTO equity_history (time, account_id, equity, cash_balance, margin_used, device_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [new Date(event.timestamp), event.accountId, data.equity, data.cashBalance, data.marginUsed, 'broker-ws']
    );
  }

  /** Process position update → upsert position record */
  async handlePositionEvent(event: BrokerWebSocketEvent<Array<{
    symbol: string; quantity: number; avgPrice: number; currentPrice: number
  }>>): Promise<void> {
    const positions = event.data;
    for (const pos of positions) {
      const unrealizedPnl = (pos.currentPrice - pos.avgPrice) * pos.quantity;
      await this.db.query(
        `INSERT INTO positions (id, account_id, symbol, quantity, avg_price, current_price, unrealized_pnl, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (account_id, symbol) DO UPDATE SET
           quantity = EXCLUDED.quantity, avg_price = EXCLUDED.avg_price,
           current_price = EXCLUDED.current_price, unrealized_pnl = EXCLUDED.unrealized_pnl,
           updated_at = NOW()`,
        [event.accountId, pos.symbol, pos.quantity, pos.avgPrice, pos.currentPrice, unrealizedPnl]
      );
    }
  }

  /** Process fill event → record trade fill */
  async handleFillEvent(event: BrokerWebSocketEvent<Fill>): Promise<void> {
    const fill = event.data;
    await this.db.query(
      `INSERT INTO fills (id, account_id, symbol, quantity, price, side, executed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [fill.id, event.accountId, fill.symbol, fill.quantity, fill.price, fill.side, new Date(fill.executedAt)]
    );
  }

  /** Process risk status event → check breach */
  async handleRiskStatusEvent(event: BrokerWebSocketEvent<{ dailyLoss: number; maxDrawdown: number }>): Promise<void> {
    // Risk engine handles response — this pipeline just records the event
    await this.db.query(
      `INSERT INTO equity_history (time, account_id, equity, cash_balance, margin_used, device_name)
       VALUES ($1, $2, -1, -1, -1, 'risk-status')`,
      [new Date(event.timestamp), event.accountId]
    );
  }
}