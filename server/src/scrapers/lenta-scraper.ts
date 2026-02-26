import { Page, BrowserContext } from 'playwright';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * Lenta.com scraper — targets the mobile-friendly catalog pages.
 * Lenta has a well-structured catalog at lenta.com/catalog/<slug>/
 *
 * TODO: All CSS selectors below were written against the catalog structure
 *       observed in early 2025. Verify them against the live site and update
 *       as needed when the layout changes.
 */
export class LentaScraper extends BaseScraper {
  readonly storeName = 'Lenta';
  readonly storeSlug = 'lenta';
  readonly baseUrl = 'https://lenta.com';

  // Map of human-readable category name → relative catalog path
  private readonly categories: Record<string, string> = {
    'Молочные продукты': '/catalog/molochnye-produkty/',
    'Хлеб и выпечка': '/catalog/khleb-i-vypechka/',
    'Яйца': '/catalog/yajtsa/',
    'Бакалея': '/catalog/bakaleya/',
    'Фрукты и овощи': '/catalog/frukty-i-ovoshchi/',
    'Мясо и птица': '/catalog/myaso-ptitsa-i-delikatesy/',
    'Напитки': '/catalog/napitki/',
    'Рыба и морепродукты': '/catalog/ryba-i-moreprodukty/',
    'Замороженные продукты': '/catalog/zamorozhennye-produkty/',
    'Кондитерские изделия': '/catalog/konditerskie-izdeliya/',
  };

  async getCategoryUrls(): Promise<string[]> {
    return Object.values(this.categories).map((path) => `${this.baseUrl}${path}`);
  }

  async scrapeCategory(categoryUrl: string): Promise<ScrapedProduct[]> {
    // Derive category name from URL slug
    const slug = categoryUrl.replace(`${this.baseUrl}/catalog/`, '').replace(/\/$/, '');
    const category =
      Object.entries(this.categories).find(([, p]) => p.includes(slug))?.[0] ?? slug;

    return this.withRetry(async () => {
      const browser = await this.createBrowser();
      const context = await this.createContext(browser);
      const products: ScrapedProduct[] = [];

      try {
        const page = await this.openPage(context, categoryUrl);

        // Lenta lazy-loads products — scroll to trigger all loads
        await this.autoScroll(page);

        // TODO: verify selector — Lenta product card wrapper
        const cardSelector = '.product-card, [class*="ProductCard"], [data-testid="product-card"]';
        await page.waitForSelector(cardSelector, { timeout: 15_000 }).catch(() => null);

        const cards = await page.$$(cardSelector);

        for (const card of cards) {
          try {
            // TODO: verify selector — product name
            const nameEl = await card.$('.product-card__title, [class*="ProductCard__title"], [class*="productName"]');
            const name = (await nameEl?.textContent())?.trim() ?? '';

            if (!name) continue;

            // TODO: verify selector — main price (sale price preferred)
            const priceEl = await card.$(
              '.product-card__price-new, .product-card__price, [class*="PriceNew"], [class*="price_new"]',
            );
            const priceRaw = (await priceEl?.textContent())?.trim() ?? '';
            const price = this.parsePrice(priceRaw);

            if (isNaN(price) || price <= 0) continue;

            // TODO: verify selector — price per unit (e.g. "189,90 ₽/кг")
            const ppu = await card.$('.product-card__price-per-unit, [class*="PricePerUnit"], [class*="pricePerUnit"]');
            const ppuRaw = (await ppu?.textContent())?.trim();
            const pricePerUnit = this.parsePricePerUnit(ppuRaw);

            // TODO: verify selector — product link
            const linkEl = await card.$('a');
            const href = (await linkEl?.getAttribute('href')) ?? '';
            const productUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

            // TODO: verify selector — product image
            const imgEl = await card.$('img');
            const imageUrl =
              (await imgEl?.getAttribute('src')) ??
              (await imgEl?.getAttribute('data-src')) ??
              undefined;

            products.push({
              storeProductName: name,
              price,
              pricePerUnit,
              category,
              url: productUrl,
              imageUrl: imageUrl ?? undefined,
            });
          } catch (cardErr) {
            // Skip bad cards silently
          }
        }
      } finally {
        await context.close();
        await browser.close();
      }

      return products;
    });
  }

  /** Scroll to the bottom of the page in increments to trigger lazy loading */
  private async autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 150);
      });
    });
    // Wait for any lazy-loaded elements to settle
    await page.waitForTimeout(1500);
  }
}
