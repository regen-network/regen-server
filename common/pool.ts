import * as fs from 'fs';
import { Pool, PoolConfig } from 'pg';

function setupPgPool(): Pool {
  const poolConfig: PoolConfig = {
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/regen_registry',
  };

  if (process.env.NODE_ENV === 'production') {
    poolConfig.ssl = {
      ca: fs.readFileSync(`${__dirname}/../config/rds-combined-ca-bundle.pem`),
    };
  }

  const pool = new Pool(poolConfig);
  return pool;
}

function setupPgPoolIndexer(): Pool {
  const poolConfig: PoolConfig = {
    connectionString:
      process.env.INDEXER_DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/indexer',
  };

  if (
    process.env.NODE_ENV !== 'production' &&
    !poolConfig.connectionString.includes('localhost:5432')
  ) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  const pool = new Pool(poolConfig);
  return pool;
}

const pgPool = setupPgPool();
const pgPoolIndexer = setupPgPoolIndexer();

export { pgPool, pgPoolIndexer };
