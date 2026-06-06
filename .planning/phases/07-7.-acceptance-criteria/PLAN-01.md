# Phase 7: Acceptance Criteria

## Phase Goal
Define clear acceptance criteria for all deliverables.

## Acceptance Criteria
1. OAuth flow completes and tokens stored encrypted in Postgres
2. WebSocket connects and syncs: riskStatus, cashBalance, positions, fills → equity_history
3. Reconnection with exponential backoff works (survives broker restart)
4. Rate limits handled gracefully (429 + penalty ticket)
5. Risk rules detect breach events and trigger force-liquidation via REST
6. DB state updates reflect in UI via Centrifugo WebSocket
7. Account reset endpoint functional
8. CI/CD fixed (deploy.yml works with renewed auth)
9. Structured logging for integration layer
10. Sentry alerting on breach events
11. Health endpoint returns broker connection status
12. Data contract documented with Rust engine
13. All code in TypeScript strict mode (no `any`)
14. Tests for broker connector and risk engine

## Verification Steps
- OAuth flow: initiate → authorize → tokens stored → refresh works
- WebSocket: connect → receive events → equity_history populated
- Reconnection: disconnect broker → verify reconnect with backoff
- Risk rules: trigger breach → verify liquidation call → verify DB state
- CI/CD: push to main → staging deploys → prod deploys