import axios, { AxiosError } from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * Pyaterochka (5ka.ru) scraper.
 *
 * Strategy 1: Search API at https://5d.5ka.ru/api/catalog/v1/search
 *   GET ?text={query}&limit=50&store_id={store}
 *
 * Strategy 2: Special offers v2 API (historically public)
 *   GET https://5ka.ru/api/v2/special_offers/?records_per_page=50&page=1
 *
 * Strategy 3: Category catalog via 5d.5ka.ru
 *   GET https://5d.5ka.ru/api/catalog/v1/products?category_code={code}&page=1&records_per_page=50
 *
 * 5ka.ru has heavy bot protection. All endpoints include comprehensive headers.
 * If an endpoint returns 403 or HTML, it's logged clearly.
 *
 * Deduplication is by product ID across all strategies.
 */

// ── API response shapes ───────────────────────────────────────────────────────

interface PyatSearchProduct {
  id?: string | number;
  plu?: string | number;
  name?: string;
  photos?: Array<{ thumbnail?: string; main_image?: string; url?: string }>;
  photo?: string;
  price_type?: {
    price?: number;   // current price in rubles
    old_price?: number;
  };
  current_prices?: {
    price_promo?: number;
    price_reg?: number;
    price_promo_text?: string;
  };
  categories?: Array<{ id?: string; name?: string }>;
  category?: { id?: string; name?: string };
  uom?: string; // unit of measure
  url?: string;
  slug?: string;
}

interface PyatSearchResponse {
  products?: PyatSearchProduct[];
  items?: PyatSearchProduct[];
  results?: PyatSearchProduct[];
  count?: number;
  next?: string | null;
}

interface PyatSpecialOffer {
  id: string | number;
  name: string;
  photo?: string;
  url?: string;
  special_price?: number;
  regular_price?: number;
  price?: number;
  promo_price?: number;
  categories?: Array<{ parent_group_name?: string; parent_group_code?: string }>;
}

interface PyatSpecialOffersResponse {
  results?: PyatSpecialOffer[];
  count?: number;
  next?: string | null;
}

// ── Search keywords ───────────────────────────────────────────────────────────

const SEARCH_KEYWORDS = [
  'молоко', 'кефир', 'творог', 'сметана', 'масло сливочное', 'йогурт',
  'ряженка', 'сыр', 'хлеб', 'батон', 'яйца', 'рис', 'гречка', 'овсянка',
  'макароны спагетти', 'макароны пенне', 'сахар', 'соль', 'масло подсолнечное',
  'масло оливковое', 'мука', 'яблоки', 'бананы', 'помидоры', 'огурцы',
  'картофель', 'морковь', 'лук', 'капуста', 'курица филе', 'курица бёдра',
  'свинина шея', 'фарш говяжий', 'сёмга', 'минтай', 'сельдь',
  'вода', 'сок апельсиновый', 'кофе молотый', 'чай чёрный',
  'пельмени', 'мороженое', 'шоколад', 'печенье',
];

// Pyaterochka store ID for Saint Petersburg
const SPB_STORE_ID = '10074';

const SEARCH_API_URL = 'https://5d.5ka.ru/api/catalog/v1/search';
const CATALOG_API_URL = 'https://5d.5ka.ru/api/catalog/v1/products';
const SPECIAL_OFFERS_URL = 'https://5ka.ru/api/v2/special_offers/';
const BASE_URL = 'https://5ka.ru';
const REQUEST_TIMEOUT = 15_000;

const COMMON_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'origin': BASE_URL,
  'referer': `${BASE_URL}/`,
};

// Pyaterochka category codes for the catalog API
const CATEGORY_CODES = [
  'dairy',          // Молочные продукты
  'bread',          // Хлеб и выпечка
  'eggs',           // Яйца
  'grocery',        // Бакалея
  'fruits-vegetables', // Фрукты и овощи
  'meat',           // Мясо и птица
  'fish',           // Рыба и морепродукты
  'drinks',         // Напитки
  'frozen',         // Замороженные
  'sweets',         // Кондитерские
];

export class PyaterochkaScraper extends BaseScraper {
  readonly storeName = 'Pyaterochka';
  readonly storeSlug = 'pyaterochka';
  readonly baseUrl = BASE_URL;

  async scrapeProducts(): Promise<ScrapedProduct[]> {
    const allProducts = new Map<string, ScrapedProduct>(); // dedup by product ID

    // Strategy 1: Search API
    console.log('[Pyaterochka] Trying search API strategy...');
    const searchWorked = await this.trySearchStrategy(allProducts);

    if (!searchWorked) {
      // Strategy 2: Special offers (historically public endpoint)
      console.log('[Pyaterochka] Search failed, trying special offers API...');
      await this.trySpecialOffersStrategy(allProducts);
    }

    // Strategy 3: Category catalog (supplement if we have results)
    if (allProducts.size < 50) {
      console.log('[Pyaterochka] Supplementing with category catalog...');
      await this.tryCatalogStrategy(allProducts);
    }

    const result = Array.from(allProducts.values());
    console.log(`[Pyaterochka] Total unique products: ${result.length}`);
    return result;
  }

  // ── Strategy 1: Search API ─────────────────────────────────────────────────

  private async trySearchStrategy(
    allProducts: Map<string, ScrapedProduct>,
  ): Promise<boolean> {
    let anySuccess = false;

    for (const keyword of SEARCH_KEYWORDS) {
      try {
        const products = await this.searchByKeyword(keyword);
        if (products.length > 0) anySuccess = true;

        for (const p of products) {
          allProducts.set(p.url, p);
        }
        console.log(
          `[Pyaterochka Search] "${keyword}" → ${products.length} products (total: ${allProducts.size})`,
        );
      } catch (err) {
        console.warn(
          `[Pyaterochka Search] "${keyword}" failed:`,
          err instanceof Error ? err.message : err,
        );
      }
      await this.delay(1000, 2000);
    }

    return anySuccess;
  }

  private async searchByKeyword(keyword: string): Promise<ScrapedProduct[]> {
    let response;
    try {
      response = await axios.get<PyatSearchResponse>(SEARCH_API_URL, {
        params: {
          text: keyword,
          limit: 50,
          store_id: SPB_STORE_ID,
          format: 'json',
        },
        headers: COMMON_HEADERS,
        timeout: REQUEST_TIMEOUT,
      });
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 403) {
        console.error(
          `[Pyaterochka] 403 Forbidden for search "${keyword}" — bot protection active`,
        );
      } else {
        console.error(
          `[Pyaterochka] HTTP ${status ?? 'network error'} for search "${keyword}": ${axiosErr.message}`,
        );
      }
      return [];
    }

    if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
      console.error(`[Pyaterochka] Got HTML instead of JSON for "${keyword}" — bot protection active`);
      return [];
    }

    const data = response.data;
    const items: PyatSearchProduct[] = data.products ?? data.items ?? data.results ?? [];
    return items.map((item) => this.mapSearchProduct(item)).filter((p): p is ScrapedProduct => p !== null);
  }

  // ── Strategy 2: Special Offers ─────────────────────────────────────────────

  private async trySpecialOffersStrategy(
    allProducts: Map<string, ScrapedProduct>,
  ): Promise<void> {
    let page = 1;
    const recordsPerPage = 50;
    let nextUrl: string | null = `${SPECIAL_OFFERS_URL}?records_per_page=${recordsPerPage}&page=${page}&format=json`;

    while (nextUrl) {
      let response: Awaited<ReturnType<typeof axios.get<PyatSpecialOffersResponse>>> | null = null;
      try {
        response = await axios.get<PyatSpecialOffersResponse>(nextUrl, {
          headers: COMMON_HEADERS,
          timeout: REQUEST_TIMEOUT,
        });
      } catch (err) {
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        if (status === 403) {
          console.error('[Pyaterochka Special Offers] 403 Forbidden — bot protection active');
        } else {
          console.error(
            `[Pyaterochka Special Offers] HTTP ${status ?? 'network error'}: ${axiosErr.message}`,
          );
        }
        break;
      }

      if (!response) break;

      if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
        console.error('[Pyaterochka Special Offers] Got HTML instead of JSON — bot protection active');
        break;
      }

      const data: PyatSpecialOffersResponse = response.data;
      const results = data.results ?? [];
      console.log(`[Pyaterochka Special Offers] Page ${page}: ${results.length} items`);

      for (const item of results) {
        const mapped = this.mapSpecialOffer(item);
        if (mapped) allProducts.set(mapped.url, mapped);
      }

      nextUrl = data.next ?? null;
      if (nextUrl) await this.delay(800, 1500);
      page++;

      // Safety: stop after 20 pages
      if (page > 20) break;
    }

    console.log(`[Pyaterochka Special Offers] Collected ${allProducts.size} total products`);
  }

  // ── Strategy 3: Category catalog ──────────────────────────────────────────

  private async tryCatalogStrategy(
    allProducts: Map<string, ScrapedProduct>,
  ): Promise<void> {
    for (const categoryCode of CATEGORY_CODES) {
      let page = 1;
      const recordsPerPage = 50;

      while (true) {
        let response;
        try {
          response = await axios.get<PyatSearchResponse>(CATALOG_API_URL, {
            params: {
              category_code: categoryCode,
              store_id: SPB_STORE_ID,
              records_per_page: recordsPerPage,
              page,
              format: 'json',
            },
            headers: COMMON_HEADERS,
            timeout: REQUEST_TIMEOUT,
          });
        } catch (err) {
          const axiosErr = err as AxiosError;
          const status = axiosErr.response?.status;
          if (status === 403) {
            console.error(`[Pyaterochka Catalog] 403 Forbidden for category "${categoryCode}"`);
          } else {
            console.error(
              `[Pyaterochka Catalog] HTTP ${status ?? 'network error'} for category "${categoryCode}": ${axiosErr.message}`,
            );
          }
          break;
        }

        if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
          console.error(`[Pyaterochka Catalog] Got HTML for category "${categoryCode}" — blocked`);
          break;
        }

        const data = response.data;
        const items: PyatSearchProduct[] = data.products ?? data.items ?? data.results ?? [];
        console.log(`[Pyaterochka Catalog] Category "${categoryCode}" page ${page}: ${items.length} items`);

        if (items.length === 0) break;

        for (const item of items) {
          const mapped = this.mapSearchProduct(item);
          if (mapped) allProducts.set(mapped.url, mapped);
        }

        if (!data.next || items.length < recordsPerPage) break;
        page++;
        await this.delay(800, 1500);
      }

      await this.delay(1000, 2000);
    }
  }

  // ── Product mapping ────────────────────────────────────────────────────────

  private mapSearchProduct(item: PyatSearchProduct): ScrapedProduct | null {
    if (!item.name) return null;

    // Price: prefer promo, fallback to regular
    const price =
      item.current_prices?.price_promo ??
      item.price_type?.price ??
      item.current_prices?.price_reg ??
      null;

    if (!price || price <= 0) return null;

    const id = String(item.id ?? item.plu ?? item.name);
    const productUrl = item.url
      ? (item.url.startsWith('http') ? item.url : `${this.baseUrl}${item.url}`)
      : `${this.baseUrl}/product/${item.slug ?? id}/`;

    let imageUrl: string | undefined;
    if (item.photos && item.photos.length > 0) {
      const ph = item.photos[0];
      imageUrl = ph.main_image ?? ph.thumbnail ?? ph.url;
    } else if (item.photo) {
      imageUrl = item.photo;
    }

    const rawCategory =
      item.categories?.[0]?.name ??
      item.category?.name ??
      '';
    const category = rawCategory ? this.mapCategory(rawCategory) : 'bakaleya';

    return {
      storeProductName: item.name,
      price,
      pricePerUnit: null,
      category,
      url: productUrl,
      imageUrl,
    };
  }

  private mapSpecialOffer(item: PyatSpecialOffer): ScrapedProduct | null {
    if (!item.name) return null;

    const price = item.special_price ?? item.promo_price ?? item.price ?? item.regular_price ?? null;
    if (!price || price <= 0) return null;

    const id = String(item.id);
    const productUrl = item.url
      ? (item.url.startsWith('http') ? item.url : `${this.baseUrl}${item.url}`)
      : `${this.baseUrl}/product/${id}/`;

    const rawCategory =
      item.categories?.[0]?.parent_group_name ?? '';
    const category = rawCategory ? this.mapCategory(rawCategory) : 'bakaleya';

    return {
      storeProductName: item.name,
      price,
      pricePerUnit: null,
      category,
      url: productUrl,
      imageUrl: item.photo,
    };
  }
}
