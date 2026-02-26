import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/RootStore';
import { STORES } from '../../api/pricesApi';

interface Props {
  isDark: boolean;
}

export const SmartSplitCard = observer(({ isDark }: Props) => {
  const store = useStore();
  const split = store.optimizer.bestSplit;

  const cardBg = isDark ? '#0d1520' : '#ffffff';
  const border = isDark ? '#1e2d3d' : '#e8ecf0';
  const textColor = isDark ? '#e0eaf5' : '#1a2433';
  const subColor = isDark ? '#5a7a8a' : '#9aacb8';
  const accentColor = '#00e66d';
  const accentBg = isDark ? 'rgba(0,230,109,0.08)' : 'rgba(0,230,109,0.08)';

  if (!split) return null;

  const storeEntries = [...split.storeSplit.entries()];

  return (
    <div style={{
      background: cardBg,
      borderRadius: 12,
      border: `1px solid ${border}`,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        background: accentBg,
        borderBottom: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: accentColor }}>Умная разбивка</div>
          <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
            {split.storeCount} магазин{split.storeCount === 1 ? '' : split.storeCount < 5 ? 'а' : 'ов'} · экономия {split.savingsVsSingleStore.toFixed(0)} ₽
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: accentColor }}>{split.totalCost.toFixed(0)} ₽</div>
          <div style={{ fontSize: 11, color: subColor }}>итого</div>
        </div>
      </div>

      {/* Store splits */}
      <div style={{ padding: '8px 0' }}>
        {storeEntries.map(([storeId, items]) => {
          const storeInfo = STORES.find(s => s.id === storeId);
          if (!storeInfo) return null;
          return (
            <div key={storeId} style={{
              padding: '8px 14px',
              borderBottom: `1px solid ${border}`,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: storeInfo.color }}>{storeInfo.name}</span>
                <span style={{ fontSize: 12, color: subColor }}>{items.length} товар{items.length === 1 ? '' : items.length < 5 ? 'а' : 'ов'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {items.map(item => (
                  <span key={item.productId} style={{
                    background: isDark ? '#0a1520' : '#f0f4f8',
                    border: `1px solid ${border}`,
                    borderRadius: 12,
                    padding: '2px 8px',
                    fontSize: 12,
                    color: textColor,
                  }}>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
