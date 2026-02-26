import axios from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * VkusVill (vkusvill.ru) scraper.
 *
 * VkusVill has a clean public API — we prefer it over page scraping.
 * Playwright fallback is included for resilience.
 *
 * TODO: API paths/params should be verified against live vkusvill.ru.
 */

interface VvApiItem {
  id: number | string;
  title: string;
  slug?: string;
  image?: string;
  price: number;        // already in rubles
  priceByUnit?: number; // price per kg
  category?: string;
}

interface VvApiResponse {
  data?: VvApiItem[];
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
  };
}

export class VkusvillScraper extends BaseScraper {
  readonly storeName = 'VkusVill';
  readonly storeSlug = 'vkusvill';
  readonly baseUrl = 'https://vkusvill.ru';

  // TODO: confirm API base path against live vkusvill.ru
  private readonly apiBase = 'https://vkusvill.ru/api/v3/catalog/items';

  private readonly categories: Record<string, string> = {
    'molochnye-produkty': 'Молочные продукты',
    'hleb-vypechka': 'Хлеб и выпечка',
    'frukty-i-ovoshchi': 'Фрукты и овощи',
    'myaso-i-ptica': 'Мясо и птица',
    'ryba-i-moreprodukty': 'Рыба и морепродукты',
    'napitki': 'Напитки',
    'zamorozhennye': 'Замороженные продукты',
    'bakaleya': 'Бакалея',
    'yajca': 'Яйца',
    'sladkoe-i-sneki': 'Кондитерские изделия',
  };

  async getCategoryUrls(): Promise<string[]> {
    return Object.keys(this.categories).map(
      (slug) => `${this.baseUrl}/goods/${slug}/`,
    );
  }

  async scrapeCategory(categoryUrl: string): Promise<ScrapedProduct[]> {
    const slug = categoryUrl
      .replace(`${this.baseUrl}/goods/`, '')
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
    let page = 1;
    const perPage = 60;

    while (true) {
      const { data } = await axios.get<VvApiResponse>(this.apiBase, {
        params: {
          // TODO: confirm param names
          section: slug,
          page,
          perPage,
          city: 'spb',
        },
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 10_000,
      });

      const items = data.data ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        if (!item.price) continue;
        products.push({
          storeProductName: item.title,
          price: item.price,
          pricePerUnit: item.priceByUnit ?? null,
          category,
          url: item.slug
            ? `${this.baseUrl}/goods/${item.slug}/`
            : this.baseUrl,
          imageUrl: item.image,
        });
      }

      const total = data.meta?.total ?? 0;
      if (page * perPage >= total) break;
      page++;
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

      // TODO: verify selectors against live vkusvill.ru
      const cardSelector = '.product-card, [class*="ProductCard"]';
      await page.waitForSelector(cardSelector, { timeout: 15_000 }).catch(() => null);

      const cards = await page.$$(cardSelector);

      for (const card of cards) {
        try {
          const nameEl = await card.$('[class*="product-name"], [class*="ProductName"]');
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
