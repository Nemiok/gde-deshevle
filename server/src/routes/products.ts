import { Router, Request, Response } from 'express';
import { searchProducts } from '../services/productService.js';

const router = Router();

/**
 * GET /api/products/search
 *
 * Query params:
 *   q      {string}  Search query (required, min 2 chars)
 *   limit  {number}  Max results to return (default: 10, max: 50)
 *
 * Returns an array of matching canonical products.
 */
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = (req.query['q'] as string | undefined)?.trim();
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '10', 10), 50);

  if (!q || q.length < 2) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Query parameter "q" is required and must be at least 2 characters',
    });
    return;
  }

  try {
    const products = await searchProducts(q, limit);
    res.json(products);
  } catch (err) {
    console.error('[products/search]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
