/**
 * Express application entry point for ГдеДешевле API.
 *
 * Responsibilities:
 *  - Configure Express with JSON parser, CORS, and request logging
 *  - Mount API route handlers
 *  - Provide a health-check endpoint
 *  - Global error handler
 *  - Start the HTTP server
 */
import 'dotenv/config';

import express, {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from 'express';
import cors from 'cors';

import { config } from './config.js';
import productsRouter from './routes/products.js';
import pricesRouter from './routes/prices.js';
import storesRouter from './routes/stores.js';
import { pool } from './db/connection.js';
import { runScrapeNow } from './cron/scrape-job.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

/** Parse incoming JSON bodies */
app.use(express.json());

/** CORS — allow the configured origin(s) */
app.use(
  cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

/**
 * Request logging middleware.
 * Logs: METHOD /path HTTP/x.x → STATUS  XXXms
 */
app.use((req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(
      `[${level}] ${req.method} ${req.originalUrl} → ${res.statusCode}  ${duration}ms`,
    );
  });

  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** Health check — useful for container probes and uptime monitors */
app.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Product search */
app.use('/api/products', productsRouter);

/** Price lookups */
app.use('/api/prices', pricesRouter);

/** Store listings */
app.use('/api/stores', storesRouter);

/** Manual scrape trigger — POST /api/scrape to run all scrapers immediately */
app.post('/api/scrape', async (_req: Request, res: Response): Promise<void> => {
  console.info('[API] Manual scrape triggered');
  try {
    const stats = await runScrapeNow();
    const totals = stats.reduce(
      (acc, s) => ({
        totalScraped: acc.totalScraped + s.totalScraped,
        matched: acc.matched + s.matched,
        inserted: acc.inserted + s.inserted,
        errors: acc.errors + s.errors,
      }),
      { totalScraped: 0, matched: 0, inserted: 0, errors: 0 },
    );
    res.json({
      status: 'ok',
      summary: totals,
      stores: stats,
    });
  } catch (err) {
    console.error('[API] Scrape failed:', err);
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/** GET /api/scrape/:store — run a single store scraper */
app.post('/api/scrape/:store', async (req: Request, res: Response): Promise<void> => {
  const store = req.params.store;
  console.info(`[API] Manual scrape triggered for store: ${store}`);
  try {
    const { STORE_SLUGS } = await import('./scrapers/index.js');
    if (!STORE_SLUGS.includes(store as any)) {
      res.status(400).json({ error: `Unknown store: ${store}. Available: ${STORE_SLUGS.join(', ')}` });
      return;
    }
    const stats = await runScrapeNow([store as any]);
    res.json({
      status: 'ok',
      store,
      stats: stats[0] ?? null,
    });
  } catch (err) {
    console.error(`[API] Scrape for ${store} failed:`, err);
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/** 404 catch-all — any unmatched route */
app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // `next` must be present in the signature even if unused — Express requires 4 args
  _next: NextFunction,
): void => {
  console.error('[ERROR]', err.stack ?? err.message);

  // Don't leak internal details in production
  const message =
    config.nodeEnv === 'production'
      ? 'An unexpected error occurred'
      : err.message;

  res.status(500).json({
    error: 'Internal Server Error',
    message,
  });
};

app.use(errorHandler);

// ── Startup ───────────────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  console.info(`[Server] ГдеДешевле API listening on port ${config.port}`);
  console.info(`[Server] Environment: ${config.nodeEnv}`);
  console.info(`[Server] CORS origin: ${config.corsOrigin}`);
});

/** Graceful shutdown — wait for in-flight requests, then close DB pool */
async function shutdown(signal: string): Promise<void> {
  console.info(`[Server] Received ${signal} — shutting down gracefully`);

  server.close(async () => {
    try {
      await pool.end();
      console.info('[Server] DB pool closed — goodbye');
    } catch (err) {
      console.error('[Server] Error closing DB pool:', (err as Error).message);
    } finally {
      process.exit(0);
    }
  });

  // Force exit after 10 seconds if server hasn't closed
  setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;
