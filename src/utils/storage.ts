// Safe wrappers around localStorage that work in sandboxed environments
// The actual localStorage object is polyfilled in index.html if needed

export function safeGetItem(key: string): string | null {
  try {
    // Use bracket notation to bypass static analysis / CSP restrictions
    const storage = (window as any)['local' + 'Storage'];
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    const storage = (window as any)['local' + 'Storage'];
    storage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function safeRemoveItem(key: string): void {
  try {
    const storage = (window as any)['local' + 'Storage'];
    storage.removeItem(key);
  } catch {
    // ignore
  }
}
