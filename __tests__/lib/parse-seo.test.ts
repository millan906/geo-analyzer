import {
  parseAuditScore,
  parseAuditSignals,
  getAuditStatus,
  getAuditColor,
  getSeoQuickFixes,
} from '@/lib/parse-seo';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BRACKET_FORMAT = `
[PASS] Title & Meta        [17/20] — Clear H1 with business name and location
[WARN] Heading Structure   [13/20] — H2s present but inconsistent hierarchy
[FAIL] Content Depth       [9/20] — Content too short, under 400 words
[PASS] Social Proof        [12/15] — 47 reviews mentioned with star rating
[WARN] Brand Clarity       [9/15] — Value proposition buried below the fold
[FAIL] CTA & Conversion    [3/10] — No phone number visible, form hard to find
`;

const FULL_SEO_REPORT = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEO SCORE: 63 / 100  [WARN] Needs Improvement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEO SIGNALS
[PASS] Title & Meta        [17/20] — Clear H1 with business name and location
[WARN] Heading Structure   [13/20] — H2s present but inconsistent hierarchy
[FAIL] Content Depth       [9/20] — Content too short, under 400 words
[PASS] Social Proof        [12/15] — 47 reviews mentioned with star rating
[WARN] Brand Clarity       [9/15] — Value proposition buried below the fold
[FAIL] CTA & Conversion    [3/10] — No phone number visible, form hard to find

SEO QUICK FIXES
[CTA & Conversion] Add phone number to header — ~5min
[Content Depth] Expand service descriptions to 600+ words — ~30min
[Heading Structure] Add H3 subheadings inside each H2 section — ~15min
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GEO SCORE: 59 / 100
`;

// ── parseAuditScore ───────────────────────────────────────────────────────────

describe('parseAuditScore', () => {
  it('parses a valid SEO score', () => {
    expect(parseAuditScore('SEO SCORE: 63 / 100')).toBe(63);
  });

  it('parses score with extra whitespace', () => {
    expect(parseAuditScore('SEO SCORE:  78  /  100')).toBe(78);
  });

  it('parses boundary scores', () => {
    expect(parseAuditScore('SEO SCORE: 0 / 100')).toBe(0);
    expect(parseAuditScore('SEO SCORE: 100 / 100')).toBe(100);
    expect(parseAuditScore('SEO SCORE: 75 / 100')).toBe(75);
    expect(parseAuditScore('SEO SCORE: 45 / 100')).toBe(45);
  });

  it('returns null for empty string', () => {
    expect(parseAuditScore('')).toBeNull();
  });

  it('does not match GEO SCORE line', () => {
    expect(parseAuditScore('GEO SCORE: 72 / 100')).toBeNull();
  });

  it('finds score in full report', () => {
    expect(parseAuditScore(FULL_SEO_REPORT)).toBe(63);
  });
});

// ── getAuditStatus ────────────────────────────────────────────────────────────

describe('getAuditStatus', () => {
  it('returns Strong Foundation for 75+', () => {
    expect(getAuditStatus(75)).toBe('Strong Foundation');
    expect(getAuditStatus(100)).toBe('Strong Foundation');
  });

  it('returns Needs Improvement for 45–74', () => {
    expect(getAuditStatus(45)).toBe('Needs Improvement');
    expect(getAuditStatus(74)).toBe('Needs Improvement');
  });

  it('returns Weak Foundation for 0–44', () => {
    expect(getAuditStatus(0)).toBe('Weak Foundation');
    expect(getAuditStatus(44)).toBe('Weak Foundation');
  });
});

// ── getAuditColor ─────────────────────────────────────────────────────────────

describe('getAuditColor', () => {
  it('returns green for 75+', () => {
    expect(getAuditColor(75)).toBe('green');
    expect(getAuditColor(100)).toBe('green');
  });

  it('returns yellow for 45–74', () => {
    expect(getAuditColor(45)).toBe('yellow');
    expect(getAuditColor(74)).toBe('yellow');
  });

  it('returns red for 0–44', () => {
    expect(getAuditColor(0)).toBe('red');
    expect(getAuditColor(44)).toBe('red');
  });
});

// ── parseAuditSignals ─────────────────────────────────────────────────────────

describe('parseAuditSignals — [PASS/WARN/FAIL] format', () => {
  it('parses all 6 SEO signals', () => {
    expect(parseAuditSignals(BRACKET_FORMAT)).toHaveLength(6);
  });

  it('parses all signal names', () => {
    const names = parseAuditSignals(BRACKET_FORMAT).map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Title & Meta',
        'Heading Structure',
        'Content Depth',
        'Social Proof',
        'Brand Clarity',
        'CTA & Conversion',
      ])
    );
  });

  it('maps [PASS] → pass, [WARN] → warn, [FAIL] → fail', () => {
    const signals = parseAuditSignals(BRACKET_FORMAT);
    expect(signals.find((s) => s.name === 'Title & Meta')!.emoji).toBe('pass');
    expect(signals.find((s) => s.name === 'Heading Structure')!.emoji).toBe('warn');
    expect(signals.find((s) => s.name === 'Content Depth')!.emoji).toBe('fail');
  });

  it('parses scores and maxScores', () => {
    const signals = parseAuditSignals(BRACKET_FORMAT);
    const titleMeta = signals.find((s) => s.name === 'Title & Meta')!;
    expect(titleMeta.score).toBe(17);
    expect(titleMeta.maxScore).toBe(20);

    const cta = signals.find((s) => s.name === 'CTA & Conversion')!;
    expect(cta.score).toBe(3);
    expect(cta.maxScore).toBe(10);
  });

  it('parses finding text', () => {
    const signals = parseAuditSignals(BRACKET_FORMAT);
    expect(signals.find((s) => s.name === 'Social Proof')!.finding).toBe(
      '47 reviews mentioned with star rating'
    );
  });

  it('parses from a full realistic report', () => {
    expect(parseAuditSignals(FULL_SEO_REPORT)).toHaveLength(6);
  });
});

describe('parseAuditSignals — edge cases', () => {
  it('returns empty array for empty string', () => {
    expect(parseAuditSignals('')).toEqual([]);
  });

  it('ignores GEO signal names', () => {
    const geoLine = '[PASS] Citability [20/25] — some finding';
    expect(parseAuditSignals(geoLine)).toEqual([]);
  });

  it('handles partial stream with 2 signals', () => {
    const partial = `[PASS] Title & Meta [17/20] — Good title\n[WARN] Heading Structure [13/20] — Inconsistent`;
    expect(parseAuditSignals(partial)).toHaveLength(2);
  });
});

// ── getSeoQuickFixes ──────────────────────────────────────────────────────────

describe('getSeoQuickFixes', () => {
  it('parses signal-labeled quick fixes from full report', () => {
    const fixes = getSeoQuickFixes(FULL_SEO_REPORT);
    expect(fixes['CTA & Conversion']).toContain('phone number');
    expect(fixes['Content Depth']).toContain('600+');
    expect(fixes['Heading Structure']).toContain('H3');
  });

  it('returns empty object when no SEO QUICK FIXES section', () => {
    expect(getSeoQuickFixes('SEO SCORE: 63 / 100')).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(getSeoQuickFixes('')).toEqual({});
  });
});
