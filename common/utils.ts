import * as fs from 'fs';
import { Pool, Client, PoolConfig } from 'pg';

function setupPgPool() {
  const poolConfig: PoolConfig = {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/regen_registry',
  };

  if (process.env.NODE_ENV === 'production') {
    poolConfig.ssl = {
      ca: fs.readFileSync(`${__dirname}/../config/rds-combined-ca-bundle.pem`),
    };
  }

  const pool = new Pool(poolConfig);
  return pool;
}

const pgPool = setupPgPool();

export { pgPool };
