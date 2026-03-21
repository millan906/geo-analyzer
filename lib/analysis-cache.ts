const CACHE_PREFIX = 'geo-cache-';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedReport {
  text: string;
  provider: string;
  model: string;
  cachedAt: string;
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().trim().replace(/\/$/, '');
}

/** Build a stable cache key for each tab */
export function cacheKey(tab: string, ...parts: string[]): string {
  return [tab, ...parts.map((p) => normalizeUrl(p))].filter(Boolean).join('::');
}

function storageKey(key: string): string {
  return CACHE_PREFIX + key;
}

export function getCachedReport(key: string): CachedReport | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedReport;
    if (Date.now() - new Date(entry.cachedAt).getTime() > CACHE_TTL) {
      localStorage.removeItem(storageKey(key));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function setCachedReport(key: string, text: string, provider: string, model: string): void {
  try {
    const entry: CachedReport = { text, provider, model, cachedAt: new Date().toISOString() };
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // localStorage quota exceeded — skip silently
  }
}

export function bustCache(key: string): void {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {}
}

export function cacheAgeLabel(cachedAt: string): string {
  const ms = Date.now() - new Date(cachedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
