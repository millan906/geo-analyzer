export interface HistoryEntry {
  id: string;
  url: string;
  targetQuery: string;
  score: number;
  signals: Array<{ name: string; score: number; maxScore: number; emoji: string }>;
  analyzedAt: string; // ISO date string
}

const STORAGE_KEY = 'geo-analyzer-history';
const MAX_ENTRIES = 100;

export function saveAnalysis(entry: Omit<HistoryEntry, 'id'>): void {
  const history = loadHistory();
  const newEntry: HistoryEntry = { ...entry, id: Date.now().toString() };
  const updated = [newEntry, ...history].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function getUrlHistory(url: string): HistoryEntry[] {
  return loadHistory().filter((h) => h.url === url);
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
