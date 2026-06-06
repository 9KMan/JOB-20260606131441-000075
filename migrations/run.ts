// Migration runner: executes every .sql file in this directory in
// lexical order. Idempotent — all migrations use IF NOT EXISTS.
//
// Usage:
//   npm run migrate

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { config } from '../src/config';

async function main(): Promise<void> {
  const db = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  });

  const migrationsDir = __dirname;
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  for (const file of files) {
    const fullPath = join(migrationsDir, file);
    const sql = readFileSync(fullPath, 'utf-8');
    console.log(`Running ${file}...`);
    try {
      await db.query(sql);
      console.log(`OK ${file} applied`);
    } catch (err) {
      console.error(`FAIL ${file}:`, (err as Error).message);
      await db.end();
      process.exit(1);
    }
  }

  await db.end();
  console.log('All migrations complete.');
}

main().catch((err) => {
  console.error('Migration runner fatal:', err);
  process.exit(1);
});
