# Phase 4: Data Model & Migrations

## Phase Goal
Define database schema for broker integration with proper migrations.

## New Tables
1. **broker_tokens** — OAuth tokens (encrypted, with refresh logic)
2. **broker_accounts** — Master account tracking
3. **equity_history** — TimescaleDB hypertable for time-series equity data
4. **positions** — Real-time position tracking
5. **risk_events** — Breach event logging
6. **fills** — Trade fill events

## Migrations (SQL)
```sql
-- broker_tokens
CREATE TABLE broker_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- broker_accounts
CREATE TABLE broker_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_account_id VARCHAR(255) UNIQUE NOT NULL,
  master_account_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- equity_history (TimescaleDB)
CREATE TABLE equity_history (
  time TIMESTAMPTZ NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  equity NUMERIC(18,4) NOT NULL,
  cash_balance NUMERIC(18,4),
  margin_used NUMERIC(18,4),
  device_name VARCHAR(100)
);
SELECT create_hypertable('equity_history', 'time');

-- positions
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  quantity NUMERIC(18,4) NOT NULL,
  avg_price NUMERIC(18,4),
  current_price NUMERIC(18,4),
  unrealized_pnl NUMERIC(18,4),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- risk_events
CREATE TABLE risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id VARCHAR(255) NOT NULL,
  breach_type VARCHAR(50) NOT NULL,
  threshold_value NUMERIC(18,4),
  actual_value NUMERIC(18,4),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  liquidation_triggered BOOLEAN DEFAULT FALSE
);
```

## Indexes
- equity_history: time, account_id
- positions: account_id, symbol
- risk_events: created_at, breach_type