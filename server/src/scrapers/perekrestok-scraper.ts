import axios, { AxiosError } from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * Perekrestok (perekrestok.ru) scraper.
 *
 * Strategy: Direct REST API via search endpoint
 *   GET /api/customer/1.4.1.0/catalog/search/all?textQuery={q}&entityTypes[]=product
 *
 * Also tries the product feed:
 *   POST /api/customer/1.4.1.0/catalog/product/feed
 *
 * Searches for all canonical product keywords. The Timeweb Cloud server in
 * Russia should have better success rate than external servers.
 *
 * If any endpoint returns 403 or HTML (bot protection), it's logged clearly
 * and the scraper returns empty for that keyword.
 */

// ── API response shapes ───────────────────────────────────────────────────────

interface PerekPrices {
  regular?: number;    // rubles
  promo?: number;      // rubles
  price?: number;      // kopecks (legacy endpoint)
  oldPrice?: number;
  unit?: string;
  pricePerUnit?: number; // kopecks per unit
}

interface PerekCategory {
  title?: string;
  id?: number | string;
}

interface PerekProduct {
  id?: number | string;
  title?: string;
  name?: string;
  url?: string;
  slug?: string;
  category?: PerekCategory;
  categories?: PerekCategory[];
  prices?: PerekPrices;
  images?: Array<{ url?: string; src?: string }>;
  image?: string;
}

interface PerekSearchResult {
  name?: string;
  type?: string;
  entity?: PerekProduct;
}

interface PerekSearchResponse {
  results?: PerekSearchResult[];
  content?: {
    items?: PerekProduct[];
    totalCount?: number;
    pageSize?: number;
  };
}

interface PerekFeedResponse {
  content?: {
    items?: PerekProduct[];
    totalCount?: number;
    pageSize?: number;
  };
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

const API_BASE = 'https://www.perekrestok.ru/api/customer/1.4.1.0';
const BASE_URL = 'https://www.perekrestok.ru';
const REQUEST_TIMEOUT = 15_000;

const COMMON_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'origin': BASE_URL,
  'referer': `${BASE_URL}/`,
  'x-requested-with': 'XMLHttpRequest',
};

export class PerekrestokScraper extends BaseScraper {
  readonly storeName = 'Perekrestok';
  readonly storeSlug = 'perekrestok';
  readonly baseUrl = BASE_URL;

  async scrapeProducts(): Promise<ScrapedProduct[]> {
    // Try search endpoint first (most permissive)
    const allProducts = new Map<string, ScrapedProduct>(); // dedup by ID

    let searchWorked = false;

    for (const keyword of SEARCH_KEYWORDS) {
      try {
        const products = await this.searchByKeyword(keyword);
        if (products.length > 0) {
          searchWorked = true;
        }
        for (const p of products) {
          allProducts.set(p.url, p);
        }
        console.log(
          `[Perekrestok] Search "${keyword}" → ${products.length} products (total unique: ${allProducts.size})`,
        );
      } catch (err) {
        console.warn(
          `[Perekrestok] Search "${keyword}" failed:`,
          err instanceof Error ? err.message : err,
        );
      }
      await this.delay(1000, 2000);
    }

    if (!searchWorked) {
      console.warn('[Perekrestok] Search endpoint returned nothing — trying category feed');
      try {
        const feedProducts = await this.scrapeCategoryFeed();
        for (const p of feedProducts) {
          allProducts.set(p.url, p);
        }
        console.log(`[Perekrestok] Category feed → ${feedProducts.length} products`);
      } catch (err) {
        console.error('[Perekrestok] Category feed also failed:', err instanceof Error ? err.message : err);
      }
    }

    const result = Array.from(allProducts.values());
    console.log(`[Perekrestok] Total unique products: ${result.length}`);
    return result;
  }

  // ── Search strategy ───────────────────────────────────────────────────────

  private async searchByKeyword(keyword: string): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];

    let response;
    try {
      response = await axios.get<PerekSearchResponse>(
        `${API_BASE}/catalog/search/all`,
        {
          params: {
            textQuery: keyword,
            'entityTypes[]': 'product',
          },
          headers: COMMON_HEADERS,
          timeout: REQUEST_TIMEOUT,
        },
      );
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 403) {
        console.error(
          `[Perekrestok] 403 Forbidden for search "${keyword}" — bot protection active. ` +
          `The Timeweb Cloud server IP may be blocked.`,
        );
      } else {
        console.error(
          `[Perekrestok] HTTP ${status ?? 'network error'} for search "${keyword}": ${axiosErr.message}`,
        );
      }
      return [];
    }

    // Check for HTML block (WAF challenge page)
    if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
      console.error(`[Perekrestok] Got HTML instead of JSON for "${keyword}" — WAF/bot protection active`);
      return [];
    }

    const data = response.data;

    // Handle search results format
    const searchResults = data.results ?? [];
    for (const result of searchResults) {
      if (result.type !== 'product' || !result.entity) continue;
      const mapped = this.mapProduct(result.entity);
      if (mapped) products.push(mapped);
    }

    // Also handle direct content.items format (some API versions)
    const contentItems = data.content?.items ?? [];
    for (const item of contentItems) {
      const mapped = this.mapProduct(item);
      if (mapped) products.push(mapped);
    }

    return products;
  }

  // ── Category feed strategy ─────────────────────────────────────────────────

  // Category IDs for Perekrestok (major food categories)
  private readonly categoryIds = [
    92,   // Молочные продукты
    820,  // Хлеб
    893,  // Яйца
    91,   // Бакалея
    94,   // Фрукты и овощи
    114,  // Мясо и птица
    107,  // Рыба и морепродукты
    100,  // Напитки
    127,  // Замороженные
    119,  // Кондитерские
  ];

  private async scrapeCategoryFeed(): Promise<ScrapedProduct[]> {
    const allProducts = new Map<string, ScrapedProduct>();

    for (const categoryId of this.categoryIds) {
      let page = 1;
      const perPage = 100;

      while (true) {
        let response;
        try {
          response = await axios.post<PerekFeedResponse>(
            `${API_BASE}/catalog/product/feed`,
            {
              filter: { category: categoryId },
              page,
              perPage,
              orderBy: 'popularity',
              orderDirection: 'asc',
            },
            {
              headers: {
                ...COMMON_HEADERS,
                'content-type': 'application/json',
              },
              timeout: REQUEST_TIMEOUT,
            },
          );
        } catch (err) {
          const axiosErr = err as AxiosError;
          const status = axiosErr.response?.status;
          if (status === 403) {
            console.error(
              `[Perekrestok] 403 Forbidden for category ${categoryId} — bot protection active`,
            );
          } else {
            console.error(
              `[Perekrestok] HTTP ${status ?? 'network error'} for category ${categoryId}: ${axiosErr.message}`,
            );
          }
          break;
        }

        if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
          console.error(`[Perekrestok] Got HTML instead of JSON for category ${categoryId} — WAF active`);
          break;
        }

        const items = response.data.content?.items ?? [];
        console.log(`[Perekrestok] Category ${categoryId} page ${page}: ${items.length} items`);

        if (items.length === 0) break;

        for (const item of items) {
          const mapped = this.mapProduct(item);
          if (mapped) allProducts.set(mapped.url, mapped);
        }

        const total = response.data.content?.totalCount ?? 0;
        if (page * perPage >= total) break;
        page++;
        await this.delay(800, 1500);
      }

      await this.delay(1000, 2000);
    }

    return Array.from(allProducts.values());
  }

  // ── Product mapping ────────────────────────────────────────────────────────

  private mapProduct(item: PerekProduct): ScrapedProduct | null {
    const name = item.title ?? item.name;
    if (!name) return null;

    // Price: try regular/promo (rubles), fallback to price (kopecks)
    let price: number | undefined;
    if (item.prices?.promo && item.prices.promo > 0) {
      price = item.prices.promo;
    } else if (item.prices?.regular && item.prices.regular > 0) {
      price = item.prices.regular;
    } else if (item.prices?.price && item.prices.price > 0) {
      // Kopecks from legacy API
      price = item.prices.price > 5000 ? item.prices.price / 100 : item.prices.price;
    }

    if (!price || price <= 0) return null;

    // pricePerUnit (kopecks → rubles)
    let pricePerUnit: number | null = null;
    if (item.prices?.pricePerUnit && item.prices.pricePerUnit > 0) {
      pricePerUnit = item.prices.pricePerUnit > 50000
        ? item.prices.pricePerUnit / 100
        : item.prices.pricePerUnit;
    }

    // URL
    const urlPath = item.url ?? item.slug;
    const productUrl = urlPath
      ? (urlPath.startsWith('http') ? urlPath : `${this.baseUrl}${urlPath}`)
      : `${this.baseUrl}/cat/`;

    // Image
    let imageUrl: string | undefined;
    if (item.images && item.images.length > 0) {
      const img = item.images[0];
      imageUrl = img.url ?? img.src;
    } else if (item.image) {
      imageUrl = item.image.startsWith('http') ? item.image : `${this.baseUrl}${item.image}`;
    }

    // Category
    const categoryTitle =
      item.category?.title ??
      (item.categories && item.categories.length > 0 ? item.categories[0].title : undefined) ??
      '';
    const category = categoryTitle ? this.mapCategory(categoryTitle) : 'bakaleya';

    return {
      storeProductName: name,
      price,
      pricePerUnit,
      category,
      url: productUrl,
      imageUrl,
    };
  }
}
