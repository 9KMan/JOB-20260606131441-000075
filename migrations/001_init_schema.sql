-- ─── 001_init_schema.sql ─────────────────────────────────────────────────
-- Initial schema for broker integration service.
-- Tables: broker_tokens, broker_accounts, risk_events, equity_history,
--         positions, fills
-- All tables use UUIDs (gen_random_uuid()) and include created_at/updated_at.
-- Indexes target high-cardinality columns (account_id, symbol, time).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── broker_tokens ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broker_tokens (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_access_token    TEXT NOT NULL,
  encrypted_refresh_token   TEXT NOT NULL,
  token_expires_at          TIMESTAMPTZ NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_tokens_created_at
  ON broker_tokens (created_at DESC);

-- ─── broker_accounts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broker_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_account_id  TEXT NOT NULL UNIQUE,
  master_account_id  TEXT NULL,
  status             TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'closed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_accounts_master
  ON broker_accounts (master_account_id) WHERE master_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_broker_accounts_status
  ON broker_accounts (status);

-- ─── risk_events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            TEXT NOT NULL,
  breach_type           TEXT NOT NULL CHECK (breach_type IN ('daily_loss', 'max_drawdown', 'profit_target')),
  threshold_value       NUMERIC(18, 2) NOT NULL,
  actual_value          NUMERIC(18, 2) NOT NULL,
  triggered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  liquidation_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_events_account
  ON risk_events (account_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_breach
  ON risk_events (breach_type, triggered_at DESC);

-- ─── equity_history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equity_history (
  time         TIMESTAMPTZ NOT NULL,
  account_id   TEXT NOT NULL,
  equity       NUMERIC(18, 2) NOT NULL,
  cash_balance NUMERIC(18, 2) NOT NULL,
  margin_used  NUMERIC(18, 2) NOT NULL,
  device_name  TEXT NOT NULL DEFAULT 'broker-ws',
  PRIMARY KEY (time, account_id)
);

CREATE INDEX IF NOT EXISTS idx_equity_history_account_time
  ON equity_history (account_id, time DESC);

-- ─── positions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  quantity        NUMERIC(18, 6) NOT NULL,
  avg_price       NUMERIC(18, 6) NOT NULL,
  current_price   NUMERIC(18, 6) NOT NULL,
  unrealized_pnl  NUMERIC(18, 2) NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_positions_account
  ON positions (account_id, updated_at DESC);

-- ─── fills ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fills (
  id           UUID PRIMARY KEY,
  account_id   TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  quantity     NUMERIC(18, 6) NOT NULL,
  price        NUMERIC(18, 6) NOT NULL,
  side         TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  executed_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fills_account_time
  ON fills (account_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_fills_symbol_time
  ON fills (symbol, executed_at DESC);

-- ─── updated_at trigger function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['broker_tokens', 'broker_accounts', 'positions'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_set_updated_at ON %I;
       CREATE TRIGGER trg_%I_set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;
