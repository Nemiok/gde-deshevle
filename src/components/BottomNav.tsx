import { observer } from 'mobx-react-lite';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../stores/RootStore';

const NAV_ITEMS = [
  { path: '/', label: 'Список', icon: '🛒' },
  { path: '/compare', label: 'Цены', icon: '💰' },
  { path: '/settings', label: 'Настройки', icon: '⚙️' },
];

export const BottomNav = observer(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useStore();
  const isDark = store.settings.theme === 'dark';

  const bg = isDark ? '#0d1520' : '#ffffff';
  const border = isDark ? '#1e2d3d' : '#e8ecf0';
  const activeColor = '#00e66d';
  const inactiveColor = isDark ? '#5a7a8a' : '#9aacb8';

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 72,
      background: bg,
      borderTop: `1px solid ${border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV_ITEMS.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 20px',
              color: isActive ? activeColor : inactiveColor,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <span style={{
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              letterSpacing: 0.2,
            }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
});
