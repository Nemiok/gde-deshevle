/**
 * Base scraper — HTTP-only (axios). No Playwright/browser dependencies.
 * All concrete scrapers must extend BaseScraper and implement scrapeProducts().
 *
 * Playwright import is kept as a lazy/optional reference so it won't crash
 * at runtime in the node:20-slim Docker image where it is not installed.
 */

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface ScrapedProduct {
  storeProductName: string;   // Raw name from the store website
  price: number;               // Price in rubles
  pricePerUnit: number | null; // Price per kg/liter if available
  category: string;            // Category from the store (mapped to canonical)
  url: string;                 // Product page URL
  imageUrl?: string;           // Product image URL
}

// ─── Abstract Base Scraper ────────────────────────────────────────────────────

export abstract class BaseScraper {
  abstract readonly storeName: string;
  abstract readonly storeSlug: string;
  abstract readonly baseUrl: string;

  /**
   * Subclasses implement this: fetch all products via HTTP and return them.
   */
  abstract scrapeProducts(): Promise<ScrapedProduct[]>;

  /**
   * Full scrape orchestrator — calls scrapeProducts() with error handling.
   * This is the entry point used by the cron job and manual triggers.
   */
  async scrapeAll(): Promise<ScrapedProduct[]> {
    console.log(`[${this.storeName}] Starting scrape...`);
    try {
      const products = await this.scrapeProducts();
      console.log(`[${this.storeName}] Scrape complete — ${products.length} products found.`);
      return products;
    } catch (err) {
      console.error(`[${this.storeName}] scrapeAll failed:`, err);
      return [];
    }
  }

  // ── Utility helpers ───────────────────────────────────────────────────────

  /**
   * Random delay between requests.
   * Default 1–3 seconds; pass explicit min/max in ms if needed.
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
            err instanceof Error ? err.message : err,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }
    throw lastError;
  }

  /**
   * Parse a Russian price string like "89,90 ₽" or "1 099 ₽" into a float.
   * Also handles plain numeric values (already numbers).
   * Returns NaN if unparseable.
   */
  protected parsePrice(raw: string | number): number {
    if (typeof raw === 'number') return raw;
    // Remove currency symbol, non-breaking spaces, regular spaces used as thousands separators
    const cleaned = raw
      .replace(/[₽\s\u00A0]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(',', '.'); // Russian decimal comma → dot

    // Remove remaining spaces (thousands separator)
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

  /**
   * Detect if a response body is HTML instead of JSON (bot protection / WAF).
   * Returns true if the string looks like an HTML page.
   */
  protected isHtmlResponse(body: unknown): boolean {
    if (typeof body !== 'string') return false;
    const trimmed = body.trimStart();
    return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
  }

  /**
   * Map a store category string to our canonical category slugs.
   */
  protected mapCategory(storeCategory: string): string {
    const lower = storeCategory.toLowerCase();
    if (/молоч|dairy|кефир|творог|сметан|сыр|йогурт|ряженк|масло.*(слив|сметан)/i.test(lower)) return 'dairy';
    if (/хлеб|выпечк|батон|bread|bakery/i.test(lower)) return 'bread';
    if (/яйц|egg/i.test(lower)) return 'eggs';
    if (/бакал|крупа|макарон|сахар|соль|мука|масло.*(подсолн|олив)|крупы/i.test(lower)) return 'bakaleya';
    if (/фрукт|овощ|fruit|vegetab|картоф|морков|помидор|огурц|лук|капуст|яблок|банан/i.test(lower)) return 'fruits-vegetables';
    if (/мясо|птиц|курица|свинина|говядин|фарш|meat|poultry|колбас|сосис/i.test(lower)) return 'meat-poultry';
    if (/рыба|морепрод|сёмга|минтай|сельдь|fish|seafood/i.test(lower)) return 'fish-seafood';
    if (/напитк|вода|сок|кофе|чай|drink|beverage/i.test(lower)) return 'drinks';
    if (/заморож|frozen|пельмен|мороженое/i.test(lower)) return 'frozen';
    if (/кондитер|шоколад|печенье|confect|сладк|снек/i.test(lower)) return 'confectionery';
    return storeCategory; // return as-is if no mapping found
  }
}
