import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface ScrapedProduct {
  storeProductName: string;   // Raw name from the store website
  price: number;               // Price in rubles
  pricePerUnit: number | null; // Price per kg/liter if available
  category: string;            // Category from the store
  url: string;                 // Product page URL
  imageUrl?: string;           // Product image URL
}

// ─── Abstract Base Scraper ───────────────────────────────────────────────────

export abstract class BaseScraper {
  abstract readonly storeName: string;
  abstract readonly storeSlug: string;
  abstract readonly baseUrl: string;

  // Subclasses implement: scrape a single category page
  abstract scrapeCategory(categoryUrl: string): Promise<ScrapedProduct[]>;

  // Subclasses implement: return all category URLs to scrape
  abstract getCategoryUrls(): Promise<string[]>;

  // ── Full scrape orchestrator ──────────────────────────────────────────────

  async scrapeAll(): Promise<ScrapedProduct[]> {
    const allProducts: ScrapedProduct[] = [];

    let categoryUrls: string[];
    try {
      categoryUrls = await this.getCategoryUrls();
    } catch (err) {
      console.error(`[${this.storeName}] Failed to retrieve category URLs:`, err);
      return allProducts;
    }

    for (const url of categoryUrls) {
      try {
        await this.delay();
        const products = await this.scrapeCategory(url);
        console.log(
          `Scraping ${this.storeName} category: ${url} — found ${products.length} products`,
        );
        allProducts.push(...products);
      } catch (err) {
        console.error(`[${this.storeName}] Error scraping category ${url}:`, err);
        // Continue to next category rather than aborting the whole run
      }
    }

    return allProducts;
  }

  // ── Browser factory ──────────────────────────────────────────────────────

  protected async createBrowser(): Promise<Browser> {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=375,812',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
    return browser;
  }

  // Create a browser context with anti-detection settings
  protected async createContext(browser: Browser): Promise<BrowserContext> {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
      extraHTTPHeaders: {
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    });

    // Mask webdriver flag
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // @ts-ignore
      delete navigator.__proto__.webdriver;
    });

    return context;
  }

  // Open a new page with context and navigate
  protected async openPage(context: BrowserContext, url: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    return page;
  }

  // ── Utility helpers ───────────────────────────────────────────────────────

  /**
   * Random delay between requests (default 1–3 seconds).
   * Pass explicit min/max in milliseconds if needed.
   */
  protected async delay(min = 1000, max = 3000): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry a function with exponential backoff: 2s → 4s → 8s.
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
          console.warn(
            `[${this.storeName}] Attempt ${attempt + 1} failed. Retrying in ${backoffMs / 1000}s…`,
            err,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }
    throw lastError;
  }

  /**
   * Parse a Russian price string like "89,90 ₽" or "1 099 ₽" into a float.
   * Returns NaN if unparseable.
   */
  protected parsePrice(raw: string): number {
    // Remove currency symbol, non-breaking spaces and regular spaces used as thousands separators
    const cleaned = raw
      .replace(/[₽\s\u00A0]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      // Replace comma decimal separator
      .replace(',', '.');

    // "89.90" or "1 099.00" → remove remaining spaces (thousands sep)
    const normalized = cleaned.replace(/\s/g, '');
    return parseFloat(normalized);
  }

  /**
   * Parse a price-per-unit string like "179,90 ₽/кг" or "89,90 ₽/л".
   * Returns null if not present or unparseable.
   */
  protected parsePricePerUnit(raw: string | null | undefined): number | null {
    if (!raw) return null;
    const price = this.parsePrice(raw);
    return isNaN(price) ? null : price;
  }
}
