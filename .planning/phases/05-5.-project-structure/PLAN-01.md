# Phase 5: Project Structure & Implementation

## Phase Goal
Implement the complete broker integration layer.

## Directory Structure
```
src/
  broker/
    connector.ts        # OAuth flow, encrypted token management
    rest-client.ts      # REST API calls to broker
    websocket.ts       # WebSocket client with exponential backoff
    types.ts            # TypeScript type definitions
  risk/
    engine.ts           # Breach detection logic
    liquidation.ts      # Force liquidation triggers
  data/
    pipeline.ts         # Event processing pipeline
    equity-history.ts   # TimescaleDB writes
  observability/
    logger.ts           # Structured JSON logging
    sentry.ts           # Sentry integration
    health.ts           # Health endpoints
  api/
    broker.routes.ts    # /api/broker/* routes
    health.routes.ts     # /api/health routes
  config/
    index.ts            # Configuration loader
tests/
  broker/
    connector.test.ts
    websocket.test.ts
  risk/
    engine.test.ts
migrations/
  001_broker_tokens.sql
  002_equity_history.sql
  003_positions.sql
  004_risk_events.sql
.github/
  workflows/
    deploy.yml          # Fixed CI/CD with renewed auth
```

## Key Implementation Details

### OAuth Token Storage
- Encrypt tokens with AES-256 before storing in broker_tokens table
- Use environment variable for encryption key
- Implement refresh logic with automatic re-encryption

### WebSocket Reconnection
```typescript
const BACKOFF = [1000, 2000, 4000, 8000, 16000, 32000, 60000];
// Exponential backoff, max 60 seconds
```

### Rate Limit Handling
- Track 429 responses with penalty period
- Implement request queue with priority
- Log rate limit events for analysis