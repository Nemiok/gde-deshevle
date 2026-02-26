import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/RootStore';
import { ProductSearchBar } from './ProductSearchBar';
import { ShoppingListItemComponent } from './ShoppingListItem';

export const ShoppingListScreen = observer(() => {
  const store = useStore();
  const isDark = store.settings.theme === 'dark';
  const [showSearch, setShowSearch] = useState(false);

  const bg = isDark ? '#0a0f14' : '#f5f7fa';
  const cardBg = isDark ? '#0d1520' : '#ffffff';
  const border = isDark ? '#1e2d3d' : '#e8ecf0';
  const textColor = isDark ? '#e0eaf5' : '#1a2433';
  const subColor = isDark ? '#5a7a8a' : '#9aacb8';
  const accentColor = '#00e66d';

  // Load prices when items change
  useEffect(() => {
    const ids = store.shoppingList.items.map(i => i.productId);
    if (ids.length > 0) {
      store.prices.fetchPricesForItems(ids);
    }
  }, [store.shoppingList.items.length]);

  return (
    <div style={{ background: bg, minHeight: '100%', padding: '16px 16px 0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textColor }}>Мой список</h1>
          <p style={{ margin: 0, fontSize: 13, color: subColor }}>
            {store.shoppingList.itemCount === 0
              ? 'Пусто — добавь товары'
              : `${store.shoppingList.itemCount} товар${store.shoppingList.itemCount === 1 ? '' : store.shoppingList.itemCount < 5 ? 'а' : 'ов'}`
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {store.shoppingList.itemCount > 0 && (
            <button
              onClick={() => store.shoppingList.clearAll()}
              style={{
                background: 'none',
                border: `1px solid ${border}`,
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 13,
                color: subColor,
                cursor: 'pointer',
              }}
            >
              Очистить
            </button>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{
              background: accentColor,
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#0a0f14',
              cursor: 'pointer',
            }}
          >
            + Добавить
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <ProductSearchBar
          isDark={isDark}
          onAdd={(product) => {
            store.shoppingList.addItem(product);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Empty state */}
      {store.shoppingList.isEmpty && !showSearch && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: subColor,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Список пуст</p>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>Нажми «+ Добавить» чтобы начать</p>
        </div>
      )}

      {/* Items */}
      {!store.shoppingList.isEmpty && (
        <div style={{
          background: cardBg,
          borderRadius: 12,
          border: `1px solid ${border}`,
          overflow: 'hidden',
          marginBottom: 16,
        }}>
          {store.shoppingList.items.map((item, idx) => (
            <ShoppingListItemComponent
              key={item.productId}
              item={item}
              isDark={isDark}
              isLast={idx === store.shoppingList.items.length - 1}
              onRemove={() => store.shoppingList.removeItem(item.productId)}
              onQuantityChange={(q) => store.shoppingList.updateQuantity(item.productId, q)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
