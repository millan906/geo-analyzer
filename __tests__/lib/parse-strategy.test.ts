import {
  parseStrategyCurrentScore,
  parseStrategyQuickWinsCount,
  parseStrategyProjectedScore,
  parseStrategyProjection,
  parseStrategyQuickWins,
  parseStrategy30DayPlan,
  parseStrategySchemaChecklist,
  parseStrategyContentGaps,
} from '@/lib/parse-strategy';

// ── Fixture ───────────────────────────────────────────────────────────────────

const FULL_STRATEGY = `
STRATEGY REPORT
Current GEO Score: 59 / 100
Quick Wins Available: 4
Projected Score After Fixes: 74 / 100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK WINS — This Week
• Add LocalBusiness JSON-LD schema to homepage — ~15min
• Rewrite intro paragraph using BLUF format — ~20min
• Add phone number and address to header — ~5min
• Insert FAQ block with 5 Q&A pairs — ~30min

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

30-DAY ACTION PLAN
Week 1: Schema & Structure
• Install LocalBusiness schema sitewide
• Add FAQPage schema to all service pages
• Fix H1/H2 heading hierarchy

Week 2: Content Depth
• Expand each service page to 600+ words
• Add certifications and years in business
• Include specific pricing ranges

Week 3: Authority Signals
• Respond to all Google reviews
• Add testimonials with full names and locations
• Embed Google review widget

Week 4: Final Audit
• Run GEO Score on all pages
• Validate schema in Rich Results Test
• Submit updated sitemap to GSC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCHEMA CHECKLIST
☐ LocalBusiness — Missing from all pages
☐ FAQPage — Add to each service page
☐ Service — Describe each offered service separately

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTENT GAPS
Missing topics that weaken AI citability:

1. **Pricing Page** — No cost information; AI cannot answer "how much does X cost"
2. **Team/About Page** — No named practitioners; reduces entity authority
3. **FAQ Page** — No dedicated FAQ; misses question-format queries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROJECTED IMPACT
Current GEO Score: 59 / 100
After Quick Wins: 74 / 100
After Full 30-Day Plan: 83 / 100
`;

// ── parseStrategyCurrentScore ─────────────────────────────────────────────────

describe('parseStrategyCurrentScore', () => {
  it('parses current score from full strategy', () => {
    expect(parseStrategyCurrentScore(FULL_STRATEGY)).toBe(59);
  });

  it('parses score from header line', () => {
    expect(parseStrategyCurrentScore('Current GEO Score: 72 / 100')).toBe(72);
  });

  it('returns null for empty string', () => {
    expect(parseStrategyCurrentScore('')).toBeNull();
  });

  it('returns null when no score present', () => {
    expect(parseStrategyCurrentScore('Some strategy text')).toBeNull();
  });
});

// ── parseStrategyQuickWinsCount ───────────────────────────────────────────────

describe('parseStrategyQuickWinsCount', () => {
  it('parses quick wins count', () => {
    expect(parseStrategyQuickWinsCount(FULL_STRATEGY)).toBe(4);
  });

  it('parses from isolated line', () => {
    expect(parseStrategyQuickWinsCount('Quick Wins Available: 7')).toBe(7);
  });

  it('returns null when not present', () => {
    expect(parseStrategyQuickWinsCount('')).toBeNull();
  });
});

// ── parseStrategyProjectedScore ───────────────────────────────────────────────

describe('parseStrategyProjectedScore', () => {
  it('parses projected score', () => {
    expect(parseStrategyProjectedScore(FULL_STRATEGY)).toBe(74);
  });

  it('parses from isolated line', () => {
    expect(parseStrategyProjectedScore('Projected Score After Fixes: 82 / 100')).toBe(82);
  });

  it('returns null when not present', () => {
    expect(parseStrategyProjectedScore('')).toBeNull();
  });
});

// ── parseStrategyProjection ───────────────────────────────────────────────────

describe('parseStrategyProjection', () => {
  it('parses all three projection values', () => {
    const proj = parseStrategyProjection(FULL_STRATEGY);
    expect(proj).not.toBeNull();
    expect(proj!.current).toBe(59);
    expect(proj!.afterQuickWins).toBe(74);
    expect(proj!.afterFullPlan).toBe(83);
  });

  it('returns null when no current score present', () => {
    expect(parseStrategyProjection('')).toBeNull();
  });

  it('returns 0 for afterQuickWins when line missing', () => {
    const proj = parseStrategyProjection('Current GEO Score: 60 / 100');
    expect(proj).not.toBeNull();
    expect(proj!.afterQuickWins).toBe(0);
    expect(proj!.afterFullPlan).toBe(0);
  });
});

// ── parseStrategyQuickWins ────────────────────────────────────────────────────

describe('parseStrategyQuickWins', () => {
  it('parses 4 quick wins from full strategy', () => {
    const wins = parseStrategyQuickWins(FULL_STRATEGY);
    expect(wins).toHaveLength(4);
  });

  it('parses action and time for each win', () => {
    const wins = parseStrategyQuickWins(FULL_STRATEGY);
    expect(wins[0].action).toContain('LocalBusiness');
    expect(wins[0].time).toContain('15min');
  });

  it('returns empty array when section is missing', () => {
    expect(parseStrategyQuickWins('Current GEO Score: 59 / 100')).toEqual([]);
  });
});

// ── parseStrategy30DayPlan ────────────────────────────────────────────────────

describe('parseStrategy30DayPlan', () => {
  it('parses 4 weeks from full strategy', () => {
    const weeks = parseStrategy30DayPlan(FULL_STRATEGY);
    expect(weeks).toHaveLength(4);
  });

  it('parses week titles', () => {
    const weeks = parseStrategy30DayPlan(FULL_STRATEGY);
    expect(weeks[0].title).toBe('Schema & Structure');
    expect(weeks[1].title).toBe('Content Depth');
  });

  it('parses tasks within each week', () => {
    const weeks = parseStrategy30DayPlan(FULL_STRATEGY);
    expect(weeks[0].tasks).toHaveLength(3);
    expect(weeks[0].tasks[0]).toContain('LocalBusiness schema');
  });

  it('returns empty array when section is missing', () => {
    expect(parseStrategy30DayPlan('Some other content')).toEqual([]);
  });
});

// ── parseStrategySchemaChecklist ──────────────────────────────────────────────

describe('parseStrategySchemaChecklist', () => {
  it('parses 3 schema items', () => {
    const items = parseStrategySchemaChecklist(FULL_STRATEGY);
    expect(items).toHaveLength(3);
  });

  it('parses item name and reason', () => {
    const items = parseStrategySchemaChecklist(FULL_STRATEGY);
    expect(items[0].item).toBe('LocalBusiness');
    expect(items[0].reason).toContain('Missing');
  });

  it('returns empty array when section is missing', () => {
    expect(parseStrategySchemaChecklist('')).toEqual([]);
  });
});

// ── parseStrategyContentGaps ──────────────────────────────────────────────────

describe('parseStrategyContentGaps', () => {
  it('parses 3 content gaps', () => {
    const gaps = parseStrategyContentGaps(FULL_STRATEGY);
    expect(gaps).toHaveLength(3);
  });

  it('parses bold title and reason', () => {
    const gaps = parseStrategyContentGaps(FULL_STRATEGY);
    expect(gaps[0].title).toBe('Pricing Page');
    expect(gaps[0].reason).toContain('cost information');
  });

  it('returns empty array when section is missing', () => {
    expect(parseStrategyContentGaps('')).toEqual([]);
  });
});
