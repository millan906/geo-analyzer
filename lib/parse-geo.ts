export interface Signal {
  name: string;
  score: number;
  maxScore: number;
  emoji: '🟢' | '🟡' | '🔴';
  finding: string;
}

export function parseGeoScore(text: string): number | null {
  const match = text.match(/GEO SCORE:\s*(\d+)\s*\/\s*100/);
  return match ? parseInt(match[1], 10) : null;
}

export function getScoreStatus(score: number): string {
  if (score >= 80) return '🟢 GEO Ready';
  if (score >= 50) return '🟡 Needs Work';
  return '🔴 Not Optimized';
}

export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

export function parseSignals(text: string): Signal[] {
  const signals: Signal[] = [];
  const regex =
    /(🟢|🟡|🔴)\s+(Citability|Entity Clarity|Factual Density|Format Quality|Topical Authority|Schema Health)\s+\[(\d+)\/(\d+)\]\s+[—–-]\s+(.+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    signals.push({
      emoji: match[1] as Signal['emoji'],
      name: match[2],
      score: parseInt(match[3], 10),
      maxScore: parseInt(match[4], 10),
      finding: match[5].trim(),
    });
  }
  return signals;
}
