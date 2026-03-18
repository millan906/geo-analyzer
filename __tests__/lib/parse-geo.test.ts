import {
  parseGeoScore,
  parseSignals,
  getScoreStatus,
  getScoreColor,
} from '@/lib/parse-geo';

const SAMPLE_SIGNALS = `
🟢 Citability        [20/25] — Opens with a direct answer about services
🟡 Entity Clarity    [13/20] — Business name missing from first paragraph
🔴 Factual Density   [8/20] — No specific numbers or credentials mentioned
🟡 Format Quality    [10/15] — Good structure but missing FAQ section
🟢 Topical Authority [8/10] — Comprehensive coverage of the topic
🔴 Schema Health     [0/10] — No structured data detected in content
`;

describe('parseGeoScore', () => {
  it('parses a valid score', () => {
    expect(parseGeoScore('GEO SCORE: 72 / 100')).toBe(72);
  });

  it('parses score with extra whitespace', () => {
    expect(parseGeoScore('GEO SCORE:  85  /  100')).toBe(85);
  });

  it('parses score 0', () => {
    expect(parseGeoScore('GEO SCORE: 0 / 100')).toBe(0);
  });

  it('parses score 100', () => {
    expect(parseGeoScore('GEO SCORE: 100 / 100')).toBe(100);
  });

  it('parses score 80 (green boundary)', () => {
    expect(parseGeoScore('GEO SCORE: 80 / 100')).toBe(80);
  });

  it('parses score 50 (yellow boundary)', () => {
    expect(parseGeoScore('GEO SCORE: 50 / 100')).toBe(50);
  });

  it('returns null for empty string', () => {
    expect(parseGeoScore('')).toBeNull();
  });

  it('returns null when score not yet in stream', () => {
    expect(parseGeoScore('Analyzing your content...')).toBeNull();
  });

  it('finds score embedded in a larger report', () => {
    const report = `━━━━━━━━━━\nGEO SCORE: 63 / 100  🟡 Needs Work\nTarget AI Query: "test"\n━━━━━━━━━━`;
    expect(parseGeoScore(report)).toBe(63);
  });
});

describe('getScoreStatus', () => {
  it('returns GEO Ready for 80+', () => {
    expect(getScoreStatus(80)).toBe('🟢 GEO Ready');
    expect(getScoreStatus(100)).toBe('🟢 GEO Ready');
    expect(getScoreStatus(95)).toBe('🟢 GEO Ready');
  });

  it('returns Needs Work for 50–79', () => {
    expect(getScoreStatus(50)).toBe('🟡 Needs Work');
    expect(getScoreStatus(79)).toBe('🟡 Needs Work');
    expect(getScoreStatus(65)).toBe('🟡 Needs Work');
  });

  it('returns Not Optimized for 0–49', () => {
    expect(getScoreStatus(0)).toBe('🔴 Not Optimized');
    expect(getScoreStatus(49)).toBe('🔴 Not Optimized');
    expect(getScoreStatus(25)).toBe('🔴 Not Optimized');
  });
});

describe('getScoreColor', () => {
  it('returns green for 80+', () => {
    expect(getScoreColor(80)).toBe('green');
    expect(getScoreColor(100)).toBe('green');
  });

  it('returns yellow for 50–79', () => {
    expect(getScoreColor(50)).toBe('yellow');
    expect(getScoreColor(79)).toBe('yellow');
  });

  it('returns red for 0–49', () => {
    expect(getScoreColor(0)).toBe('red');
    expect(getScoreColor(49)).toBe('red');
  });
});

describe('parseSignals', () => {
  it('parses all 6 signals from a full report', () => {
    const signals = parseSignals(SAMPLE_SIGNALS);
    expect(signals).toHaveLength(6);
  });

  it('correctly parses signal names', () => {
    const signals = parseSignals(SAMPLE_SIGNALS);
    const names = signals.map((s) => s.name);
    expect(names).toContain('Citability');
    expect(names).toContain('Entity Clarity');
    expect(names).toContain('Factual Density');
    expect(names).toContain('Format Quality');
    expect(names).toContain('Topical Authority');
    expect(names).toContain('Schema Health');
  });

  it('correctly parses scores and maxScores', () => {
    const signals = parseSignals(SAMPLE_SIGNALS);
    const citability = signals.find((s) => s.name === 'Citability')!;
    expect(citability.score).toBe(20);
    expect(citability.maxScore).toBe(25);

    const schema = signals.find((s) => s.name === 'Schema Health')!;
    expect(schema.score).toBe(0);
    expect(schema.maxScore).toBe(10);
  });

  it('correctly parses emoji indicators', () => {
    const signals = parseSignals(SAMPLE_SIGNALS);
    const citability = signals.find((s) => s.name === 'Citability')!;
    expect(citability.emoji).toBe('🟢');

    const entity = signals.find((s) => s.name === 'Entity Clarity')!;
    expect(entity.emoji).toBe('🟡');

    const factual = signals.find((s) => s.name === 'Factual Density')!;
    expect(factual.emoji).toBe('🔴');
  });

  it('correctly parses finding text', () => {
    const signals = parseSignals(SAMPLE_SIGNALS);
    const citability = signals.find((s) => s.name === 'Citability')!;
    expect(citability.finding).toBe('Opens with a direct answer about services');
  });

  it('returns empty array for empty string', () => {
    expect(parseSignals('')).toEqual([]);
  });

  it('returns empty array when no signals present', () => {
    expect(parseSignals('GEO SCORE: 72 / 100\nSome other text')).toEqual([]);
  });

  it('parses partial signals (stream not complete)', () => {
    const partial = `🟢 Citability        [20/25] — Opens with a direct answer\n🟡 Entity Clarity    [13/20] — Business name missing`;
    const signals = parseSignals(partial);
    expect(signals).toHaveLength(2);
  });
});
