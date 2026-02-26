import { ShoppingListItem } from '../../models/ShoppingListItem';

interface Props {
  item: ShoppingListItem;
  isDark: boolean;
  isLast: boolean;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
}

export function ShoppingListItemComponent({ item, isDark, isLast, onRemove, onQuantityChange }: Props) {
  const border = isDark ? '#1e2d3d' : '#e8ecf0';
  const textColor = isDark ? '#e0eaf5' : '#1a2433';
  const subColor = isDark ? '#5a7a8a' : '#9aacb8';
  const accentColor = '#00e66d';
  const btnBg = isDark ? '#0a1520' : '#f0f4f8';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 14px',
      borderBottom: isLast ? 'none' : `1px solid ${border}`,
      gap: 10,
    }}>
      {/* Name + unit */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.name}
        </div>
        <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>{item.unit}</div>
      </div>

      {/* Quantity control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onQuantityChange(item.quantity - 1)}
          style={{
            width: 28, height: 28,
            background: btnBg,
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            color: accentColor,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >−</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: textColor, minWidth: 20, textAlign: 'center' }}>
          {item.quantity}
        </span>
        <button
          onClick={() => onQuantityChange(item.quantity + 1)}
          style={{
            width: 28, height: 28,
            background: btnBg,
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            color: accentColor,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 18,
          color: subColor,
          cursor: 'pointer',
          padding: 4,
        }}
      >✕</button>
    </div>
  );
}
