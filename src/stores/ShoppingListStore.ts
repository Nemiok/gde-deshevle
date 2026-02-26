import { makeAutoObservable, runInAction } from 'mobx';
import { ShoppingListItem } from '../models/ShoppingListItem';
import { Product } from '../models/Product';
import { safeGetItem, safeSetItem } from '../utils/storage';

const STORAGE_KEY = 'gde-deshevle-list';

export class ShoppingListStore {
  items: ShoppingListItem[] = [];

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = safeGetItem(STORAGE_KEY);
      if (raw) {
        runInAction(() => {
          this.items = JSON.parse(raw);
        });
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage() {
    try {
      safeSetItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      // ignore
    }
  }

  addItem(product: Product, quantity = 1) {
    const existing = this.items.find(i => i.productId === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push({
        productId: product.id,
        name: product.normalizedName,
        quantity,
        unit: product.unit,
      });
    }
    this.saveToStorage();
  }

  removeItem(productId: number) {
    this.items = this.items.filter(i => i.productId !== productId);
    this.saveToStorage();
  }

  updateQuantity(productId: number, quantity: number) {
    const item = this.items.find(i => i.productId === productId);
    if (item) {
      item.quantity = Math.max(1, quantity);
      this.saveToStorage();
    }
  }

  clearAll() {
    this.items = [];
    this.saveToStorage();
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  get itemCount(): number {
    return this.items.length;
  }
}
