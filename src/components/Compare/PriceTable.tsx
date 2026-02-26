import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/RootStore';
import { STORES } from '../../api/pricesApi';

interface Props {
  isDark: boolean;
}

export const PriceTable = observer(({ isDark }: Props) => {
  const store = useStore();

  const cardBg = isDark ? '#0d1520' : '#ffffff';
  const border = isDark ? '#1e2d3d' : '#e8ecf0';
  const textColor = isDark ? '#e0eaf5' : '#1a2433';
  const subColor = isDark ? '#5a7a8a' : '#9aacb8';
  const headerBg = isDark ? '#0a1520' : '#f8fafc';
  const cheapestColor = '#00e66d';
  const cheapestBg = isDark ? 'rgba(0,230,109,0.08)' : 'rgba(0,230,109,0.1)';
  const missingColor = isDark ? '#2a3d4d' : '#d0d8e0';

  const items = store.shoppingList.items;

  // Compute per-item cheapest store
  const cheapestStore = new Map<number, number>(); // productId -> storeId
  for (const item of items) {
    const pp = store.prices.pricesMap.get(item.productId);
    if (!pp || pp.prices.length === 0) continue;
    const cheapest = pp.prices.reduce((a, b) => a.price < b.price ? a : b);
    cheapestStore.set(item.productId, cheapest.storeId);
  }

  // Compute column totals
  const columnTotals = new Map<number, number>();
  for (const storeInfo of STORES) {
    let total = 0;
    let allAvailable = true;
    for (const item of items) {
      const price = store.prices.getPrice(item.productId, storeInfo.id);
      if (price === null) { allAvailable = false; break; }
      total += price * item.quantity;
    }
    if (allAvailable) columnTotals.set(storeInfo.id, total);
  }

  const cheapestTotal = columnTotals.size > 0
    ? Math.min(...columnTotals.values())
    : null;

  return (
    <div style={{
      background: cardBg,
      borderRadius: 12,
      border: `1px solid ${border}`,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: headerBg }}>
              <th style={{
                padding: '10px 14px',
                textAlign: 'left',
                color: subColor,
                fontWeight: 500,
                borderBottom: `1px solid ${border}`,
                minWidth: 140,
                position: 'sticky',
                left: 0,
                background: headerBg,
                zIndex: 1,
              }}>Товар</th>
              {STORES.map(s => (
                <th key={s.id} style={{
                  padding: '10px 10px',
                  textAlign: 'center',
                  borderBottom: `1px solid ${border}`,
                  minWidth: 85,
                }}>
                  <div style={{ color: s.color, fontWeight: 700, fontSize: 12 }}>{s.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isLast = idx === items.length - 1;
              const cheapStoreId = cheapestStore.get(item.productId);
              return (
                <tr key={item.productId}>
                  <td style={{
                    padding: '10px 14px',
                    borderBottom: isLast ? 'none' : `1px solid ${border}`,
                    color: textColor,
                    position: 'sticky',
                    left: 0,
                    background: cardBg,
                    zIndex: 1,
                  }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                    {item.quantity > 1 && (
                      <div style={{ fontSize: 11, color: subColor }}>×{item.quantity}</div>
                    )}
                  </td>
                  {STORES.map(s => {
                    const price = store.prices.getPrice(item.productId, s.id);
                    const isCheapest = price !== null && cheapStoreId === s.id;
                    return (
                      <td key={s.id} style={{
                        padding: '10px 10px',
                        textAlign: 'center',
                        borderBottom: isLast ? 'none' : `1px solid ${border}`,
                        background: isCheapest ? cheapestBg : 'transparent',
                        color: isCheapest ? cheapestColor : price !== null ? textColor : missingColor,
                        fontWeight: isCheapest ? 700 : 400,
                      }}>
                        {price !== null
                          ? `${(price * item.quantity).toFixed(0)} ₽`
                          : '—'
                        }
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Totals row */}
            {columnTotals.size > 0 && (
              <tr style={{ background: headerBg }}>
                <td style={{
                  padding: '10px 14px',
                  fontWeight: 700,
                  color: subColor,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  position: 'sticky',
                  left: 0,
                  background: headerBg,
                  zIndex: 1,
                }}>Итого</td>
                {STORES.map(s => {
                  const total = columnTotals.get(s.id);
                  const isBest = total !== undefined && cheapestTotal !== null && total === cheapestTotal;
                  return (
                    <td key={s.id} style={{
                      padding: '10px 10px',
                      textAlign: 'center',
                      color: isBest ? cheapestColor : total !== undefined ? textColor : missingColor,
                      fontWeight: isBest ? 700 : 500,
                      background: isBest ? cheapestBg : 'transparent',
                    }}>
                      {total !== undefined ? `${total.toFixed(0)} ₽` : '—'}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
