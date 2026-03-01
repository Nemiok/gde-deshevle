import axios, { AxiosError } from 'axios';
import { BaseScraper, ScrapedProduct } from './base-scraper';

/**
 * Magnit (magnit.ru / web-gateway.middle-api.magnit.ru) scraper.
 *
 * Uses the verified Magnit web-gateway API:
 * POST https://web-gateway.middle-api.magnit.ru/v3/goods
 *
 * Scrapes SPb store (storeCode 543358) across all food categories.
 * Paginates through every category (36 items per page) until exhausted.
 */

// ── API response shapes ───────────────────────────────────────────────────────

interface MagnitGoodImage {
  url: string;
  type?: string;
}

interface MagnitGood {
  id: number | string;
  name: string;
  price?: number;            // kopecks or rubles — check actual response
  oldPrice?: number;
  pricePerKg?: number | null;
  pricePerUnit?: number | null;
  categoryId?: number | string;
  categoryName?: string;
  images?: MagnitGoodImage[];
  slug?: string;
  url?: string;
}

interface MagnitPagination {
  total: number;
  number: number;
  size: number;
}

interface MagnitApiResponse {
  goods?: MagnitGood[];
  pagination?: MagnitPagination;
}

// ── Category mapping ──────────────────────────────────────────────────────────

// These category IDs cover the main food groups in Magnit's catalog.
// IDs sourced from verified API research.
const MAGNIT_CATEGORY_IDS: number[] = [
  4893, // Молочные продукты
  4887, // Хлеб и выпечка
  4894, // Яйца
  4886, // Бакалея
  4885, // Фрукты и овощи
  4889, // Мясо и птица
  4890, // Рыба и морепродукты
  4891, // Напитки
  4892, // Заморожка / Кондитерские
];

const MAGNIT_HEADERS = {
  'x-device-id': 'nk1kmh32na',
  'x-device-tag': 'disabled',
  'x-app-version': '0.1.0',
  'x-device-platform': 'Web',
  'x-client-name': 'magnit',
  'x-platform-version':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'accept': '*/*',
  'accept-language': 'ru-RU,ru;q=0.9',
  'content-type': 'application/json',
  'origin': 'https://magnit.ru',
  'referer': 'https://magnit.ru/',
};

const MAGNIT_API_URL = 'https://web-gateway.middle-api.magnit.ru/v3/goods';
const SPB_STORE_CODE = '543358'; // Magnit store in Saint Petersburg
const PAGE_SIZE = 36;
const REQUEST_TIMEOUT = 15_000;

export class MagnitScraper extends BaseScraper {
  readonly storeName = 'Magnit';
  readonly storeSlug = 'magnit';
  readonly baseUrl = 'https://magnit.ru';

  async scrapeProducts(): Promise<ScrapedProduct[]> {
    return this.withRetry(async () => {
      const allProducts: ScrapedProduct[] = [];

      for (const categoryId of MAGNIT_CATEGORY_IDS) {
        try {
          const products = await this.scrapeCategoryById(categoryId);
          console.log(
            `[Magnit] Category ${categoryId} — ${products.length} products`,
          );
          allProducts.push(...products);
        } catch (err) {
          console.error(`[Magnit] Failed to scrape category ${categoryId}:`, err instanceof Error ? err.message : err);
        }
        await this.delay(1000, 2000);
      }

      console.log(`[Magnit] Total products scraped: ${allProducts.length}`);
      return allProducts;
    });
  }

  private async scrapeCategoryById(categoryId: number): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    let pageNumber = 1;
    let totalPages = 1;

    do {
      const body = {
        categoryIDs: [categoryId],
        includeForAdults: true,
        onlyDiscount: false,
        order: 'desc',
        pagination: { number: pageNumber, size: PAGE_SIZE },
        shopType: '1',
        sortBy: 'popularity',
        storeCodes: [SPB_STORE_CODE],
      };

      let data: MagnitApiResponse;
      try {
        const response = await axios.post<MagnitApiResponse>(
          MAGNIT_API_URL,
          body,
          {
            headers: MAGNIT_HEADERS,
            timeout: REQUEST_TIMEOUT,
          },
        );

        // Detect WAF/HTML block
        if (typeof response.data === 'string' && this.isHtmlResponse(response.data)) {
          console.error(`[Magnit] Got HTML instead of JSON for category ${categoryId} page ${pageNumber} — likely blocked`);
          break;
        }

        data = response.data;
      } catch (err) {
        const axiosErr = err as AxiosError;
        console.error(
          `[Magnit] HTTP error for category ${categoryId} page ${pageNumber}: ` +
          `${axiosErr.response?.status ?? 'network error'} — ${axiosErr.message}`,
        );
        break;
      }

      const goods = data.goods ?? [];
      console.log(`[Magnit] Category ${categoryId} page ${pageNumber}: ${goods.length} items`);

      if (goods.length === 0) break;

      for (const item of goods) {
        if (!item.name) continue;

        // Price can be in rubles or kopecks depending on API version.
        // The verified v3 API returns rubles as floats.
        const rawPrice = item.price;
        if (!rawPrice || rawPrice <= 0) continue;

        // Prices above 50000 are likely kopecks — convert
        const price = rawPrice > 50000 ? rawPrice / 100 : rawPrice;

        const rawPpu = item.pricePerKg ?? item.pricePerUnit ?? null;
        const pricePerUnit = rawPpu
          ? rawPpu > 50000 ? rawPpu / 100 : rawPpu
          : null;

        const categoryName = item.categoryName ?? String(categoryId);
        const category = this.mapCategory(categoryName);

        // Build product URL
        const productSlug = item.slug ?? String(item.id);
        const url = item.url
          ? (item.url.startsWith('http') ? item.url : `${this.baseUrl}${item.url}`)
          : `${this.baseUrl}/magnit-market/p/${productSlug}/`;

        // Pick first image
        const imageUrl = item.images && item.images.length > 0
          ? item.images[0].url
          : undefined;

        products.push({
          storeProductName: item.name,
          price,
          pricePerUnit,
          category,
          url,
          imageUrl,
        });
      }

      // Calculate total pages from pagination info
      if (data.pagination) {
        const { total, size } = data.pagination;
        totalPages = Math.ceil(total / size);
        console.log(
          `[Magnit] Category ${categoryId}: page ${pageNumber}/${totalPages} (total items: ${total})`,
        );
      } else {
        // No pagination info — stop after first page
        break;
      }

      pageNumber++;
      if (pageNumber <= totalPages) {
        await this.delay(800, 1500);
      }
    } while (pageNumber <= totalPages);

    return products;
  }
}
