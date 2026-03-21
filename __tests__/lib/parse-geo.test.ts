import {
  parseGeoScore,
  parseSignals,
  getScoreStatus,
  getScoreColor,
  parseAiAnswerPreview,
} from '@/lib/parse-geo';

// ── Fixtures ────────────────────────────────────────────────────────────────

const BRACKET_FORMAT = `
[PASS] Citability        [20/25] — Opens with a direct answer about services
[WARN] Entity Clarity    [13/20] — Business name missing from first paragraph
[FAIL] Factual Density   [8/20] — No specific numbers or credentials mentioned
[WARN] Format Quality    [10/15] — Good structure but missing FAQ section
[PASS] Topical Authority [8/10] — Comprehensive coverage of the topic
[FAIL] Schema Health     [0/10] — No structured data detected in content
`;

const EMOJI_FORMAT = `
🟢 Citability        [20/25] — Opens with a direct answer about services
🟡 Entity Clarity    [13/20] — Business name missing from first paragraph
🔴 Factual Density   [8/20] — No specific numbers or credentials mentioned
🟡 Format Quality    [10/15] — Good structure but missing FAQ section
🟢 Topical Authority [8/10] — Comprehensive coverage of the topic
🔴 Schema Health     [0/10] — No structured data detected in content
`;

const FULL_REPORT = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEO SCORE: 59 / 100  [WARN] Approaching Citability
Target AI Query: "best dental clinic in Cebu"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SIGNAL BREAKDOWN
[PASS] Citability        [20/25] — Strong BLUF intro with direct answer
[WARN] Entity Clarity    [13/20] — Business name missing from opening paragraph
[FAIL] Factual Density   [8/20] — No certifications, stats, or years mentioned
[WARN] Format Quality    [10/15] — Good H2 structure but no FAQ block
[PASS] Topical Authority [8/10] — Covers topic well
[FAIL] Schema Health     [0/10] — No JSON-LD detected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI ANSWER PREVIEW
If an AI was asked "best dental clinic in Cebu" and read this page, it would likely say:
"Smith Dental provides professional dental services in Cebu City, offering cleanings and orthodontics."

What's missing: Specific years in business, certifications, and patient review numbers would strengthen the answer.
`;

// ── parseGeoScore ────────────────────────────────────────────────────────────

describe('parseGeoScore', () => {
  it('parses a valid score', () => {
    expect(parseGeoScore('GEO SCORE: 72 / 100')).toBe(72);
  });

  it('parses score with extra whitespace', () => {
    expect(parseGeoScore('GEO SCORE:  85  /  100')).toBe(85);
  });

  it('parses boundary scores', () => {
    expect(parseGeoScore('GEO SCORE: 0 / 100')).toBe(0);
    expect(parseGeoScore('GEO SCORE: 100 / 100')).toBe(100);
    expect(parseGeoScore('GEO SCORE: 80 / 100')).toBe(80);
    expect(parseGeoScore('GEO SCORE: 65 / 100')).toBe(65);
  });

  it('returns null for empty string', () => {
    expect(parseGeoScore('')).toBeNull();
  });

  it('returns null when score not yet in stream', () => {
    expect(parseGeoScore('Analyzing your content...')).toBeNull();
  });

  it('finds score embedded in a larger report', () => {
    expect(parseGeoScore(FULL_REPORT)).toBe(59);
  });
});

// ── getScoreStatus ────────────────────────────────────────────────────────────

describe('getScoreStatus', () => {
  it('returns GEO Ready for 80+', () => {
    expect(getScoreStatus(80)).toBe('GEO Ready');
    expect(getScoreStatus(100)).toBe('GEO Ready');
    expect(getScoreStatus(95)).toBe('GEO Ready');
  });

  it('returns Approaching Citability for 65–79', () => {
    expect(getScoreStatus(65)).toBe('Approaching Citability');
    expect(getScoreStatus(79)).toBe('Approaching Citability');
    expect(getScoreStatus(72)).toBe('Approaching Citability');
  });

  it('returns Not Optimized for 0–64', () => {
    expect(getScoreStatus(0)).toBe('Not Optimized');
    expect(getScoreStatus(64)).toBe('Not Optimized');
    expect(getScoreStatus(50)).toBe('Not Optimized');
  });
});

// ── getScoreColor ─────────────────────────────────────────────────────────────

describe('getScoreColor', () => {
  it('returns green for 80+', () => {
    expect(getScoreColor(80)).toBe('green');
    expect(getScoreColor(100)).toBe('green');
  });

  it('returns yellow for 65–79', () => {
    expect(getScoreColor(65)).toBe('yellow');
    expect(getScoreColor(79)).toBe('yellow');
  });

  it('returns red for 0–64', () => {
    expect(getScoreColor(0)).toBe('red');
    expect(getScoreColor(64)).toBe('red');
  });
});

// ── parseSignals ─────────────────────────────────────────────────────────────

describe('parseSignals — [PASS/WARN/FAIL] format', () => {
  it('parses all 6 signals', () => {
    expect(parseSignals(BRACKET_FORMAT)).toHaveLength(6);
  });

  it('parses all signal names', () => {
    const names = parseSignals(BRACKET_FORMAT).map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Citability',
        'Entity Clarity',
        'Factual Density',
        'Format Quality',
        'Topical Authority',
        'Schema Health',
      ])
    );
  });

  it('maps [PASS] → pass, [WARN] → warn, [FAIL] → fail', () => {
    const signals = parseSignals(BRACKET_FORMAT);
    expect(signals.find((s) => s.name === 'Citability')!.emoji).toBe('pass');
    expect(signals.find((s) => s.name === 'Entity Clarity')!.emoji).toBe('warn');
    expect(signals.find((s) => s.name === 'Factual Density')!.emoji).toBe('fail');
  });

  it('parses scores correctly', () => {
    const signals = parseSignals(BRACKET_FORMAT);
    const citability = signals.find((s) => s.name === 'Citability')!;
    expect(citability.score).toBe(20);
    expect(citability.maxScore).toBe(25);

    const schema = signals.find((s) => s.name === 'Schema Health')!;
    expect(schema.score).toBe(0);
    expect(schema.maxScore).toBe(10);
  });

  it('parses finding text', () => {
    const signals = parseSignals(BRACKET_FORMAT);
    const citability = signals.find((s) => s.name === 'Citability')!;
    expect(citability.finding).toBe('Opens with a direct answer about services');
  });

  it('parses from a full realistic report', () => {
    const signals = parseSignals(FULL_REPORT);
    expect(signals).toHaveLength(6);
  });
});

describe('parseSignals — legacy emoji format (fallback)', () => {
  it('parses all 6 signals from emoji format', () => {
    expect(parseSignals(EMOJI_FORMAT)).toHaveLength(6);
  });

  it('maps 🟢 → pass, 🟡 → warn, 🔴 → fail', () => {
    const signals = parseSignals(EMOJI_FORMAT);
    expect(signals.find((s) => s.name === 'Citability')!.emoji).toBe('pass');
    expect(signals.find((s) => s.name === 'Entity Clarity')!.emoji).toBe('warn');
    expect(signals.find((s) => s.name === 'Factual Density')!.emoji).toBe('fail');
  });
});

describe('parseSignals — edge cases', () => {
  it('returns empty array for empty string', () => {
    expect(parseSignals('')).toEqual([]);
  });

  it('returns empty array when no signals present', () => {
    expect(parseSignals('GEO SCORE: 72 / 100\nSome other text')).toEqual([]);
  });

  it('ignores unknown signal names', () => {
    const text = '[PASS] Unknown Signal [10/10] — some finding';
    expect(parseSignals(text)).toEqual([]);
  });

  it('parses partial signals during streaming', () => {
    const partial = `[PASS] Citability [20/25] — Direct answer\n[WARN] Entity Clarity [13/20] — Name missing`;
    expect(parseSignals(partial)).toHaveLength(2);
  });

  it('handles em-dash, en-dash, and hyphen separators', () => {
    const withHyphen = '[PASS] Citability [20/25] - Direct answer';
    const withEnDash = '[PASS] Citability [20/25] – Direct answer';
    const withEmDash = '[PASS] Citability [20/25] — Direct answer';
    expect(parseSignals(withHyphen)).toHaveLength(1);
    expect(parseSignals(withEnDash)).toHaveLength(1);
    expect(parseSignals(withEmDash)).toHaveLength(1);
  });
});

// ── parseAiAnswerPreview ──────────────────────────────────────────────────────

describe('parseAiAnswerPreview', () => {
  it('parses query, answer, and missing from full report', () => {
    const preview = parseAiAnswerPreview(FULL_REPORT);
    expect(preview).not.toBeNull();
    expect(preview!.query).toBe('best dental clinic in Cebu');
    expect(preview!.answer).toContain('Smith Dental');
    expect(preview!.missing).toContain('certifications');
  });

  it('returns null for empty string', () => {
    expect(parseAiAnswerPreview('')).toBeNull();
  });

  it('returns null when no preview section exists', () => {
    expect(parseAiAnswerPreview('GEO SCORE: 72 / 100')).toBeNull();
  });
});
