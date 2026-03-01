import axios, { AxiosError } from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * Lenta (lenta.com) scraper.
 *
 * Lenta has Qrator WAF on their full catalog — scraping category pages
 * without a real browser is not reliably possible. Instead, we use
 * the known Lenta promotions/mobile API endpoints which are lighter weight:
 *
 *   GET /api/v1/stores/                               — get store list
 *   GET /api/v1/stores/{store_id}/home                — promoted goods
 *   GET /api/v1/stores/{store_id}/mobilepromo?limit=50&offset=0&type=weekly
 *   GET /api/v1/stores/{store_id}/crazypromotions?limit=50&offset=0
 *
 * These may still require Qrator cookies. If they return 403 or HTML,
 * it is logged clearly with actionable guidance.
 *
 * Additionally, we try the Lenta public catalog API:
 *   GET https://lenta.com/api/v1/catalog/
 *
 * All requests include realistic browser headers.
 */

// ── API response shapes ───────────────────────────────────────────────────────

interface LentaStore {
  id?: string | number;
  storeId?: string | number;
  address?: string;
  city?: string;
  cityName?: string;
}

interface LentaStoresResponse {
  stores?: LentaStore[];
  items?: LentaStore[];
}

interface LentaPrice {
  regular?: number;
  promo?: number;
  price?: number;
  oldPrice?: number;
  unitPrice?: number | null;
  unitName?: string;
}

interface LentaGoodImage {
  url?: string;
  src?: string;
}

interface LentaGood {
  id?: string | number;
  title?: string;
  name?: string;
  url?: string;
  slug?: string;
  image?: string | LentaGoodImage;
  images?: LentaGoodImage[];
  price?: LentaPrice | number;
  regularPrice?: number;
  promoPrice?: number;
  category?: string;
  categories?: Array<{ title?: string; name?: string }>;
  unitPrice?: number | null;
}

interface LentaPromoResponse {
  goods?: LentaGood[];
  items?: LentaGood[];
  products?: LentaGood[];
  total?: number;
  count?: number;
}

interface LentaCatalogCategory {
  id?: string | number;
  code?: string;
  title?: string;
  name?: string;
}

interface LentaCatalogResponse {
  categories?: LentaCatalogCategory[];
  items?: LentaCatalogCategory[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LENTA_BASE_URL = 'https://lenta.com';
const LENTA_API = `${LENTA_BASE_URL}/api/v1`;
const REQUEST_TIMEOUT = 15_000;
const PROMO_PAGE_SIZE = 50;

// Known Saint Petersburg store ID for Lenta (fallback if /stores/ fails)
const SPB_STORE_FALLBACK_ID = '7701';

const COMMON_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'origin': LENTA_BASE_URL,
  'referer': `${LENTA_BASE_URL}/`,
};

export class LentaScraper extends BaseScraper {
  readonly storeName = 'Lenta';
  readonly storeSlug = 'lenta';
  readonly baseUrl = LENTA_BASE_URL;

  async scrapeProducts(): Promise<ScrapedProduct[]> {
    const allProducts = new Map<string, ScrapedProduct>(); // dedup by URL

    // Step 1: Get a store ID for Saint Petersburg
    const storeId = await this.getSpbStoreId();
    console.log(`[Lenta] Using store ID: ${storeId}`);

    // Step 2: Scrape promos from all promo endpoints
    const promoEndpoints = [
      { name: 'home', url: `${LENTA_API}/stores/${storeId}/home` },
      { name: 'mobilepromo weekly', url: `${LENTA_API}/stores/${storeId}/mobilepromo?limit=${PROMO_PAGE_SIZE}&offset=0&type=weekly` },
      { name: 'mobilepromo everyday', url: `${LENTA_API}/stores/${storeId}/mobilepromo?limit=${PROMO_PAGE_SIZE}&offset=0&type=everyday` },
      { name: 'crazypromotions', url: `${LENTA_API}/stores/${storeId}/crazypromotions?limit=${PROMO_PAGE_SIZE}&offset=0` },
    ];

    for (const endpoint of promoEndpoints) {
      try {
        const products = await this.fetchPromoEndpoint(endpoint.url, endpoint.name);
        for (const p of products) {
          allProducts.set(p.url, p);
        }
        console.log(
          `[Lenta] Endpoint "${endpoint.name}" → ${products.length} products (total: ${allProducts.size})`,
        );
      } catch (err) {
        console.warn(
          `[Lenta] Endpoint "${endpoint.name}" failed:`,
          err instanceof Error ? err.message : err,
        );
      }
      await this.delay(1000, 2000);
    }

    // Step 3: Paginate through promo pages to get more products
    if (allProducts.size > 0) {
      await this.paginateWeeklyPromo(storeId, allProducts);
    }

    // Step 4: Try catalog API if we have too few products
    if (allProducts.size < 30) {
      console.log('[Lenta] Few promo products found, trying catalog API...');
      await this.tryCatalogApi(storeId, allProducts);
    }

    const result = Array.from(allProducts.values());
    console.log(`[Lenta] Total unique products: ${result.length}`);
    return result;
  }

  // ── Store discovery ────────────────────────────────────────────────────────

  private async getSpbStoreId(): Promise<string> {
    try {
      const response = await axios.get<LentaStoresResponse>(
        `${LENTA_API}/stores/`,
        {
          headers: COMMON_HEADERS,
          timeout: REQUEST_TIMEOUT,
        },
      );

      if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
        console.warn('[Lenta] /stores/ returned HTML — Qrator WAF active, using fallback store ID');
        return SPB_STORE_FALLBACK_ID;
      }

      const stores = response.data.stores ?? response.data.items ?? [];
      console.log(`[Lenta] Found ${stores.length} stores`);

      // Find Saint Petersburg store
      const spbStore = stores.find((s) => {
        const city = (s.city ?? s.cityName ?? '').toLowerCase();
        return city.includes('санкт') || city.includes('питер') || city.includes('spb') || city.includes('saint');
      });

      if (spbStore) {
        const id = String(spbStore.id ?? spbStore.storeId ?? '');
        if (id) {
          console.log(`[Lenta] Found SPb store: ${id}`);
          return id;
        }
      }

      // Use first store if no SPb found
      if (stores.length > 0) {
        const firstId = String(stores[0].id ?? stores[0].storeId ?? SPB_STORE_FALLBACK_ID);
        console.log(`[Lenta] No SPb store found, using first store: ${firstId}`);
        return firstId;
      }
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 403) {
        console.warn('[Lenta] 403 on /stores/ — Qrator WAF active, using fallback store ID');
      } else {
        console.warn(`[Lenta] /stores/ failed (${status ?? 'network error'}), using fallback store ID`);
      }
    }

    return SPB_STORE_FALLBACK_ID;
  }

  // ── Promo endpoint fetcher ─────────────────────────────────────────────────

  private async fetchPromoEndpoint(
    url: string,
    endpointName: string,
  ): Promise<ScrapedProduct[]> {
    let response;
    try {
      response = await axios.get<LentaPromoResponse>(url, {
        headers: COMMON_HEADERS,
        timeout: REQUEST_TIMEOUT,
      });
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      if (status === 403) {
        console.error(
          `[Lenta] 403 Forbidden for "${endpointName}" — Qrator WAF challenge active. ` +
          `This endpoint requires a valid Qrator session cookie. ` +
          `The Timeweb Cloud server IP may not be whitelisted.`,
        );
      } else {
        console.error(
          `[Lenta] HTTP ${status ?? 'network error'} for "${endpointName}": ${axiosErr.message}`,
        );
      }
      return [];
    }

    if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
      console.error(
        `[Lenta] Got HTML instead of JSON for "${endpointName}" — ` +
        `Qrator WAF challenge page returned. Bot protection is active.`,
      );
      return [];
    }

    const data = response.data;
    const goods: LentaGood[] = data.goods ?? data.items ?? data.products ?? [];
    console.log(`[Lenta] "${endpointName}": ${goods.length} items`);

    return goods.map((g) => this.mapGood(g)).filter((p): p is ScrapedProduct => p !== null);
  }

  // ── Paginate weekly promo ──────────────────────────────────────────────────

  private async paginateWeeklyPromo(
    storeId: string,
    allProducts: Map<string, ScrapedProduct>,
  ): Promise<void> {
    let offset = PROMO_PAGE_SIZE; // already fetched offset 0
    const maxPages = 10;
    let page = 1;

    while (page < maxPages) {
      const url = `${LENTA_API}/stores/${storeId}/mobilepromo?limit=${PROMO_PAGE_SIZE}&offset=${offset}&type=weekly`;

      let response;
      try {
        response = await axios.get<LentaPromoResponse>(url, {
          headers: COMMON_HEADERS,
          timeout: REQUEST_TIMEOUT,
        });
      } catch (err) {
        const axiosErr = err as AxiosError;
        console.error(
          `[Lenta] Pagination page ${page + 1} failed: HTTP ${axiosErr.response?.status ?? 'network error'}`,
        );
        break;
      }

      if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
        console.error('[Lenta] Got HTML on pagination — stopping');
        break;
      }

      const goods: LentaGood[] = response.data.goods ?? response.data.items ?? response.data.products ?? [];
      if (goods.length === 0) {
        console.log('[Lenta] No more promo items');
        break;
      }

      for (const g of goods) {
        const mapped = this.mapGood(g);
        if (mapped) allProducts.set(mapped.url, mapped);
      }

      console.log(`[Lenta] Promo page ${page + 1} offset ${offset}: ${goods.length} items (total: ${allProducts.size})`);

      if (goods.length < PROMO_PAGE_SIZE) break;
      offset += PROMO_PAGE_SIZE;
      page++;
      await this.delay(800, 1500);
    }
  }

  // ── Catalog API fallback ───────────────────────────────────────────────────

  private async tryCatalogApi(
    storeId: string,
    allProducts: Map<string, ScrapedProduct>,
  ): Promise<void> {
    // Try fetching catalog categories
    let response;
    try {
      response = await axios.get<LentaCatalogResponse>(`${LENTA_API}/catalog/`, {
        params: { store_id: storeId },
        headers: COMMON_HEADERS,
        timeout: REQUEST_TIMEOUT,
      });
    } catch (err) {
      const axiosErr = err as AxiosError;
      console.error(
        `[Lenta Catalog] HTTP ${axiosErr.response?.status ?? 'network error'}: ${axiosErr.message}`,
      );
      return;
    }

    if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
      console.error('[Lenta Catalog] Got HTML instead of JSON — WAF active');
      return;
    }

    const categories = response.data.categories ?? response.data.items ?? [];
    console.log(`[Lenta Catalog] Found ${categories.length} categories`);

    // Scrape a few key categories
    for (const cat of categories.slice(0, 10)) {
      const catId = cat.id ?? cat.code;
      if (!catId) continue;

      const catUrl = `${LENTA_API}/catalog/${catId}/products/?store_id=${storeId}&limit=50&offset=0`;
      try {
        const products = await this.fetchPromoEndpoint(catUrl, `catalog/${catId}`);
        for (const p of products) {
          allProducts.set(p.url, p);
        }
      } catch (err) {
        console.warn(`[Lenta Catalog] Category ${catId} failed:`, err instanceof Error ? err.message : err);
      }
      await this.delay(1000, 2000);
    }
  }

  // ── Product mapping ────────────────────────────────────────────────────────

  private mapGood(item: LentaGood): ScrapedProduct | null {
    const name = item.title ?? item.name;
    if (!name) return null;

    // Extract price
    let price: number | undefined;
    let pricePerUnit: number | null = null;

    if (typeof item.price === 'object' && item.price !== null) {
      const p = item.price as LentaPrice;
      price = p.promo ?? p.regular ?? p.price;
      pricePerUnit = p.unitPrice ?? null;
    } else if (typeof item.price === 'number') {
      price = item.price;
    } else {
      price = item.promoPrice ?? item.regularPrice;
    }

    // Standalone unitPrice field
    if (!pricePerUnit && item.unitPrice) {
      pricePerUnit = item.unitPrice;
    }

    if (!price || price <= 0) return null;

    // URL
    const urlPath = item.url ?? item.slug;
    const productUrl = urlPath
      ? (urlPath.startsWith('http') ? urlPath : `${this.baseUrl}${urlPath}`)
      : `${this.baseUrl}/catalog/`;

    // Image
    let imageUrl: string | undefined;
    if (item.images && item.images.length > 0) {
      const img = item.images[0];
      const rawSrc = img.url ?? img.src;
      imageUrl = rawSrc
        ? (rawSrc.startsWith('http') ? rawSrc : `${this.baseUrl}${rawSrc}`)
        : undefined;
    } else if (typeof item.image === 'string') {
      imageUrl = item.image.startsWith('http') ? item.image : `${this.baseUrl}${item.image}`;
    } else if (typeof item.image === 'object' && item.image !== null) {
      const rawSrc = (item.image as LentaGoodImage).url ?? (item.image as LentaGoodImage).src;
      imageUrl = rawSrc
        ? (rawSrc.startsWith('http') ? rawSrc : `${this.baseUrl}${rawSrc}`)
        : undefined;
    }

    // Category
    const rawCategory =
      (item.categories && item.categories.length > 0
        ? (item.categories[0].title ?? item.categories[0].name)
        : undefined) ??
      item.category ??
      '';
    const category = rawCategory ? this.mapCategory(rawCategory) : 'bakaleya';

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
