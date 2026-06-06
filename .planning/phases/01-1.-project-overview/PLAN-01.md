# Phase 1: Project Overview — Broker API Integration

## Phase Goal
Define the complete project scope, context, and success criteria for the TypeScript broker API integration project.

## Context
- Client: Jules (trading platform)
- Budget: $6,000 fixed
- Engagement: 3-month contract, 30-40h/week
- Timezone: CET ±4h overlap required
- Production stack: Next.js 16, React 19, Supabase Auth, Stripe, Sumsub KYC, Rust risk engine, Docker Compose, Traefik SSL, Postgres+TimescaleDB, Redis, Centrifugo WebSocket, Sentry

## Scope
1. Broker API Integration (~60%) — OAuth + token storage, REST provisioning, WebSocket sync (riskStatus, cashBalance, positions, fills), reconnection, rate limit handling
2. Risk Rule Wiring (~20%) — Breach detection, force-liquidation, DB state, account reset
3. CI/CD Fix (~10%) — Fix deploy.yml expired auth token, restore staging+prod paths
4. Observability (~10%) — Structured logging, Sentry alerting, health endpoint, Rust data contract doc

## Tech Stack
TypeScript strict · Next.js 16 · Supabase (Postgres) · SWR · Docker Compose · GitHub Actions · Sentry · Centrifugo · Rust (read-only)

## Deliverables
- PROJECT_OVERVIEW.md — complete context document
- SCOPE.md — detailed scope breakdown with estimates
- README.md — updated with Business Problem Solved section