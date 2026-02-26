import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/RootStore';
import { PriceTable } from './PriceTable';
import { SmartSplitCard } from './SmartSplitCard';

export const CompareScreen = observer(() => {
  const store = useStore();
  const isDark = store.settings.theme === 'dark';

  const bg = isDark ? '#0a0f14' : '#f5f7fa';
  const textColor = isDark ? '#e0eaf5' : '#1a2433';
  const subColor = isDark ? '#5a7a8a' : '#9aacb8';

  useEffect(() => {
    const ids = store.shoppingList.items.map(i => i.productId);
    if (ids.length > 0) {
      store.prices.fetchPricesForItems(ids);
    }
  }, [store.shoppingList.items.length]);

  if (store.shoppingList.isEmpty) {
    return (
      <div style={{ background: bg, minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 40, color: subColor }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: textColor }}>Список пуст</p>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>Добавь товары в список чтобы сравнить цены</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100%', padding: '16px 16px 0' }}>
      <h1 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700, color: textColor }}>Сравнение цен</h1>

      {store.prices.loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" />
          <p style={{ color: subColor, marginTop: 12 }}>Загружаем цены...</p>
        </div>
      )}

      {!store.prices.loading && (
        <>
          <SmartSplitCard isDark={isDark} />
          <PriceTable isDark={isDark} />
        </>
      )}
    </div>
  );
});
