import { pool } from '../db/connection.js';
import { redisClient, CACHE_TTL } from '../cache/redis.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  imageUrl: string | null;
}

// ── Cache helpers ──────────────────────────────────────────────────────────────

function searchCacheKey(query: string, limit: number): string {
  return `products:search:${query.toLowerCase()}:${limit}`;
}

// ── Service functions ──────────────────────────────────────────────────────────

/**
 * Full-text search for products using PostgreSQL's ts_vector/ts_query.
 * Results are cached in Redis for CACHE_TTL seconds.
 *
 * @param query  Search string (e.g. "молоко")
 * @param limit  Maximum number of results to return
 */
export async function searchProducts(query: string, limit: number): Promise<Product[]> {
  const cacheKey = searchCacheKey(query, limit);

  // ── Cache read ───────────────────────────────────────────────────────────
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Product[];
    }
  } catch (err) {
    console.warn('[productService] Redis read error (non-fatal):', err);
  }

  // ── DB query ─────────────────────────────────────────────────────────────
  const { rows } = await pool.query<Product>(
    `
    SELECT
      p.id,
      p.name,
      c.name   AS category,
      p.unit,
      p.image_url AS "imageUrl"
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE
      to_tsvector('russian', p.name || ' ' || COALESCE(p.description, ''))
      @@ plainto_tsquery('russian', $1)
    ORDER BY
      ts_rank(
        to_tsvector('russian', p.name || ' ' || COALESCE(p.description, '')),
        plainto_tsquery('russian', $1)
      ) DESC
    LIMIT $2
    `,
    [query, limit],
  );

  // ── Cache write ──────────────────────────────────────────────────────────
  try {
    await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(rows));
  } catch (err) {
    console.warn('[productService] Redis write error (non-fatal):', err);
  }

  return rows;
}
