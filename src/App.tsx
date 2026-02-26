import { MantineProvider, createTheme, MantineColorSchemeManager } from '@mantine/core';
import { observer } from 'mobx-react-lite';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useStore, StoreContext, rootStore } from './stores/RootStore';
import { ShoppingListScreen } from './components/ShoppingList/ShoppingListScreen';
import { CompareScreen } from './components/Compare/CompareScreen';
import { SettingsScreen } from './components/Settings/SettingsScreen';
import { BottomNav } from './components/BottomNav';
import '@mantine/core/styles.css';

const theme = createTheme({
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  primaryColor: 'green',
  colors: {
    green: [
      '#e6fff0', '#b3ffd6', '#80ffbb', '#4dffa1', '#1aff87',
      '#00e66d', '#00b355', '#00803d', '#004d25', '#001a0d',
    ],
  },
  defaultRadius: 'md',
});

// In-memory color scheme manager (avoids localStorage for sandboxed iframes)
const memoryColorSchemeManager: MantineColorSchemeManager = {
  get: () => 'dark',
  set: () => {},
  subscribe: () => {},
  unsubscribe: () => {},
  clear: () => {},
};

const App = observer(() => {
  const store = useStore();
  const colorScheme = store.settings.theme;

  return (
    <MantineProvider
      theme={theme}
      forceColorScheme={colorScheme}
      colorSchemeManager={memoryColorSchemeManager}
    >
      <StoreContext.Provider value={rootStore}>
        <HashRouter>
          <div style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            background: colorScheme === 'dark' ? '#0a0f14' : '#f5f7fa',
          }}>
            <div style={{ flex: 1, paddingBottom: 72, overflowY: 'auto' }}>
              <Routes>
                <Route path="/" element={<ShoppingListScreen />} />
                <Route path="/compare" element={<CompareScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
              </Routes>
            </div>
            <BottomNav />
          </div>
        </HashRouter>
      </StoreContext.Provider>
    </MantineProvider>
  );
});

export default App;
