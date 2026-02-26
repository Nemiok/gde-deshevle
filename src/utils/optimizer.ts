import { ProductPrices } from '../models/PriceRecord';
import { ShoppingListItem } from '../models/ShoppingListItem';
import { Store } from '../models/Store';

export interface SplitResult {
  /** storeId → list of item names assigned to that store */
  storeSplit: Map<number, ShoppingListItem[]>;
  /** Total cost of this split */
  totalCost: number;
  /** Savings vs buying everything at the single cheapest store */
  savingsVsSingleStore: number;
  /** Number of stores visited */
  storeCount: number;
}

/**
 * For a shopping list + price data, find the optimal split across up to maxStores stores.
 * Uses greedy per-item cheapest-store assignment, then collapses to maxStores.
 */
export function findBestSplit(
  items: ShoppingListItem[],
  pricesMap: Map<number, ProductPrices>,
  stores: Store[],
  maxStores: number
): SplitResult | null {
  if (items.length === 0 || stores.length === 0) return null;

  // 1. For each item, find cheapest store
  const itemAssignments: Array<{ item: ShoppingListItem; storeId: number; price: number }> = [];

  for (const item of items) {
    const pp = pricesMap.get(item.productId);
    if (!pp || pp.prices.length === 0) continue;

    let cheapest = pp.prices[0];
    for (const p of pp.prices) {
      if (p.price < cheapest.price) cheapest = p;
    }
    itemAssignments.push({ item, storeId: cheapest.storeId, price: cheapest.price });
  }

  if (itemAssignments.length === 0) return null;

  // 2. Count how many items each store gets
  const storeItemCount = new Map<number, number>();
  for (const { storeId } of itemAssignments) {
    storeItemCount.set(storeId, (storeItemCount.get(storeId) || 0) + 1);
  }

  // 3. If more stores than maxStores, keep top-N by item count
  const sortedStores = [...storeItemCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sid]) => sid);

  const allowedStores = new Set(sortedStores.slice(0, maxStores));

  // 4. Re-assign items that lost their preferred store to the cheapest allowed store
  const finalAssignments: Array<{ item: ShoppingListItem; storeId: number; price: number }> = [];

  for (const { item } of itemAssignments) {
    const pp = pricesMap.get(item.productId)!;
    const allowedPrices = pp.prices.filter(p => allowedStores.has(p.storeId));
    if (allowedPrices.length === 0) {
      // fallback: use original cheapest
      const cheapest = pp.prices.reduce((a, b) => a.price < b.price ? a : b);
      finalAssignments.push({ item, storeId: cheapest.storeId, price: cheapest.price });
    } else {
      const cheapestAllowed = allowedPrices.reduce((a, b) => a.price < b.price ? a : b);
      finalAssignments.push({ item, storeId: cheapestAllowed.storeId, price: cheapestAllowed.price });
    }
  }

  // 5. Build result
  const storeSplit = new Map<number, ShoppingListItem[]>();
  let totalCost = 0;

  for (const { item, storeId, price } of finalAssignments) {
    if (!storeSplit.has(storeId)) storeSplit.set(storeId, []);
    storeSplit.get(storeId)!.push(item);
    totalCost += price * item.quantity;
  }

  // 6. Calculate savings vs single cheapest store for whole basket
  let singleStoreBest = Infinity;
  for (const store of stores) {
    let storeTotal = 0;
    for (const { item } of itemAssignments) {
      const pp = pricesMap.get(item.productId)!;
      const rec = pp.prices.find(p => p.storeId === store.id);
      if (rec) storeTotal += rec.price * item.quantity;
      else storeTotal += Infinity; // store doesn't have this item
    }
    if (storeTotal < singleStoreBest) singleStoreBest = storeTotal;
  }

  return {
    storeSplit,
    totalCost,
    savingsVsSingleStore: isFinite(singleStoreBest) ? singleStoreBest - totalCost : 0,
    storeCount: storeSplit.size,
  };
}
