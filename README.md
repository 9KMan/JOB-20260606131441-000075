# Broker Integration Service

A production-ready TypeScript backend service for a prop-trading platform that
provisions accounts on an external broker, syncs real-time data over
WebSocket, evaluates risk limits, and triggers force-liquidation on breach.

> **Project:** Jules (PoC) — broker API integration
> **Stack:** TypeScript strict · Node.js 20 · Express · PostgreSQL · WebSocket
> **Status:** Public PoC — code is in scope of the SPEC.md and ready to run.

---

## Features

- **OAuth 2.0 token storage** with AES-256-GCM at-rest encryption
- **REST client** for account provisioning, risk status, and force-liquidation
- **WebSocket client** with exponential-backoff reconnection and rate-limit handling
- **Risk engine** — checks daily-loss / max-drawdown / profit-target thresholds and triggers liquidation
- **Data pipeline** — persists equity, position, and fill events into PostgreSQL
- **Structured JSON logging** to stdout
- **Sentry** initialisation hook for error reporting
- **Health endpoint** (`GET /health`) reporting DB + broker reachability
- **Graceful shutdown** on SIGINT / SIGTERM
- **Docker** multi-stage build + Compose for local Postgres
- **GitHub Actions** CI: type-check, lint, test, build

---

## Project Structure

```
.
├── api/                  # (planned) FastAPI / Express routes + schemas  → src/api/
├── src/
│   ├── api/              # Express router(s) — broker endpoints
│   ├── broker/           # OAuth connector, REST + WebSocket clients
│   ├── config/           # Env-driven configuration
│   ├── data/             # Pipeline that writes broker events to Postgres
│   ├── observability/    # Logger, Sentry, health endpoint
│   ├── risk/             # Risk engine — breach detection + liquidation
│   └── index.ts          # Server entry point
├── migrations/           # Raw SQL migrations + runner
├── tests/                # Jest unit + integration tests
├── Dockerfile
├── docker-compose.yml
├── jest.config.js
├── tsconfig.json
└── package.json
```

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/9KMan/JOB-20260606131441-000075.git
cd JOB-20260606131441-000075
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in BROKER_CLIENT_ID, BROKER_CLIENT_SECRET,
# DB credentials, and a TOKEN_ENCRYPTION_KEY:
openssl rand -hex 32
```

### 3. Run database migrations

```bash
npm run migrate
```

### 4. Start the service

```bash
# Development (ts-node)
npm run dev

# Production
npm run build
npm start
```

The service binds to `PORT` (default `3000`).

### 5. Verify

```bash
curl http://localhost:3000/health
# { "status": "healthy", "checks": { "database": "ok", "brokerConnection": "ok" }, ... }
```

---

## Docker

```bash
docker compose up --build
```

This starts:
- The broker-integration service on `localhost:3000`
- A PostgreSQL 16 instance on `localhost:5432` (migrations run on startup)

The service waits for the database to become healthy before starting.

---

## API

All routes are mounted under `/api/v1/broker`.

| Method | Path                          | Description                                |
|--------|-------------------------------|--------------------------------------------|
| POST   | `/connect`                    | Start OAuth — returns authorization URL    |
| POST   | `/exchange`                   | Exchange OAuth code for tokens             |
| POST   | `/accounts`                   | Provision a master trading account         |
| GET    | `/positions/:accountId`       | Fetch current positions                    |
| GET    | `/risk-status/:accountId`     | Fetch current risk metrics                 |
| POST   | `/liquidate`                  | Trigger force-liquidation for an account   |
| POST   | `/reset/:accountId`           | Reset account (clear positions + limits)   |

### Example — provision an account

```bash
curl -X POST http://localhost:3000/api/v1/broker/accounts \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

---

## Environment Variables

| Variable                  | Required | Default                  | Notes                                            |
|---------------------------|----------|--------------------------|--------------------------------------------------|
| `PORT`                    | No       | `3000`                   | HTTP listen port                                 |
| `NODE_ENV`                | No       | `development`            | Sentry environment tag                           |
| `BROKER_BASE_URL`         | Yes      | —                        | Broker REST base URL                             |
| `BROKER_WS_URL`           | Yes      | —                        | Broker WebSocket URL                             |
| `BROKER_CLIENT_ID`        | Yes      | —                        | OAuth client id                                  |
| `BROKER_CLIENT_SECRET`    | Yes      | —                        | OAuth client secret                              |
| `DB_HOST`                 | No       | `localhost`              | Postgres host                                    |
| `DB_PORT`                 | No       | `5432`                   | Postgres port                                    |
| `DB_NAME`                 | No       | `trading`                | Database name                                    |
| `DB_USER`                 | No       | `postgres`               | Database user                                    |
| `DB_PASSWORD`             | Yes      | —                        | Database password                                |
| `TOKEN_ENCRYPTION_KEY`    | Yes      | —                        | 64-char hex (recommended) or arbitrary passphrase |
| `RISK_DAILY_LOSS_LIMIT`   | No       | `5000`                   | USD                                              |
| `RISK_MAX_DRAWDOWN`       | No       | `10000`                  | USD                                              |
| `RISK_PROFIT_TARGET`      | No       | `50000`                  | USD                                              |
| `SENTRY_DSN`              | No       | empty (Sentry disabled)  |                                                  |

---

## Testing

```bash
npm test                 # Run all tests
npm run test:coverage    # With coverage report
npm run lint             # TypeScript type-check (no emit)
```

The test suite uses Jest with `ts-jest` and includes:
- Token encryption round-trip
- Risk-engine breach detection
- Data-pipeline DB writes
- Health endpoint responses
- Logger structured-output

---

## Architecture Notes

### Token storage

OAuth access/refresh tokens are encrypted with **AES-256-GCM** before being
persisted to `broker_tokens`. The encryption key is derived from
`TOKEN_ENCRYPTION_KEY` (either a 64-char hex string, used directly, or a
passphrase passed through `scrypt`). Each encrypted blob is `iv || authTag ||
ciphertext` (base64).

### WebSocket lifecycle

The WebSocket client (`src/broker/websocket.ts`) implements:
- Exponential backoff on disconnect (1s, 2s, 4s, 8s, 16s, 32s, 60s)
- A penalty window for server-emitted 429 rate-limit events
- Per-event-type handler registration

### Risk engine

`src/risk/engine.ts` evaluates the broker's risk status against three
thresholds. If any threshold is breached, it:
1. Inserts a `risk_events` row capturing the breach
2. Calls `triggerLiquidation` on the broker
3. Updates the `risk_events` row marking `liquidation_triggered = true`

---

## License

Proprietary — Jules project PoC, internal use only.
