import { makeAutoObservable } from 'mobx';
import { safeGetItem, safeSetItem } from '../utils/storage';

const SETTINGS_KEY = 'gde-deshevle-settings';

export type ThemeMode = 'light' | 'dark';

interface Settings {
  city: string;
  maxStores: number;
  theme: ThemeMode;
}

export class SettingsStore {
  city = 'spb';
  maxStores = 2;
  theme: ThemeMode = 'dark';

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = safeGetItem(SETTINGS_KEY);
      if (raw) {
        const s: Settings = JSON.parse(raw);
        this.city = s.city || 'spb';
        this.maxStores = s.maxStores || 2;
        this.theme = s.theme || 'dark';
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage() {
    try {
      safeSetItem(SETTINGS_KEY, JSON.stringify({
        city: this.city,
        maxStores: this.maxStores,
        theme: this.theme,
      }));
    } catch {
      // ignore
    }
  }

  setCity(city: string) {
    this.city = city;
    this.saveToStorage();
  }

  setMaxStores(max: number) {
    this.maxStores = Math.max(1, Math.min(3, max));
    this.saveToStorage();
  }

  setTheme(theme: ThemeMode) {
    this.theme = theme;
    this.saveToStorage();
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.saveToStorage();
  }
}
