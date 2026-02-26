import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/RootStore';

export const SettingsScreen = observer(() => {
  const store = useStore();
  const isDark = store.settings.theme === 'dark';

  const bg = isDark ? '#0a0f14' : '#f5f7fa';
  const cardBg = isDark ? '#0d1520' : '#ffffff';
  const border = isDark ? '#1e2d3d' : '#e8ecf0';
  const textColor = isDark ? '#e0eaf5' : '#1a2433';
  const subColor = isDark ? '#5a7a8a' : '#9aacb8';
  const accentColor = '#00e66d';

  return (
    <div style={{ background: bg, minHeight: '100%', padding: '16px' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: textColor }}>Настройки</h1>

      {/* Theme */}
      <div style={{
        background: cardBg,
        borderRadius: 12,
        border: `1px solid ${border}`,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>Тема</div>
            <div style={{ fontSize: 13, color: subColor, marginTop: 2 }}>Тёмная или светлая</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => store.settings.setTheme(t)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid ${store.settings.theme === t ? accentColor : border}`,
                  background: store.settings.theme === t ? 'rgba(0,230,109,0.12)' : 'transparent',
                  color: store.settings.theme === t ? accentColor : subColor,
                  fontSize: 13,
                  fontWeight: store.settings.theme === t ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {t === 'dark' ? '🌙 Тёмная' : '☀️ Светлая'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Max stores */}
      <div style={{
        background: cardBg,
        borderRadius: 12,
        border: `1px solid ${border}`,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>Магазинов в маршруте</div>
            <div style={{ fontSize: 13, color: subColor, marginTop: 2 }}>Сколько магазинов обойти</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => store.settings.setMaxStores(n)}
                style={{
                  width: 36, height: 36,
                  borderRadius: 8,
                  border: `1px solid ${store.settings.maxStores === n ? accentColor : border}`,
                  background: store.settings.maxStores === n ? 'rgba(0,230,109,0.12)' : 'transparent',
                  color: store.settings.maxStores === n ? accentColor : subColor,
                  fontSize: 15,
                  fontWeight: store.settings.maxStores === n ? 700 : 400,
                  cursor: 'pointer',
                }}
              >{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* About */}
      <div style={{
        background: cardBg,
        borderRadius: 12,
        border: `1px solid ${border}`,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: textColor, marginBottom: 8 }}>О приложении</div>
          <div style={{ fontSize: 13, color: subColor, lineHeight: 1.6 }}>
            ГдеДешевле помогает сравнить цены на продукты в магазинах Санкт-Петербурга.
            Умная разбивка подскажет оптимальный маршрут покупок.
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12, color: subColor }}>
              <span style={{ color: textColor }}>Магазины:</span> Пятёрочка, Магнит, Лента, Перекрёсток, ВкусВилл
            </div>
            <div style={{ fontSize: 12, color: subColor }}>
              <span style={{ color: textColor }}>Стек:</span> React 19, TypeScript, MobX, Mantine, Vite
            </div>
            <div style={{ fontSize: 12, color: subColor }}>
              <span style={{ color: textColor }}>Версия:</span> 0.0.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
