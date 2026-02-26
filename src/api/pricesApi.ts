import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { ProductPrices } from '../models/PriceRecord';

// --- Mock stores ---
export const STORES: Store[] = [
  { id: 1, name: 'Пятёрочка', slug: 'pyaterochka', websiteUrl: 'https://5ka.ru', color: '#E31E24' },
  { id: 2, name: 'Магнит', slug: 'magnit', websiteUrl: 'https://magnit.ru', color: '#D5232F' },
  { id: 3, name: 'Лента', slug: 'lenta', websiteUrl: 'https://lenta.com', color: '#003DA5' },
  { id: 4, name: 'Перекрёсток', slug: 'perekrestok', websiteUrl: 'https://perekrestok.ru', color: '#00A651' },
  { id: 5, name: 'ВкусВилл', slug: 'vkusvill', websiteUrl: 'https://vkusvill.ru', color: '#8CC63F' },
];

// --- Mock product catalog ---
export const PRODUCTS: Product[] = [
  { id: 1, normalizedName: 'Молоко 3.2% 1л', category: 'Молочные', unit: 'л' },
  { id: 2, normalizedName: 'Хлеб белый нарезной', category: 'Хлеб', unit: 'шт' },
  { id: 3, normalizedName: 'Яйца куриные С1 10шт', category: 'Яйца', unit: 'уп' },
  { id: 4, normalizedName: 'Сахар-песок 1кг', category: 'Бакалея', unit: 'кг' },
  { id: 5, normalizedName: 'Масло сливочное 82.5% 180г', category: 'Молочные', unit: 'шт' },
  { id: 6, normalizedName: 'Бананы 1кг', category: 'Фрукты', unit: 'кг' },
  { id: 7, normalizedName: 'Картофель 1кг', category: 'Овощи', unit: 'кг' },
  { id: 8, normalizedName: 'Куриная грудка 1кг', category: 'Мясо', unit: 'кг' },
  { id: 9, normalizedName: 'Рис круглозёрный 900г', category: 'Бакалея', unit: 'шт' },
  { id: 10, normalizedName: 'Макароны спагетти 500г', category: 'Бакалея', unit: 'шт' },
  { id: 11, normalizedName: 'Сметана 20% 300г', category: 'Молочные', unit: 'шт' },
  { id: 12, normalizedName: 'Творог 5% 200г', category: 'Молочные', unit: 'шт' },
  { id: 13, normalizedName: 'Кефир 2.5% 930мл', category: 'Молочные', unit: 'шт' },
  { id: 14, normalizedName: 'Помидоры 1кг', category: 'Овощи', unit: 'кг' },
  { id: 15, normalizedName: 'Огурцы 1кг', category: 'Овощи', unit: 'кг' },
  { id: 16, normalizedName: 'Лук репчатый 1кг', category: 'Овощи', unit: 'кг' },
  { id: 17, normalizedName: 'Морковь 1кг', category: 'Овощи', unit: 'кг' },
  { id: 18, normalizedName: 'Яблоки 1кг', category: 'Фрукты', unit: 'кг' },
  { id: 19, normalizedName: 'Сыр Российский 300г', category: 'Молочные', unit: 'шт' },
  { id: 20, normalizedName: 'Колбаса Докторская 400г', category: 'Мясо', unit: 'шт' },
  { id: 21, normalizedName: 'Чай чёрный 100 пакетиков', category: 'Напитки', unit: 'шт' },
  { id: 22, normalizedName: 'Кофе растворимый 95г', category: 'Напитки', unit: 'шт' },
  { id: 23, normalizedName: 'Подсолнечное масло 1л', category: 'Бакалея', unit: 'л' },
  { id: 24, normalizedName: 'Мука пшеничная 2кг', category: 'Бакалея', unit: 'шт' },
  { id: 25, normalizedName: 'Гречка 900г', category: 'Бакалея', unit: 'шт' },
  { id: 26, normalizedName: 'Йогурт натуральный 350г', category: 'Молочные', unit: 'шт' },
  { id: 27, normalizedName: 'Вода питьевая 5л', category: 'Напитки', unit: 'шт' },
  { id: 28, normalizedName: 'Капуста белокочанная 1кг', category: 'Овощи', unit: 'кг' },
  { id: 29, normalizedName: 'Свинина шейка 1кг', category: 'Мясо', unit: 'кг' },
  { id: 30, normalizedName: 'Батон нарезной', category: 'Хлеб', unit: 'шт' },
];

// --- Mock price data ---
// Realistic prices in rubles — vary by store with discount stores being cheaper
const PRICE_MATRIX: Record<number, Record<number, number>> = {
  // productId -> { storeId -> price }
  1:  { 1: 79.90, 2: 82.50, 3: 74.90, 4: 89.90, 5: 94.90 },
  2:  { 1: 42.90, 2: 39.90, 3: 44.90, 4: 49.90, 5: 59.90 },
  3:  { 1: 109.90, 2: 104.90, 3: 99.90, 4: 119.90, 5: 129.90 },
  4:  { 1: 69.90, 2: 72.50, 3: 64.90, 4: 74.90, 5: 79.90 },
  5:  { 1: 169.90, 2: 174.90, 3: 159.90, 4: 179.90, 5: 199.90 },
  6:  { 1: 89.90, 2: 94.90, 3: 79.90, 4: 99.90, 5: 109.90 },
  7:  { 1: 29.90, 2: 34.90, 3: 24.90, 4: 39.90, 5: 44.90 },
  8:  { 1: 299.90, 2: 289.90, 3: 279.90, 4: 319.90, 5: 349.90 },
  9:  { 1: 84.90, 2: 89.90, 3: 79.90, 4: 94.90, 5: 99.90 },
  10: { 1: 69.90, 2: 64.90, 3: 59.90, 4: 74.90, 5: 79.90 },
  11: { 1: 79.90, 2: 84.90, 3: 74.90, 4: 89.90, 5: 94.90 },
  12: { 1: 64.90, 2: 69.90, 3: 59.90, 4: 74.90, 5: 79.90 },
  13: { 1: 84.90, 2: 89.90, 3: 79.90, 4: 94.90, 5: 99.90 },
  14: { 1: 199.90, 2: 209.90, 3: 179.90, 4: 219.90, 5: 249.90 },
  15: { 1: 149.90, 2: 159.90, 3: 139.90, 4: 169.90, 5: 189.90 },
  16: { 1: 34.90, 2: 39.90, 3: 29.90, 4: 44.90, 5: 49.90 },
  17: { 1: 39.90, 2: 44.90, 3: 34.90, 4: 49.90, 5: 54.90 },
  18: { 1: 109.90, 2: 119.90, 3: 99.90, 4: 129.90, 5: 139.90 },
  19: { 1: 289.90, 2: 299.90, 3: 269.90, 4: 309.90, 5: 329.90 },
  20: { 1: 249.90, 2: 259.90, 3: 239.90, 4: 269.90, 5: 289.90 },
  21: { 1: 189.90, 2: 199.90, 3: 179.90, 4: 209.90, 5: 219.90 },
  22: { 1: 349.90, 2: 359.90, 3: 329.90, 4: 379.90, 5: 399.90 },
  23: { 1: 139.90, 2: 144.90, 3: 129.90, 4: 149.90, 5: 159.90 },
  24: { 1: 109.90, 2: 114.90, 3: 99.90, 4: 119.90, 5: 124.90 },
  25: { 1: 99.90, 2: 104.90, 3: 89.90, 4: 109.90, 5: 119.90 },
  26: { 1: 69.90, 2: 74.90, 3: 64.90, 4: 79.90, 5: 59.90 },
  27: { 1: 79.90, 2: 84.90, 3: 69.90, 4: 89.90, 5: 94.90 },
  28: { 1: 24.90, 2: 29.90, 3: 19.90, 4: 34.90, 5: 39.90 },
  29: { 1: 399.90, 2: 389.90, 3: 369.90, 4: 419.90, 5: 449.90 },
  30: { 1: 39.90, 2: 44.90, 3: 37.90, 4: 46.90, 5: 54.90 },
};

// --- API functions ---

export async function searchProducts(query: string, limit = 10): Promise<Product[]> {
  // Simulate API delay
  await new Promise(r => setTimeout(r, 150));
  const q = query.toLowerCase();
  return PRODUCTS
    .filter(p => p.normalizedName.toLowerCase().includes(q))
    .slice(0, limit);
}

export async function fetchPrices(productIds: number[]): Promise<ProductPrices[]> {
  await new Promise(r => setTimeout(r, 200));
  return productIds.map(pid => {
    const product = PRODUCTS.find(p => p.id === pid);
    const storePrices = PRICE_MATRIX[pid] || {};
    return {
      productId: pid,
      name: product?.normalizedName || 'Неизвестный продукт',
      prices: STORES.map(store => ({
        productId: pid,
        storeId: store.id,
        storeName: store.name,
        price: storePrices[store.id] ?? -1,
        pricePerUnit: storePrices[store.id] ?? -1,
        scrapedAt: new Date().toISOString(),
      })).filter(p => p.price > 0),
    };
  });
}

export async function fetchStores(): Promise<Store[]> {
  await new Promise(r => setTimeout(r, 50));
  return STORES;
}
