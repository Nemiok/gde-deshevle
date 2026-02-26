import { pool } from '../db/connection.js';
import { redisClient, CACHE_TTL } from '../cache/redis.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PriceRow {
  productId: number;
  storeId: number;
  storeName: string;
  storeSlug: string;
  price: number;
  pricePerUnit: number | null;
  storeProductName: string;
  storeProductUrl: string | null;
  scrapedAt: string;
}

// ── Cache key ──────────────────────────────────────────────────────────────────

function pricesCacheKey(productIds: number[]): string {
  return `prices:${[...productIds].sort((a, b) => a - b).join(',')}`;
}

// ── Service ────────────────────────────────────────────────────────────────────

/**
 * Fetch the latest prices for a list of product IDs across all stores.
 * Returns one row per (product, store) pair.
 * Prices older than 24 hours are considered stale and excluded.
 *
 * Results are cached in Redis for CACHE_TTL seconds.
 */
export async function getPricesForProducts(productIds: number[]): Promise<PriceRow[]> {
  if (productIds.length === 0) return [];

  const cacheKey = pricesCacheKey(productIds);

  // ── Cache read ───────────────────────────────────────────────────────────
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PriceRow[];
    }
  } catch (err) {
    console.warn('[priceService] Redis read error (non-fatal):', err);
  }

  // ── DB query ─────────────────────────────────────────────────────────────
  // We use unnest($1::int[]) to pass the array safely — no SQL injection risk.
  const { rows } = await pool.query<PriceRow>(
    `
    SELECT
      pr.product_id                  AS "productId",
      s.id                           AS "storeId",
      s.name                         AS "storeName",
      s.slug                         AS "storeSlug",
      pr.price,
      pr.price_per_unit              AS "pricePerUnit",
      pr.store_product_name          AS "storeProductName",
      pr.store_product_url           AS "storeProductUrl",
      pr.scraped_at                  AS "scrapedAt"
    FROM prices pr
    JOIN stores s ON s.id = pr.store_id
    WHERE
      pr.product_id = ANY($1::int[])
      AND pr.scraped_at > NOW() - INTERVAL '24 hours'
    ORDER BY pr.product_id, pr.price
    `,
    [productIds],
  );

  // ── Cache write ──────────────────────────────────────────────────────────
  try {
    await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(rows));
  } catch (err) {
    console.warn('[priceService] Redis write error (non-fatal):', err);
  }

  return rows;
}
