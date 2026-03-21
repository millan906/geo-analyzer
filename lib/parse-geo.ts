export interface Signal {
  name: string;
  score: number;
  maxScore: number;
  emoji: 'pass' | 'warn' | 'fail';
  finding: string;
}

export function parseGeoScore(text: string): number | null {
  const match = text.match(/GEO SCORE:\s*(\d+)\s*\/\s*100/);
  return match ? parseInt(match[1], 10) : null;
}

export function getScoreStatus(score: number): string {
  if (score >= 80) return 'GEO Ready';
  if (score >= 65) return 'Approaching Citability';
  return 'Not Optimized';
}

export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 65) return 'yellow';
  return 'red';
}

export interface AiAnswerPreview {
  query: string;
  answer: string;
  missing: string;
}

export function parseAiAnswerPreview(text: string): AiAnswerPreview | null {
  const queryMatch = text.match(/If an AI was asked [""](.+?)[""] and read this page/);
  const answerMatch = text.match(/it would likely say:\s*[""](.+?)[""]/s);
  const missingMatch = text.match(/What['']s missing[:\s]+(.+?)(?:\n\n|$)/s);

  if (!queryMatch && !answerMatch) return null;

  return {
    query: queryMatch?.[1]?.trim() ?? '',
    answer: answerMatch?.[1]?.trim() ?? '',
    missing: missingMatch?.[1]?.trim() ?? '',
  };
}

const GEO_SIGNAL_NAMES = [
  'Citability',
  'Entity Clarity',
  'Factual Density',
  'Format Quality',
  'Topical Authority',
  'Schema Health',
];

function normalizeSignalName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return GEO_SIGNAL_NAMES.find((n) => n.toLowerCase() === lower) ?? raw.trim();
}

function toStatus(marker: string): Signal['emoji'] {
  const m = marker.toUpperCase();
  if (m === 'PASS' || marker === '🟢') return 'pass';
  if (m === 'WARN' || marker === '🟡') return 'warn';
  return 'fail';
}

export function parseSignals(text: string): Signal[] {
  const signals: Signal[] = [];

  for (const name of GEO_SIGNAL_NAMES) {
    const escaped = name.replace(/&/g, '\\&');
    // Optional prefix: [PASS/WARN/FAIL], emoji, or plain PASS/WARN/FAIL
    const re = new RegExp(
      `(?:\\[(PASS|WARN|FAIL)\\]|(🟢|🟡|🔴)|(PASS|WARN|FAIL))?\\s*${escaped}\\s*\\[(\\d+)\\/(\\d+)\\]\\s*[—–\\-]+\\s*(.+)`,
      'i'
    );
    const match = text.match(re);
    if (!match) continue;

    const marker = (match[1] ?? match[2] ?? match[3] ?? 'FAIL').toUpperCase();
    signals.push({
      emoji: toStatus(marker),
      name,
      score: parseInt(match[4], 10),
      maxScore: parseInt(match[5], 10),
      finding: match[6].trim(),
    });
  }

  if (signals.length === 0 && process.env.NODE_ENV === 'development') {
    console.log('[parseSignals] No matches. Raw snippet:', text.slice(0, 800));
  }
  return signals;
}
