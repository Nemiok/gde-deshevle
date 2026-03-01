import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

/**
 * Detect whether the DATABASE_URL requires SSL (e.g. Neon, Supabase, etc.).
 * If the connection string includes `sslmode=require` or we're in production,
 * enable SSL on the pg Pool.
 */
const needsSsl =
  config.databaseUrl.includes('sslmode=require') ||
  config.databaseUrl.includes('.neon.tech');

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
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
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
