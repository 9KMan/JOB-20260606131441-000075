// Broker API Type Definitions
// Strict TypeScript — no `any` allowed

export interface BrokerTokens {
  id: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrokerAccount {
  id: string;
  brokerAccountId: string;
  masterAccountId: string | null;
  status: 'active' | 'suspended' | 'closed';
  createdAt: Date;
}

export interface EquityRecord {
  time: Date;
  accountId: string;
  equity: number;
  cashBalance: number;
  marginUsed: number;
  deviceName: string;
}

export interface Position {
  id: string;
  accountId: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  updatedAt: Date;
}

export type BreachType = 'daily_loss' | 'max_drawdown' | 'profit_target';

export interface RiskEvent {
  id: string;
  accountId: string;
  breachType: BreachType;
  thresholdValue: number;
  actualValue: number;
  triggeredAt: Date;
  liquidationTriggered: boolean;
}

export interface Fill {
  id: string;
  accountId: string;
  symbol: string;
  quantity: number;
  price: number;
  side: 'buy' | 'sell';
  executedAt: Date;
}

// WebSocket event types
export type BrokerEventType = 'riskStatus' | 'cashBalance' | 'positions' | 'fills';

export interface BrokerWebSocketEvent<T> {
  type: BrokerEventType;
  accountId: string;
  data: T;
  timestamp: number;
}

// OAuth types
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// REST API response types
export interface RiskStatusResponse {
  accountId: string;
  dailyLoss: number;
  maxDrawdown: number;
  profitTarget: number;
  marginUsed: number;
  marginAvailable: number;
}

export interface LiquidationRequest {
  accountId: string;
  reason: string;
  breachType: BreachType;
}