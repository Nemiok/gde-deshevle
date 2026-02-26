export interface PriceRecord {
  productId: number;
  storeId: number;
  storeName: string;
  price: number;
  pricePerUnit: number;
  scrapedAt: string;
}

export interface ProductPrices {
  productId: number;
  name: string;
  prices: PriceRecord[];
}
