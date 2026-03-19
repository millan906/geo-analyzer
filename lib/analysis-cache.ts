const CACHE_PREFIX = 'geo-report-';
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

export function getCachedReport(url: string): CachedReport | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + normalizeUrl(url));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedReport;
    if (Date.now() - new Date(entry.cachedAt).getTime() > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + normalizeUrl(url));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function setCachedReport(url: string, text: string, provider: string, model: string): void {
  try {
    const entry: CachedReport = { text, provider, model, cachedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_PREFIX + normalizeUrl(url), JSON.stringify(entry));
  } catch {
    // localStorage quota exceeded — skip silently
  }
}

export function bustCache(url: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + normalizeUrl(url));
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
