import dotenv from 'dotenv';
dotenv.config();

export const config = {
  broker: {
    baseUrl: process.env.BROKER_BASE_URL ?? '',
    wsUrl: process.env.BROKER_WS_URL ?? '',
    clientId: process.env.BROKER_CLIENT_ID ?? '',
    clientSecret: process.env.BROKER_CLIENT_SECRET ?? '',
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME ?? 'trading',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
  },
  risk: {
    dailyLossLimit: parseFloat(process.env.RISK_DAILY_LOSS_LIMIT ?? '5000'),
    maxDrawdownLimit: parseFloat(process.env.RISK_MAX_DRAWDOWN ?? '10000'),
    profitTargetLimit: parseFloat(process.env.RISK_PROFIT_TARGET ?? '50000'),
  },
  encryption: {
    key: process.env.TOKEN_ENCRYPTION_KEY ?? '',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
  },
};