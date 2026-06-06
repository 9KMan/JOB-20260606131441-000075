import { Pool } from 'pg';
import { BreachType, RiskEvent, RiskStatusResponse } from '../broker/types.js';
import { BrokerRestClient } from '../broker/rest-client.js';

export interface RiskThresholds {
  dailyLossLimit: number;
  maxDrawdownLimit: number;
  profitTargetLimit: number;
}

export class RiskEngine {
  constructor(
    private readonly db: Pool,
    private readonly restClient: BrokerRestClient,
    private readonly thresholds: RiskThresholds
  ) {}

  /** Check risk status and trigger liquidation if breached */
  async checkAndRespond(accountId: string): Promise<RiskEvent | null> {
    const status = await this.restClient.getRiskStatus(accountId);

    const breaches: Array<{ type: BreachType; actual: number; threshold: number }> = [];

    if (status.dailyLoss >= this.thresholds.dailyLossLimit) {
      breaches.push({ type: 'daily_loss', actual: status.dailyLoss, threshold: this.thresholds.dailyLossLimit });
    }
    if (status.maxDrawdown >= this.thresholds.maxDrawdownLimit) {
      breaches.push({ type: 'max_drawdown', actual: status.maxDrawdown, threshold: this.thresholds.maxDrawdownLimit });
    }
    if (status.profitTarget > 0 && status.profitTarget <= this.thresholds.profitTargetLimit) {
      breaches.push({ type: 'profit_target', actual: status.profitTarget, threshold: this.thresholds.profitTargetLimit });
    }

    if (breaches.length === 0) {
      return null;
    }

    // Log breach and trigger liquidation
    for (const breach of breaches) {
      const event = await this.logRiskEvent(accountId, breach.type, breach.threshold, breach.actual);
      await this.restClient.triggerLiquidation({
        accountId,
        reason: `${breach.type} breached: ${breach.actual} >= ${breach.threshold}`,
        breachType: breach.type,
      });
      await this.updateEventLiqStatus(event.id, true);
    }

    return null;
  }

  /** Reset account risk limits */
  async resetAccount(accountId: string): Promise<void> {
    await this.restClient.resetAccount(accountId);
  }

  private async logRiskEvent(
    accountId: string,
    breachType: BreachType,
    threshold: number,
    actual: number
  ): Promise<RiskEvent> {
    const result = await this.db.query<{
      id: string; accountId: string; breachType: BreachType;
      thresholdValue: number; actualValue: number;
      triggeredAt: Date; liquidationTriggered: boolean;
    }>(
      `INSERT INTO risk_events (account_id, breach_type, threshold_value, actual_value)
       VALUES ($1, $2, $3, $4)
       RETURNING id, account_id, breach_type, threshold_value, actual_value, triggered_at, liquidation_triggered`,
      [accountId, breachType, threshold, actual]
    );
    const row = result.rows[0];
    return {
      id: row.id, accountId: row.accountId, breachType: row.breachType,
      thresholdValue: Number(row.thresholdValue), actualValue: Number(row.actualValue),
      triggeredAt: row.triggeredAt, liquidationTriggered: row.liquidationTriggered,
    };
  }

  private async updateEventLiqStatus(eventId: string, triggered: boolean): Promise<void> {
    await this.db.query(
      `UPDATE risk_events SET liquidation_triggered = $1 WHERE id = $2`,
      [triggered, eventId]
    );
  }
}