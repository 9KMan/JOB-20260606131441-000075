# Phase 3: Architecture Design

## Phase Goal
Design the complete system architecture for the broker integration layer.

## Architecture Components
1. **BrokerConnector** — OAuth flow, token management, REST client, WebSocket client
2. **RiskEngine** — breach detection (daily loss, max drawdown, profit target), force-liquidation triggers
3. **DataPipeline** — WebSocket event handling, equity_history writes, position tracking
4. **Observability** — structured logging, Sentry integration, health endpoints

## API Design
- `POST /api/broker/connect` — OAuth initiation
- `POST /api/broker/accounts` — Provision master account
- `GET /api/broker/positions` — Current positions
- `GET /api/broker/risk-status` — Current risk metrics
- `POST /api/broker/liquidate` — Force liquidation trigger
- `GET /api/health` — Health endpoint with broker connection status

## Data Flow
Broker WebSocket → Events → RiskEngine → DB write → Centrifugo → UI update
Broker REST → OAuth tokens → encrypted storage → refresh logic

## Error Handling
- Network errors: exponential backoff (1s, 2s, 4s, 8s, max 60s)
- Rate limits: queue + retry after penalty period
- Auth failures: re-initiate OAuth flow
- Idempotent message processing for all events