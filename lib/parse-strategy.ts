export interface StrategyProjection {
  current: number;
  afterQuickWins: number;
  afterFullPlan: number;
}

export interface StrategyWeek {
  title: string;
  tasks: string[];
}

export function parseStrategyCurrentScore(text: string): number | null {
  // Matches both header and projection section
  const match = text.match(/Current GEO Score:\s*(\d+)\s*\/\s*100/);
  return match ? parseInt(match[1], 10) : null;
}

export function parseStrategyQuickWinsCount(text: string): number | null {
  const match = text.match(/Quick Wins Available:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function parseStrategyProjectedScore(text: string): number | null {
  const match = text.match(/Projected Score After Fixes:\s*(\d+)\s*\/\s*100/);
  return match ? parseInt(match[1], 10) : null;
}

export function parseStrategyProjection(text: string): StrategyProjection | null {
  const current = text.match(/Current GEO Score:\s*(\d+)\s*\/\s*100/);
  const afterQW = text.match(/After Quick Wins:\s*(\d+)\s*\/\s*100/);
  const afterFull = text.match(/After Full 30-Day Plan:\s*(\d+)\s*\/\s*100/);
  if (!current) return null;
  return {
    current: parseInt(current[1], 10),
    afterQuickWins: afterQW ? parseInt(afterQW[1], 10) : 0,
    afterFullPlan: afterFull ? parseInt(afterFull[1], 10) : 0,
  };
}

export function parseStrategyQuickWins(text: string): { action: string; time: string }[] {
  const sectionMatch = text.match(/QUICK WINS[^\n]*\n([\s\S]*?)(?:━|30-DAY)/);
  if (!sectionMatch) return [];
  return sectionMatch[1]
    .split('\n')
    .filter((l) => l.trim().startsWith('•'))
    .map((line) => {
      const cleaned = line.replace(/^•\s*/, '').trim();
      const timeMatch = cleaned.match(/—\s*(~[\w\s]+)$/);
      return {
        action: cleaned.replace(/\s*—\s*~[\w\s]+$/, '').trim(),
        time: timeMatch ? timeMatch[1] : '',
      };
    });
}

export function parseStrategy30DayPlan(text: string): StrategyWeek[] {
  const sectionMatch = text.match(/30-DAY ACTION PLAN\n([\s\S]*?)(?:━|SCHEMA)/);
  if (!sectionMatch) return [];
  const weeks: StrategyWeek[] = [];
  const weekRegex = /Week\s*\d+:\s*(.+)\n([\s\S]*?)(?=Week\s*\d+:|$)/g;
  let m;
  while ((m = weekRegex.exec(sectionMatch[1])) !== null) {
    const tasks = m[2]
      .split('\n')
      .filter((l) => l.trim().startsWith('•'))
      .map((l) => l.replace(/^•\s*/, '').trim())
      .filter(Boolean);
    weeks.push({ title: m[1].trim(), tasks });
  }
  return weeks;
}

export function parseStrategySchemaChecklist(text: string): { item: string; reason: string }[] {
  const sectionMatch = text.match(/SCHEMA CHECKLIST\n([\s\S]*?)(?:━|CONTENT)/);
  if (!sectionMatch) return [];
  return sectionMatch[1]
    .split('\n')
    .filter((l) => l.trim().startsWith('☐'))
    .map((line) => {
      const cleaned = line.replace(/^☐\s*/, '').trim();
      const dashIdx = cleaned.indexOf(' — ');
      return dashIdx > -1
        ? { item: cleaned.slice(0, dashIdx).trim(), reason: cleaned.slice(dashIdx + 3).trim() }
        : { item: cleaned, reason: '' };
    });
}

export function parseStrategyContentGaps(text: string): { title: string; reason: string }[] {
  const sectionMatch = text.match(/CONTENT GAPS\n[\s\S]*?\n\n([\s\S]*?)(?:━|PROJECTED|$)/);
  if (!sectionMatch) return [];
  return sectionMatch[1]
    .split('\n')
    .filter((l) => /^\d+\./.test(l.trim()))
    .map((line) => {
      const cleaned = line.replace(/^\d+\.\s*/, '').trim();
      const boldMatch = cleaned.match(/^\*\*(.+?)\*\*\s*—\s*(.+)$/);
      return boldMatch
        ? { title: boldMatch[1].trim(), reason: boldMatch[2].trim() }
        : { title: cleaned, reason: '' };
    });
}
