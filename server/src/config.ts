/**
 * Application configuration loaded from environment variables.
 * All values have sensible defaults for local development.
 */
import 'dotenv/config';

export const config = {
  /** PostgreSQL connection string */
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/gdedeshevle',

  /** Redis connection string */
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  /** HTTP server port */
  port: parseInt(process.env.PORT ?? '3001', 10),

  /** Allowed CORS origin(s) — use '*' during development */
  corsOrigin: process.env.CORS_ORIGIN ?? '*',

  /** Redis cache TTL in seconds (default: 6 hours) */
  cacheTtl: parseInt(process.env.CACHE_TTL ?? '21600', 10),

  /** Runtime environment */
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;

export type Config = typeof config;
