export interface AuditSignal {
  name: string;
  score: number;
  maxScore: number;
  emoji: 'pass' | 'warn' | 'fail';
  finding: string;
}

export function parseAuditScore(text: string): number | null {
  const match = text.match(/SEO SCORE:\s*(\d+)\s*\/\s*100/);
  return match ? parseInt(match[1], 10) : null;
}

export function getAuditStatus(score: number): string {
  if (score >= 75) return 'Strong Foundation';
  if (score >= 45) return 'Needs Improvement';
  return 'Weak Foundation';
}

export function getAuditColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 75) return 'green';
  if (score >= 45) return 'yellow';
  return 'red';
}

const SEO_SIGNAL_NAMES = [
  'Title & Meta',
  'Heading Structure',
  'Content Depth',
  'Social Proof',
  'Brand Clarity',
  'CTA & Conversion',
];

function normalizeAuditSignalName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return SEO_SIGNAL_NAMES.find((n) => n.toLowerCase() === lower) ?? raw.trim();
}

function toStatus(marker: string): AuditSignal['emoji'] {
  const m = marker.toUpperCase();
  if (m === 'PASS' || marker === '🟢') return 'pass';
  if (m === 'WARN' || marker === '🟡') return 'warn';
  return 'fail';
}

export function parseAuditSignals(text: string): AuditSignal[] {
  const signals: AuditSignal[] = [];

  for (const name of SEO_SIGNAL_NAMES) {
    // Escape & for regex, anchor on the known signal name
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
    console.log('[parseAuditSignals] No matches. Raw snippet:', text.slice(0, 800));
  }
  return signals;
}

export function getSeoQuickFixes(text: string): Record<string, string> {
  const fixes: Record<string, string> = {};
  const section = text.match(/SEO QUICK FIXES\n([\s\S]*?)(?:━|GEO SCORE)/);
  if (!section) return fixes;
  const lines = section[1].split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match: [Signal Name] fix text — ~time  or  Signal Name: fix text — ~time
    const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s+(.+)/);
    if (bracketMatch) {
      const name = normalizeAuditSignalName(bracketMatch[1]);
      if (name) fixes[name] = bracketMatch[2].trim();
      continue;
    }
    // Fallback: numbered list "1. fix" — skip, can't map to signal
  }
  return fixes;
}
