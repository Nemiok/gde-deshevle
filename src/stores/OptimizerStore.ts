import { makeAutoObservable, computed } from 'mobx';
import { ShoppingListStore } from './ShoppingListStore';
import { PriceStore } from './PriceStore';
import { SettingsStore } from './SettingsStore';
import { findBestSplit, SplitResult } from '../utils/optimizer';

export class OptimizerStore {
  private shoppingListStore: ShoppingListStore;
  private priceStore: PriceStore;
  private settingsStore: SettingsStore;

  constructor(
    shoppingListStore: ShoppingListStore,
    priceStore: PriceStore,
    settingsStore: SettingsStore
  ) {
    makeAutoObservable(this, {
      bestSplit: computed,
    });
    this.shoppingListStore = shoppingListStore;
    this.priceStore = priceStore;
    this.settingsStore = settingsStore;
  }

  get bestSplit(): SplitResult | null {
    return findBestSplit(
      this.shoppingListStore.items,
      this.priceStore.pricesMap,
      this.priceStore.stores,
      this.settingsStore.maxStores
    );
  }
}
