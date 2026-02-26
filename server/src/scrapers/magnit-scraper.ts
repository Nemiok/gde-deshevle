import axios from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * Magnit (magnit.ru) scraper.
 *
 * Magnit exposes a reasonably stable REST API for their online store.
 * We use it directly; fall back to Playwright if the API is unavailable.
 *
 * TODO: Verify API paths and field names against live magnit.ru before deploying.
 */

interface MagnitApiProduct {
  id: number | string;
  name: string;
  url?: string;
  mainImage?: string;
  price?: {
    retailPrice?: number;
    promotionPrice?: number;
    pricePerKg?: number;
    unitOfMeasure?: string;
  };
  category?: {
    name?: string;
  };
}

interface MagnitApiResponse {
  items?: MagnitApiProduct[];
  total?: number;
  hasMore?: boolean;
}

export class MagnitScraper extends BaseScraper {
  readonly storeName = 'Magnit';
  readonly storeSlug = 'magnit';
  readonly baseUrl = 'https://magnit.ru';

  // TODO: confirm API base path on live magnit.ru
  private readonly apiBase = 'https://magnit.ru/webapi/v1/goods/list';

  // Category codes used by Magnit's internal API (TODO: verify)
  private readonly categories: Record<string, string> = {
    'molochnye-produkty': 'Молочные продукты',
    'hleb-vypechka': 'Хлеб и выпечка',
    'frukty-ovoshchi': 'Фрукты и овощи',
    'myaso-ptica': 'Мясо и птица',
    'ryba-moreprodukty': 'Рыба и морепродукты',
    'napitki': 'Напитки',
    'zamorozhenye-produkty': 'Замороженные продукты',
    'bakaleya': 'Бакалея',
    'yajca': 'Яйца',
    'konditerskiye-izdeliya': 'Кондитерские изделия',
  };

  async getCategoryUrls(): Promise<string[]> {
    return Object.keys(this.categories).map(
      (slug) => `${this.baseUrl}/magnit-market/catalog/${slug}/`,
    );
  }

  async scrapeCategory(categoryUrl: string): Promise<ScrapedProduct[]> {
    const slug = categoryUrl
      .replace(`${this.baseUrl}/magnit-market/catalog/`, '')
      .replace(/\/$/, '');
    const category = this.categories[slug] ?? slug;

    return this.withRetry(async () => {
      try {
        const products = await this.scrapeViaApi(slug, category);
        if (products.length > 0) return products;
      } catch (err) {
        console.warn(`[${this.storeName}] API failed for ${slug}:`, err);
      }
      return this.scrapeViaPage(categoryUrl, category);
    });
  }

  private async scrapeViaApi(
    slug: string,
    category: string,
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const { data } = await axios.get<MagnitApiResponse>(this.apiBase, {
        params: {
          // TODO: verify param names against live API
          category: slug,
          offset,
          limit,
          cityId: '77', // Saint Petersburg region
        },
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Referer: `${this.baseUrl}/`,
        },
        timeout: 10_000,
      });

      const items = data.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const priceRaw = item.price?.promotionPrice ?? item.price?.retailPrice;
        if (!priceRaw) continue;

        const pricePerUnit = item.price?.pricePerKg ?? null;

        products.push({
          storeProductName: item.name,
          price: priceRaw,
          pricePerUnit,
          category,
          url: item.url
            ? item.url.startsWith('http') ? item.url : `${this.baseUrl}${item.url}`
            : this.baseUrl,
          imageUrl: item.mainImage,
        });
      }

      if (!data.hasMore) break;
      offset += limit;
      await this.delay(500, 1200);
    }

    return products;
  }

  private async scrapeViaPage(
    categoryUrl: string,
    category: string,
  ): Promise<ScrapedProduct[]> {
    const browser = await this.createBrowser();
    const context = await this.createContext(browser);
    const products: ScrapedProduct[] = [];

    try {
      const page = await this.openPage(context, categoryUrl);

      // TODO: verify selectors against live magnit.ru
      const cardSelector = '[class*="product-card"], .goods-card';
      await page.waitForSelector(cardSelector, { timeout: 15_000 }).catch(() => null);

      const cards = await page.$$(cardSelector);

      for (const card of cards) {
        try {
          const nameEl = await card.$('[class*="goods-name"], [class*="product-name"], h3');
          const name = (await nameEl?.textContent())?.trim() ?? '';
          if (!name) continue;

          const priceEl = await card.$('[class*="price"], [class*="Price"]');
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
          // skip
        }
      }
    } finally {
      await context.close();
      await browser.close();
    }

    return products;
  }
}
