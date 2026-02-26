import axios from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * Perekrestok.ru scraper.
 *
 * Strategy:
 *   1. Attempt the internal catalog JSON API (faster, more reliable).
 *   2. Fall back to Playwright page scraping if the API fails or returns empty.
 *
 * TODO: The API endpoint structure should be verified against live responses —
 *       the paths below reflect the catalog observed in early 2025.
 */

// ── API response shapes ───────────────────────────────────────────────────────

interface ApiProduct {
  id: number;
  title: string;
  url: string;
  image?: string;
  prices?: {
    price?: number;         // price in kopecks
    oldPrice?: number;
    unit?: string;          // e.g. "кг"
    pricePerUnit?: number;  // in kopecks per unit
  };
  categories?: Array<{ title: string }>;
}

interface ApiResponse {
  content?: {
    items?: ApiProduct[];
    totalCount?: number;
    pageSize?: number;
    page?: number;
  };
}

export class PerekrestokScraper extends BaseScraper {
  readonly storeName = 'Perekrestok';
  readonly storeSlug = 'perekrestok';
  readonly baseUrl = 'https://www.perekrestok.ru';

  // TODO: verify that this API base path is current
  private readonly apiBase = 'https://www.perekrestok.ru/api/catalog/v1';

  // Category slug → display name
  private readonly categories: Record<string, string> = {
    'molochnye-produkty-yajca-i-maslo': 'Молочные продукты и яйца',
    'hleb-i-vypechka': 'Хлеб и выпечка',
    'frukty-i-ovoshchi': 'Фрукты и овощи',
    'myaso-i-ptica': 'Мясо и птица',
    'ryba-i-moreprodukty': 'Рыба и морепродукты',
    'napitki': 'Напитки',
    'zamorozhennye-produkty': 'Замороженные продукты',
    'bakaleya': 'Бакалея',
    'konditerskie-izdeliya': 'Кондитерские изделия',
  };

  async getCategoryUrls(): Promise<string[]> {
    // For API-based scraper, we return category slugs as pseudo-URLs
    return Object.keys(this.categories).map(
      (slug) => `${this.baseUrl}/cat/${slug}`,
    );
  }

  async scrapeCategory(categoryUrl: string): Promise<ScrapedProduct[]> {
    const slug = categoryUrl.split('/cat/')[1] ?? '';
    const category = this.categories[slug] ?? slug;

    return this.withRetry(async () => {
      // ── Try JSON API first ────────────────────────────────────────────────
      try {
        const products = await this.scrapeViaApi(slug, category);
        if (products.length > 0) return products;
      } catch (apiErr) {
        console.warn(`[${this.storeName}] API failed for "${slug}", falling back to page scrape:`, apiErr);
      }

      // ── Playwright fallback ───────────────────────────────────────────────
      return this.scrapeViaPage(categoryUrl, category);
    });
  }

  // ── API strategy ──────────────────────────────────────────────────────────

  private async scrapeViaApi(
    slug: string,
    category: string,
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    let page = 1;
    const pageSize = 60;

    while (true) {
      // TODO: verify query params against live API
      const { data } = await axios.get<ApiResponse>(`${this.apiBase}/products`, {
        params: {
          filter: JSON.stringify({ category: slug }),
          page,
          perPage: pageSize,
          sort: 'popular',
          city: 'spb',  // Saint Petersburg
        },
        headers: {
          Accept: 'application/json',
          'X-App-Version': '3.0.0',
        },
        timeout: 10_000,
      });

      const items = data.content?.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const priceKopecks = item.prices?.price;
        if (!priceKopecks) continue;

        const price = priceKopecks / 100;
        const ppuKopecks = item.prices?.pricePerUnit;
        const pricePerUnit = ppuKopecks ? ppuKopecks / 100 : null;

        products.push({
          storeProductName: item.title,
          price,
          pricePerUnit,
          category,
          url: item.url.startsWith('http') ? item.url : `${this.baseUrl}${item.url}`,
          imageUrl: item.image,
        });
      }

      const total = data.content?.totalCount ?? 0;
      if (page * pageSize >= total) break;
      page++;
      await this.delay(500, 1500);
    }

    return products;
  }

  // ── Playwright page fallback ───────────────────────────────────────────────

  private async scrapeViaPage(
    categoryUrl: string,
    category: string,
  ): Promise<ScrapedProduct[]> {
    const browser = await this.createBrowser();
    const context = await this.createContext(browser);
    const products: ScrapedProduct[] = [];

    try {
      const page = await this.openPage(context, categoryUrl);

      // TODO: verify selector — Perekrestok product card
      const cardSelector = '[class*="product-card"], [data-qa="product-card"]';
      await page.waitForSelector(cardSelector, { timeout: 15_000 }).catch(() => null);

      const cards = await page.$$(cardSelector);

      for (const card of cards) {
        try {
          const nameEl = await card.$('[class*="product-name"], [data-qa="product-name"]');
          const name = (await nameEl?.textContent())?.trim() ?? '';
          if (!name) continue;

          const priceEl = await card.$('[class*="price"]');
          const priceRaw = (await priceEl?.textContent())?.trim() ?? '';
          const price = this.parsePrice(priceRaw);
          if (isNaN(price) || price <= 0) continue;

          const linkEl = await card.$('a');
          const href = (await linkEl?.getAttribute('href')) ?? '';
          const productUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

          const imgEl = await card.$('img');
          const imageUrl = (await imgEl?.getAttribute('src')) ?? undefined;

          products.push({
            storeProductName: name,
            price,
            pricePerUnit: null,
            category,
            url: productUrl,
            imageUrl,
          });
        } catch {
          // Skip bad card
        }
      }
    } finally {
      await context.close();
      await browser.close();
    }

    return products;
  }
}
