/**
 * Scraper registry — exports a factory function and a typed enum of store slugs.
 * Import from here so the rest of the codebase stays decoupled from concrete scraper classes.
 */

import { BaseScraper } from './base-scraper';
import { LentaScraper } from './lenta-scraper';
import { PerekrestokScraper } from './perekrestok-scraper';
import { PyaterochkaScraper } from './pyaterochka-scraper';
import { MagnitScraper } from './magnit-scraper';
import { VkusvillScraper } from './vkusvill-scraper';

export type StoreSlug = 'lenta' | 'perekrestok' | 'pyaterochka' | 'magnit' | 'vkusvill';

const scraperMap: Record<StoreSlug, () => BaseScraper> = {
  lenta: () => new LentaScraper(),
  perekrestok: () => new PerekrestokScraper(),
  pyaterochka: () => new PyaterochkaScraper(),
  magnit: () => new MagnitScraper(),
  vkusvill: () => new VkusvillScraper(),
};

export const STORE_SLUGS: StoreSlug[] = Object.keys(scraperMap) as StoreSlug[];

/**
 * Get a fresh scraper instance for a given store slug.
 * Throws if the slug is not registered.
 */
export function getScraper(slug: StoreSlug): BaseScraper {
  const factory = scraperMap[slug];
  if (!factory) throw new Error(`Unknown store slug: "${slug}"`);
  return factory();
}

export { BaseScraper } from './base-scraper';
export type { ScrapedProduct } from './base-scraper';
