import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

/**
 * Shared PostgreSQL connection pool.
 *
 * max: 10 connections — enough for typical API workloads.
 * idleTimeoutMillis: connections are released after 30 s of idle time.
 * connectionTimeoutMillis: fail fast if the DB is unreachable.
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/** Emitted when a new client is created — useful for debugging pool growth */
pool.on('connect', (_client) => {
  // Uncomment for verbose connection logging:
  // console.debug('[DB] New connection established');
});

/** Log and rethrow unexpected pool-level errors */
pool.on('error', (err, _client) => {
  console.error('[DB] Unexpected pool error:', err.message);
  // Do NOT process.exit here — let the app keep running and attempt recovery
});
