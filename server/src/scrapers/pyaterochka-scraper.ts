import axios from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * Pyaterochka (5ka.ru) scraper.
 *
 * Pyaterochka's website is heavily React/SPA-based.
 * We attempt their mobile API first; fall back to Playwright if needed.
 *
 * TODO: All API paths and selectors should be validated against the live site.
 */

interface PyatApiProduct {
  id: string | number;
  name: string;
  url?: string;
  photo?: string;
  price: number;          // rubles, already converted
  pricePerUnit?: number;
  category?: string;
}

interface PyatApiResponse {
  results?: PyatApiProduct[];
  count?: number;
  next?: string | null;
}

export class PyaterochkaScraper extends BaseScraper {
  readonly storeName = 'Pyaterochka';
  readonly storeSlug = 'pyaterochka';
  readonly baseUrl = 'https://5ka.ru';

  // TODO: verify API base against live 5ka.ru
  private readonly apiBase = 'https://5ka.ru/api/v2/special_offers';

  private readonly categories: Record<string, string> = {
    'molochnye-produkty': 'Молочные продукты',
    'hleb-vydob': 'Хлеб и выпечка',
    'frukty-ovoshchi': 'Фрукты и овощи',
    'myaso-ptica-kolbasy': 'Мясо и птица',
    'ryba-moreprodukty': 'Рыба и морепродукты',
    'napitki': 'Напитки',
    'zamorozhenka': 'Замороженные продукты',
    'bakaleya': 'Бакалея',
    'yajca': 'Яйца',
    'konditerskaya': 'Кондитерские изделия',
  };

  async getCategoryUrls(): Promise<string[]> {
    return Object.keys(this.categories).map(
      (slug) => `${this.baseUrl}/catalog/${slug}/`,
    );
  }

  async scrapeCategory(categoryUrl: string): Promise<ScrapedProduct[]> {
    const slug = categoryUrl
      .replace(`${this.baseUrl}/catalog/`, '')
      .replace(/\/$/, '');
    const category = this.categories[slug] ?? slug;

    return this.withRetry(async () => {
      // Try API first
      try {
        const products = await this.scrapeViaApi(slug, category);
        if (products.length > 0) return products;
      } catch (err) {
        console.warn(`[${this.storeName}] API failed for ${slug}:`, err);
      }

      // Playwright fallback
      return this.scrapeViaPage(categoryUrl, category);
    });
  }

  private async scrapeViaApi(
    slug: string,
    category: string,
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    // TODO: verify pagination pattern
    let url: string | null = `${this.apiBase}/?records_per_page=50&categories=${slug}&store=&format=json`;

    while (url) {
      const { data }: { data: PyatApiResponse } = await axios.get<PyatApiResponse>(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        timeout: 10_000,
      });

      for (const item of data.results ?? []) {
        if (!item.name || !item.price) continue;
        products.push({
          storeProductName: item.name,
          price: item.price,
          pricePerUnit: item.pricePerUnit ?? null,
          category,
          url: item.url ? `${this.baseUrl}${item.url}` : this.baseUrl,
          imageUrl: item.photo,
        });
      }

      url = data.next ?? null;
      if (url) await this.delay(500, 1200);
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

      // TODO: verify selectors
      const cardSelector = '[class*="product-card"], .product-list__item';
      await page.waitForSelector(cardSelector, { timeout: 15_000 }).catch(() => null);

      const cards = await page.$$(cardSelector);

      for (const card of cards) {
        try {
          const nameEl = await card.$('[class*="product-name"], h3');
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
