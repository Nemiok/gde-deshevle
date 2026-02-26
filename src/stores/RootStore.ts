import { createContext, useContext } from 'react';
import { ShoppingListStore } from './ShoppingListStore';
import { PriceStore } from './PriceStore';
import { OptimizerStore } from './OptimizerStore';
import { SettingsStore } from './SettingsStore';

export class RootStore {
  shoppingList: ShoppingListStore;
  prices: PriceStore;
  optimizer: OptimizerStore;
  settings: SettingsStore;

  constructor() {
    this.shoppingList = new ShoppingListStore();
    this.prices = new PriceStore();
    this.settings = new SettingsStore();
    this.optimizer = new OptimizerStore(this.shoppingList, this.prices, this.settings);
  }
}

const rootStore = new RootStore();
const StoreContext = createContext<RootStore>(rootStore);

export function useStore(): RootStore {
  return useContext(StoreContext);
}

export { StoreContext, rootStore };
