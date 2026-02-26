import cron from 'node-cron';
import { pool } from '../db/connection.js';
import { redisClient } from '../cache/redis.js';
import { STORE_SLUGS, getScraper, StoreSlug } from '../scrapers/index.js';
import { findBestMatch, CanonicalProduct } from '../scrapers/normalizer.js';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScrapeRunStats {
  store: StoreSlug;
  totalScraped: number;
  matched: number;
  inserted: number;
  errors: number;
  durationMs: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Load all canonical products (+ aliases) from the database.
 * Called once per scrape run to avoid per-product round-trips.
 */
async function loadCanonicalProducts(): Promise<CanonicalProduct[]> {
  const { rows } = await pool.query<{
    id: number;
    name: string;
    aliases: string[];
  }>(`
    SELECT p.id, p.name, COALESCE(array_agg(pa.alias) FILTER (WHERE pa.alias IS NOT NULL), '{}') AS aliases
    FROM products p
    LEFT JOIN product_aliases pa ON pa.product_id = p.id
    GROUP BY p.id, p.name
    ORDER BY p.id
  `);
  return rows;
}

/**
 * Load all store IDs keyed by slug.
 */
async function loadStoreIds(): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ slug: string; id: number }>(
    'SELECT slug, id FROM stores',
  );
  return Object.fromEntries(rows.map((r) => [r.slug, r.id]));
}

/**
 * Run the scraper for a single store, persist prices, and return stats.
 */
async function runStoreScape(slug: StoreSlug): Promise<ScrapeRunStats> {
  const start = Date.now();
  const stats: ScrapeRunStats = {
    store: slug,
    totalScraped: 0,
    matched: 0,
    inserted: 0,
    errors: 0,
    durationMs: 0,
  };

  try {
    const scraper = getScraper(slug);
    const rawProducts = await scraper.scrapeAll();
    stats.totalScraped = rawProducts.length;

    if (rawProducts.length === 0) {
      console.warn(`[CronJob] ${slug}: scraper returned 0 products — skipping persistence`);
      stats.durationMs = Date.now() - start;
      return stats;
    }

    const [canonicals, storeIds] = await Promise.all([
      loadCanonicalProducts(),
      loadStoreIds(),
    ]);

    const storeId = storeIds[slug];
    if (!storeId) {
      throw new Error(`Store slug "${slug}" not found in DB — run db:init`);
    }

    // ── Persist each matched product ────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Expire all existing prices for this store so stale data is replaced
      await client.query(
        `UPDATE prices SET scraped_at = NOW() - INTERVAL '7 days' WHERE store_id = $1`,
        [storeId],
      );

      for (const raw of rawProducts) {
        try {
          const match = findBestMatch(raw.storeProductName, canonicals);
          if (!match) continue;

          stats.matched++;

          await client.query(
            `
            INSERT INTO prices (product_id, store_id, price, price_per_unit, store_product_name, store_product_url, scraped_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (product_id, store_id)
            DO UPDATE SET
              price              = EXCLUDED.price,
              price_per_unit     = EXCLUDED.price_per_unit,
              store_product_name = EXCLUDED.store_product_name,
              store_product_url  = EXCLUDED.store_product_url,
              scraped_at         = NOW()
            `,
            [
              match.productId,
              storeId,
              raw.price,
              raw.pricePerUnit,
              raw.storeProductName,
              raw.url,
            ],
          );
          stats.inserted++;
        } catch (rowErr) {
          stats.errors++;
          console.error(`[CronJob] ${slug}: error inserting price for "${raw.storeProductName}":`, rowErr);
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // ── Invalidate related Redis cache keys ─────────────────────────────────
    try {
      const keys = await redisClient.keys(`prices:*:${storeId}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`[CronJob] ${slug}: invalidated ${keys.length} cache keys`);
      }
    } catch (cacheErr) {
      console.warn(`[CronJob] ${slug}: cache invalidation error (non-fatal):`, cacheErr);
    }
  } catch (err) {
    console.error(`[CronJob] ${slug}: fatal error:`, err);
    stats.errors++;
  }

  stats.durationMs = Date.now() - start;
  return stats;
}

// ── Cron job definition ────────────────────────────────────────────────────────

/**
 * Run all store scrapers sequentially every 12 hours.
 * Sequential (not parallel) to avoid hammering store servers concurrently.
 *
 * Schedule: 03:00 and 15:00 Moscow time (UTC+3) → 00:00 and 12:00 UTC.
 */
export function startScrapeJob(): void {
  const schedule = '0 0,12 * * *'; // twice daily at midnight and noon UTC

  cron.schedule(schedule, async () => {
    console.info(`[CronJob] Starting full scrape run — ${new Date().toISOString()}`);
    const allStats: ScrapeRunStats[] = [];

    for (const slug of STORE_SLUGS) {
      console.info(`[CronJob] Scraping ${slug}…`);
      const stats = await runStoreScape(slug);
      allStats.push(stats);
      console.info(
        `[CronJob] ${slug} done — scraped: ${stats.totalScraped}, matched: ${stats.matched}, inserted: ${stats.inserted}, errors: ${stats.errors}, time: ${(stats.durationMs / 1000).toFixed(1)}s`,
      );
    }

    const totals = allStats.reduce(
      (acc, s) => ({
        totalScraped: acc.totalScraped + s.totalScraped,
        matched: acc.matched + s.matched,
        inserted: acc.inserted + s.inserted,
        errors: acc.errors + s.errors,
      }),
      { totalScraped: 0, matched: 0, inserted: 0, errors: 0 },
    );

    console.info(
      `[CronJob] Full scrape complete — total scraped: ${totals.totalScraped}, matched: ${totals.matched}, inserted: ${totals.inserted}, errors: ${totals.errors}`,
    );
  });

  console.info(`[CronJob] Scrape job scheduled: "${schedule}" (UTC)`);
}

/**
 * Trigger a one-shot scrape run immediately (useful for testing / manual refresh).
 */
export async function runScrapeNow(): Promise<ScrapeRunStats[]> {
  console.info(`[CronJob] Manual scrape triggered — ${new Date().toISOString()}`);
  const allStats: ScrapeRunStats[] = [];

  for (const slug of STORE_SLUGS) {
    const stats = await runStoreScape(slug);
    allStats.push(stats);
  }

  return allStats;
}
