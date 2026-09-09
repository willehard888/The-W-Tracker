/**
 * Storage that cannot throw. WKWebView throws on `localStorage` access when
 * site data is blocked or evicted; an unguarded read inside a render or an
 * app-shell effect took the whole tree down to the root error boundary, and
 * its Reload button threw again. Every read and write goes through here.
 */
export const readLocal = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

export const writeLocal = (key: string, value: string): boolean => {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
};

export const removeLocal = (key: string): void => {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
};

export const readSession = (key: string): string | null => {
  try { return sessionStorage.getItem(key); } catch { return null; }
};

export const writeSession = (key: string, value: string): boolean => {
  try { sessionStorage.setItem(key, value); return true; } catch { return false; }
};

export const removeSession = (key: string): void => {
  try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
};
