import { useState, useEffect, useRef } from 'react';
import { Product } from '../../models/Product';
import { searchProducts } from '../../api/pricesApi';

interface Props {
  isDark: boolean;
  onAdd: (product: Product) => void;
  onClose: () => void;
}

export function ProductSearchBar({ isDark, onAdd, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bg = isDark ? '#0d1520' : '#ffffff';
  const inputBg = isDark ? '#111c2a' : '#f0f4f8';
  const border = isDark ? '#1e2d3d' : '#e8ecf0';
  const textColor = isDark ? '#e0eaf5' : '#1a2433';
  const subColor = isDark ? '#5a7a8a' : '#9aacb8';
  const accentColor = '#00e66d';
  const hoverBg = isDark ? '#142030' : '#f0f4f8';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await searchProducts(query);
      setResults(res);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск товара..."
          style={{
            flex: 1,
            background: inputBg,
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 15,
            color: textColor,
            outline: 'none',
          }}
        />
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 20,
            color: subColor,
            cursor: 'pointer',
            padding: 4,
          }}
        >✕</button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ padding: '8px 12px 12px', textAlign: 'center' }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {results.map(product => (
            <div
              key={product.id}
              onClick={() => { onAdd(product); setQuery(''); setResults([]); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                cursor: 'pointer',
                borderTop: `1px solid ${border}`,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontSize: 14, color: textColor, fontWeight: 500 }}>{product.normalizedName}</div>
                <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>{product.category} · {product.unit}</div>
              </div>
              <span style={{ color: accentColor, fontSize: 20, fontWeight: 300 }}>+</span>
            </div>
          ))}
        </div>
      )}

      {!loading && query.length >= 1 && results.length === 0 && (
        <div style={{ padding: '10px 14px 14px', textAlign: 'center', color: subColor, fontSize: 14 }}>
          Ничего не найдено
        </div>
      )}

      {!loading && query.length === 0 && (
        <div style={{ padding: '4px 14px 12px' }}>
          <div style={{ fontSize: 12, color: subColor, marginBottom: 8 }}>Популярное:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Молоко', 'Хлеб', 'Яйца', 'Курица', 'Гречка'].map(hint => (
              <button
                key={hint}
                onClick={() => setQuery(hint)}
                style={{
                  background: inputBg,
                  border: `1px solid ${border}`,
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontSize: 13,
                  color: textColor,
                  cursor: 'pointer',
                }}
              >{hint}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
