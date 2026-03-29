type CacheEntry<T> = {
  ts: number;
  data: T;
};

const getStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
};

export const readCache = <T>(key: string, ttlMs: number): T | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.ts !== "number") {
      storage.removeItem(key);
      return null;
    }
    if (ttlMs > 0 && Date.now() - entry.ts > ttlMs) {
      storage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
};

export const writeCache = <T>(key: string, data: T) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    const entry: CacheEntry<T> = { ts: Date.now(), data };
    storage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage failures (quota, private mode, etc.)
  }
};
