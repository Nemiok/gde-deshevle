import { makeAutoObservable, runInAction } from 'mobx';
import { ProductPrices } from '../models/PriceRecord';
import { Store } from '../models/Store';
import { fetchPrices, fetchStores } from '../api/pricesApi';

export class PriceStore {
  pricesMap: Map<number, ProductPrices> = new Map();
  stores: Store[] = [];
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.loadStores();
  }

  async loadStores() {
    const stores = await fetchStores();
    runInAction(() => {
      this.stores = stores;
    });
  }

  async fetchPricesForItems(productIds: number[]) {
    if (productIds.length === 0) return;
    this.loading = true;
    this.error = null;
    try {
      const data = await fetchPrices(productIds);
      runInAction(() => {
        for (const pp of data) {
          this.pricesMap.set(pp.productId, pp);
        }
        this.loading = false;
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message || 'Ошибка загрузки цен';
        this.loading = false;
      });
    }
  }

  getPrice(productId: number, storeId: number): number | null {
    const pp = this.pricesMap.get(productId);
    if (!pp) return null;
    const rec = pp.prices.find(p => p.storeId === storeId);
    return rec?.price ?? null;
  }

  getStoreTotal(productIds: { productId: number; quantity: number }[], storeId: number): number {
    let total = 0;
    for (const item of productIds) {
      const price = this.getPrice(item.productId, storeId);
      if (price !== null) {
        total += price * item.quantity;
      }
    }
    return total;
  }
}
