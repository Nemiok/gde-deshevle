import axios, { AxiosError } from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * VkusVill (vkusvill.ru) scraper.
 *
 * Primary strategy: MCP server at https://mcp001.vkusvill.ru/mcp
 *   JSON-RPC 2.0, method: tools/call, tool: vkusvill_products_search
 *
 * Fallback: REST API at https://vkusvill.ru/api/
 *   GET /goods/getList with section_id and pagination params
 *
 * Searches for a comprehensive list of Russian food product keywords to cover
 * our 50 canonical products. Deduplicates by product ID.
 */

// ── MCP response shapes ───────────────────────────────────────────────────────

interface VvMcpProductPrice {
  current?: number;
  old?: number;
}

interface VvMcpProduct {
  id: number | string;
  xml_id?: string;
  name: string;
  url?: string;
  price?: VvMcpProductPrice;
  rating?: { average?: number };
  weight?: string;
  unit?: string;
  images?: Array<{ src?: string; url?: string }>;
  picture?: string;
  section?: string;
  category?: string;
}

interface VvMcpResultContent {
  type?: string;
  text?: string;
}

interface VvMcpResult {
  content?: VvMcpResultContent[];
  isError?: boolean;
}

interface VvMcpResponse {
  jsonrpc?: string;
  id?: number;
  result?: VvMcpResult;
  error?: { code: number; message: string };
}

// ── REST fallback shapes ──────────────────────────────────────────────────────

interface VvRestProduct {
  ID?: number | string;
  NAME?: string;
  DETAIL_PAGE_URL?: string;
  PREVIEW_PICTURE?: string | { SRC?: string };
  CATALOG_PRICE?: number;
  CATALOG_PRICE_UNIT?: number;
  SECTION_NAME?: string;
  PROPERTIES?: {
    PRICE?: { VALUE?: number };
    UNIT?: { VALUE?: string };
  };
}

interface VvRestResponse {
  data?: VvRestProduct[];
  items?: VvRestProduct[];
  ITEMS?: VvRestProduct[];
  total?: number;
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

const MCP_URL = 'https://mcp001.vkusvill.ru/mcp';
const REST_FALLBACK_URL = 'https://vkusvill.ru/api/goods/getList';
const REQUEST_TIMEOUT = 15_000;

const COMMON_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'ru-RU,ru;q=0.9',
  'origin': 'https://vkusvill.ru',
  'referer': 'https://vkusvill.ru/',
};

export class VkusvillScraper extends BaseScraper {
  readonly storeName = 'VkusVill';
  readonly storeSlug = 'vkusvill';
  readonly baseUrl = 'https://vkusvill.ru';

  async scrapeProducts(): Promise<ScrapedProduct[]> {
    // Try MCP server first
    try {
      const products = await this.scrapeViaMcp();
      if (products.length > 0) {
        console.log(`[VkusVill] MCP strategy succeeded — ${products.length} products`);
        return products;
      }
      console.warn('[VkusVill] MCP returned 0 products, falling back to REST API');
    } catch (err) {
      console.warn('[VkusVill] MCP strategy failed, falling back to REST API:', err instanceof Error ? err.message : err);
    }

    // REST API fallback
    try {
      const products = await this.scrapeViaRest();
      console.log(`[VkusVill] REST strategy result — ${products.length} products`);
      return products;
    } catch (err) {
      console.error('[VkusVill] REST strategy also failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  // ── MCP Strategy ──────────────────────────────────────────────────────────

  private async scrapeViaMcp(): Promise<ScrapedProduct[]> {
    const allProducts = new Map<string, ScrapedProduct>(); // dedup by ID

    for (const keyword of SEARCH_KEYWORDS) {
      try {
        const products = await this.searchMcp(keyword, 1);
        for (const p of products) {
          // Use URL as dedup key (unique per product)
          allProducts.set(p.url, p);
        }
        console.log(
          `[VkusVill MCP] "${keyword}" → ${products.length} products (total unique: ${allProducts.size})`,
        );
      } catch (err) {
        console.warn(`[VkusVill MCP] Search "${keyword}" failed:`, err instanceof Error ? err.message : err);
      }
      await this.delay(800, 1500);
    }

    return Array.from(allProducts.values());
  }

  private async searchMcp(query: string, page: number): Promise<ScrapedProduct[]> {
    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'vkusvill_products_search',
        arguments: {
          q: query,
          page,
          sort: 'popularity',
        },
      },
    };

    const response = await axios.post<VvMcpResponse>(MCP_URL, requestBody, {
      headers: {
        ...COMMON_HEADERS,
        'content-type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT,
    });

    // Check for HTML block
    if (typeof response.data === 'string' && this.isHtmlResponse(response.data)) {
      console.error('[VkusVill MCP] Got HTML instead of JSON — likely blocked');
      return [];
    }

    const mcpResponse = response.data;

    if (mcpResponse.error) {
      console.error(`[VkusVill MCP] JSON-RPC error: ${mcpResponse.error.message}`);
      return [];
    }

    const result = mcpResponse.result;
    if (!result || result.isError) {
      console.warn('[VkusVill MCP] Result is error or empty');
      return [];
    }

    // Extract text content from MCP response
    const textContent = result.content?.find((c) => c.type === 'text')?.text;
    if (!textContent) return [];

    // Parse the text content as JSON array of products
    let rawProducts: VvMcpProduct[] = [];
    try {
      const parsed = JSON.parse(textContent);
      rawProducts = Array.isArray(parsed) ? parsed : (parsed.products ?? parsed.items ?? []);
    } catch {
      console.warn('[VkusVill MCP] Could not parse product text as JSON:', textContent.substring(0, 200));
      return [];
    }

    return this.mapMcpProducts(rawProducts);
  }

  private mapMcpProducts(rawProducts: VvMcpProduct[]): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    for (const item of rawProducts) {
      if (!item.name) continue;

      const price = item.price?.current;
      if (!price || price <= 0) continue;

      const productUrl = item.url
        ? (item.url.startsWith('http') ? item.url : `${this.baseUrl}${item.url}`)
        : `${this.baseUrl}/goods/`;

      const imageUrl = item.images && item.images.length > 0
        ? (item.images[0].src ?? item.images[0].url)
        : (item.picture ?? undefined);

      const rawCategory = item.section ?? item.category ?? '';
      const category = rawCategory ? this.mapCategory(rawCategory) : 'bakaleya';

      products.push({
        storeProductName: item.name,
        price,
        pricePerUnit: null, // MCP doesn't expose pricePerUnit directly
        category,
        url: productUrl,
        imageUrl: imageUrl ?? undefined,
      });
    }

    return products;
  }

  // ── REST API Fallback ─────────────────────────────────────────────────────

  private async scrapeViaRest(): Promise<ScrapedProduct[]> {
    const allProducts = new Map<string, ScrapedProduct>();

    // VkusVill REST: try searching by keyword via the product search endpoint
    const searchUrl = 'https://vkusvill.ru/api/v3/catalog/items';

    for (const keyword of SEARCH_KEYWORDS) {
      try {
        let page = 1;
        const perPage = 48;

        while (true) {
          let data: VvRestResponse;

          try {
            const response = await axios.get<VvRestResponse>(searchUrl, {
              params: {
                search: keyword,
                page,
                'per-page': perPage,
                shop: 'spb',
              },
              headers: {
                ...COMMON_HEADERS,
                'x-requested-with': 'XMLHttpRequest',
              },
              timeout: REQUEST_TIMEOUT,
            });

            if (typeof response.data === 'string' && this.isHtmlResponse(response.data as unknown as string)) {
              console.error(`[VkusVill REST] Got HTML instead of JSON for "${keyword}" page ${page} — likely blocked`);
              break;
            }

            data = response.data;
          } catch (err) {
            const axiosErr = err as AxiosError;
            console.error(
              `[VkusVill REST] HTTP error for "${keyword}" page ${page}: ` +
              `${axiosErr.response?.status ?? 'network error'} — ${axiosErr.message}`,
            );
            break;
          }

          const items: VvRestProduct[] = data.data ?? data.items ?? data.ITEMS ?? [];
          console.log(`[VkusVill REST] "${keyword}" page ${page}: ${items.length} items`);

          if (items.length === 0) break;

          for (const item of items) {
            const name = item.NAME;
            if (!name) continue;

            const price = item.CATALOG_PRICE ?? (item.PROPERTIES?.PRICE?.VALUE);
            if (!price || price <= 0) continue;

            const id = String(item.ID ?? name);
            const urlPath = item.DETAIL_PAGE_URL;
            const productUrl = urlPath
              ? (urlPath.startsWith('http') ? urlPath : `${this.baseUrl}${urlPath}`)
              : `${this.baseUrl}/goods/`;

            let imageUrl: string | undefined;
            if (typeof item.PREVIEW_PICTURE === 'string') {
              imageUrl = item.PREVIEW_PICTURE.startsWith('http')
                ? item.PREVIEW_PICTURE
                : `${this.baseUrl}${item.PREVIEW_PICTURE}`;
            } else if (item.PREVIEW_PICTURE?.SRC) {
              const src = item.PREVIEW_PICTURE.SRC;
              imageUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
            }

            const rawCategory = item.SECTION_NAME ?? '';
            const category = rawCategory ? this.mapCategory(rawCategory) : 'bakaleya';

            allProducts.set(id, {
              storeProductName: name,
              price,
              pricePerUnit: item.CATALOG_PRICE_UNIT ?? null,
              category,
              url: productUrl,
              imageUrl,
            });
          }

          if (items.length < perPage) break;
          page++;
          await this.delay(800, 1500);
        }
      } catch (err) {
        console.warn(`[VkusVill REST] Keyword "${keyword}" failed:`, err instanceof Error ? err.message : err);
      }
      await this.delay(1000, 2000);
    }

    return Array.from(allProducts.values());
  }
}
