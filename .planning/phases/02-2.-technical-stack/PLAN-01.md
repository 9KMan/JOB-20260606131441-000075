# Phase 2: Technical Stack & Dependencies

## Phase Goal
Define the complete technical architecture, dependencies, and integration points.

## Technical Architecture
- REST + WebSocket dual protocol for broker communication
- OAuth 2.0 with encrypted token storage in Postgres
- WebSocket sync: events → equity_history table (TimescaleDB)
- Exponential backoff reconnection with idempotent message handling
- Rate limit handling (429 + penalty ticket mechanism)

## Dependencies (package.json)
```json
{
  "dependencies": {
    "ws": "^8.16.0",
    "axios": "^1.6.0",
    "pg": "^8.11.0",
    "bcryptjs": "^2.4.3",
    "@sentry/node": "^7.100.0",
    "centrifugal": "^4.3.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "@types/bcryptjs": "^2.4.6",
    "@types/pg": "^8.11.0",
    "typescript": "^5.3.0"
  }
}
```

## Database Schema Additions
- broker_tokens — encrypted OAuth tokens with refresh logic
- broker_accounts — master account tracking
- equity_history — TimescaleDB hypertable for time-series equity data
- positions — real-time position tracking
- risk_events — breach event logging

## Infrastructure
- Docker Compose on dedicated server
- Traefik SSL termination
- Redis for session/caching
- Sentry for error tracking
- GitHub Actions for CI/CD