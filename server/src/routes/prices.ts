import { Router, Request, Response } from 'express';
import { getPricesForProducts } from '../services/priceService.js';

const router = Router();

/**
 * GET /api/prices
 *
 * Query params:
 *   productIds  {string}  Comma-separated product IDs (required)
 *   city        {string}  City slug, default "spb" (unused — all stores are SPb for now)
 *
 * Returns an array of price rows, one per (product, store) combination.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const raw = (req.query['productIds'] as string | undefined)?.trim();

  if (!raw) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Query parameter "productIds" is required',
    });
    return;
  }

  const productIds = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  if (productIds.length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'No valid product IDs provided',
    });
    return;
  }

  if (productIds.length > 100) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Maximum 100 product IDs per request',
    });
    return;
  }

  try {
    const prices = await getPricesForProducts(productIds);
    res.json(prices);
  } catch (err) {
    console.error('[prices]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
