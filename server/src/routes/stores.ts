import { Router, Request, Response } from 'express';
import { pool } from '../db/connection.js';

const router = Router();

/**
 * GET /api/stores
 *
 * Returns all stores, optionally filtered by city.
 *
 * Query params:
 *   city  {string}  City slug (optional, currently unused — all stores are SPb)
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query<{
      id: number;
      name: string;
      slug: string;
      logo_url: string | null;
      website_url: string | null;
    }>(`
      SELECT id, name, slug, logo_url, website_url
      FROM stores
      ORDER BY name
    `);

    res.json(rows);
  } catch (err) {
    console.error('[stores]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
