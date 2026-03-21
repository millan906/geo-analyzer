'use client';

import { useState } from 'react';

interface SeoMetrics {
  domainAuthority: string;
  pageAuthority: string;
  googlePosition: string;
  rankingKeywords: string;
  top3Keywords: string;
  monthlyTraffic: string;
  backlinks: string;
  spamScore: string;
}

interface SeoComparisonProps {
  geoScore: number;
  signals: Array<{ name: string; score: number; maxScore: number; emoji: string }>;
}

function getStatus(value: number, thresholds: [number, number]): 'green' | 'yellow' | 'red' {
  if (value >= thresholds[1]) return 'green';
  if (value >= thresholds[0]) return 'yellow';
  return 'red';
}

function StatusDot({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const colors = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

function MetricRow({
  label,
  value,
  status,
  hint,
}: {
  label: string;
  value: string;
  status: 'green' | 'yellow' | 'red';
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-xs font-bold text-gray-900">{value || '—'}</span>
        {value && <p className="text-[10px] text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}

function generateVerdict(
  metrics: SeoMetrics,
  geoScore: number,
  signals: SeoComparisonProps['signals']
): string {
  const da = parseInt(metrics.domainAuthority) || 0;
  const pa = parseInt(metrics.pageAuthority) || 0;
  const pos = parseInt(metrics.googlePosition) || 0;
  const rankingKw = parseInt(metrics.rankingKeywords) || 0;
  const top3Kw = parseInt(metrics.top3Keywords) || 0;
  const spam = parseFloat(metrics.spamScore) || 0;
  const backlinks = parseInt(metrics.backlinks) || 0;

  const hasGoodSeo = da >= 40 || (pos > 0 && pos <= 10) || rankingKw >= 1000;
  const hasWeakGeo = geoScore < 60;
  const hasMidGeo = geoScore >= 60 && geoScore < 80;
  const hasStrongGeo = geoScore >= 80;

  // Find weakest GEO signals
  const weakSignals = signals
    .filter((s) => s.emoji === 'fail' || s.emoji === 'warn')
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)
    .slice(0, 2)
    .map((s) => s.name);

  const weakSignalText =
    weakSignals.length > 0 ? ` Priority fixes: ${weakSignals.join(' and ')}.` : '';

  // Spam warning
  const spamWarning =
    spam >= 10 ? ` ⚠️ Spam score of ${spam}% is elevated — clean up low-quality backlinks.` : '';

  // Top 3 keywords insight
  const top3Insight =
    top3Kw >= 500
      ? ` With ${top3Kw.toLocaleString()} keywords in top 3 positions, you have strong search visibility — but AI engines use conversational queries, not keyword rankings.`
      : top3Kw > 0
        ? ` Only ${top3Kw.toLocaleString()} keywords rank in top 3 — both traditional SEO and GEO content depth need work.`
        : '';

  if (hasGoodSeo && hasWeakGeo) {
    return `Strong traditional SEO (DA ${da}${rankingKw ? `, ${rankingKw.toLocaleString()} ranking keywords` : ''}${pos ? `, position #${pos}` : ''}) but weak AI visibility (GEO ${geoScore}/100). You're findable on Google but AI engines are likely citing competitors instead.${top3Insight}${weakSignalText}${spamWarning}`;
  }
  if (hasGoodSeo && hasMidGeo) {
    return `Solid traditional SEO (DA ${da}${rankingKw ? `, ${rankingKw.toLocaleString()} ranking keywords` : ''}) with a GEO score of ${geoScore}/100 — you're close but not fully AI-ready. A few targeted fixes could push you into the citation zone.${top3Insight}${weakSignalText}${spamWarning}`;
  }
  if (hasGoodSeo && hasStrongGeo) {
    return `Excellent across both channels — DA ${da}${rankingKw ? `, ${rankingKw.toLocaleString()} ranking keywords` : ''} and GEO score ${geoScore}/100. You're well-positioned for both Google rankings and AI-generated answers.${top3Insight}${spamWarning} Keep monitoring as AI citation patterns evolve.`;
  }
  if (!hasGoodSeo && hasStrongGeo) {
    return `Strong GEO score (${geoScore}/100) but traditional SEO lags (DA ${da || '?'}${rankingKw ? `, ${rankingKw.toLocaleString()} ranking keywords` : ''}). You may appear in AI answers but miss organic Google traffic. Invest in backlinks and on-page SEO in parallel.${spamWarning}`;
  }
  if (!hasGoodSeo && hasMidGeo) {
    return `Both traditional SEO and GEO need work. GEO score ${geoScore}/100 means you're partially visible to AI engines, but not enough to be cited consistently.${weakSignalText} On the SEO side, focus on building quality backlinks to raise DA above 30.${spamWarning}`;
  }
  return `Both traditional SEO and GEO need significant improvement. Start with GEO Quick Wins above — fixes like BLUF intro, FAQ blocks, and schema markup also boost traditional SEO signals simultaneously.${weakSignalText}${spamWarning}`;
}

const INSTRUCTIONS = [
  {
    label: 'Domain Authority (DA)',
    key: 'domainAuthority' as keyof SeoMetrics,
    placeholder: 'e.g. 44',
    where: 'moz.com/domain-analysis → enter your domain',
    thresholds: [30, 50] as [number, number],
    hint: (v: string) => (parseInt(v) >= 50 ? 'Strong' : parseInt(v) >= 30 ? 'Moderate' : 'Low'),
  },
  {
    label: 'Page Authority (PA)',
    key: 'pageAuthority' as keyof SeoMetrics,
    placeholder: 'e.g. 48',
    where: 'moz.com/domain-analysis → Top Pages by Links',
    thresholds: [20, 40] as [number, number],
    hint: (v: string) => (parseInt(v) >= 40 ? 'Strong' : parseInt(v) >= 20 ? 'Moderate' : 'Low'),
  },
  {
    label: 'Google Position',
    key: 'googlePosition' as keyof SeoMetrics,
    placeholder: 'e.g. 8',
    where: 'Google Search Console → Performance → Queries',
    thresholds: [20, 10] as [number, number],
    hint: (v: string) => {
      const n = parseInt(v);
      return n <= 3 ? 'Top 3' : n <= 10 ? 'Page 1' : n <= 20 ? 'Page 2' : 'Page 3+';
    },
  },
  {
    label: 'Ranking Keywords',
    key: 'rankingKeywords' as keyof SeoMetrics,
    placeholder: 'e.g. 13600',
    where: 'moz.com/domain-analysis → Ranking Keywords',
    thresholds: [500, 5000] as [number, number],
    hint: (v: string) => (parseInt(v) >= 5000 ? 'High' : parseInt(v) >= 500 ? 'Moderate' : 'Low'),
  },
  {
    label: 'Keywords in Top 3',
    key: 'top3Keywords' as keyof SeoMetrics,
    placeholder: 'e.g. 1000',
    where: 'moz.com/domain-analysis → Keyword Ranking Distribution → #1-3',
    thresholds: [100, 500] as [number, number],
    hint: (v: string) => (parseInt(v) >= 500 ? 'Strong' : parseInt(v) >= 100 ? 'Moderate' : 'Few'),
  },
  {
    label: 'Monthly Traffic',
    key: 'monthlyTraffic' as keyof SeoMetrics,
    placeholder: 'e.g. 850',
    where: 'Google Search Console → Performance → Total clicks',
    thresholds: [100, 1000] as [number, number],
    hint: (v: string) => (parseInt(v) >= 1000 ? 'High' : parseInt(v) >= 100 ? 'Moderate' : 'Low'),
  },
  {
    label: 'Linking Domains',
    key: 'backlinks' as keyof SeoMetrics,
    placeholder: 'e.g. 4900',
    where: 'moz.com/domain-analysis → Linking Root Domains',
    thresholds: [100, 1000] as [number, number],
    hint: (v: string) => (parseInt(v) >= 1000 ? 'Strong' : parseInt(v) >= 100 ? 'Moderate' : 'Few'),
  },
  {
    label: 'Spam Score %',
    key: 'spamScore' as keyof SeoMetrics,
    placeholder: 'e.g. 1',
    where: 'moz.com/domain-analysis → Spam Score',
    thresholds: [10, 2] as [number, number], // lower is better — handled specially
    hint: (v: string) =>
      parseFloat(v) <= 2 ? 'Clean' : parseFloat(v) <= 10 ? 'Watch' : 'High risk',
  },
];

export function SeoComparison({ geoScore, signals }: SeoComparisonProps) {
  const [open, setOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [metrics, setMetrics] = useState<SeoMetrics>({
    domainAuthority: '',
    pageAuthority: '',
    googlePosition: '',
    rankingKeywords: '',
    top3Keywords: '',
    monthlyTraffic: '',
    backlinks: '',
    spamScore: '',
  });

  const hasAnyMetric = Object.values(metrics).some((v) => v.trim() !== '');
  const geoColor = geoScore >= 80 ? 'green' : geoScore >= 50 ? 'yellow' : 'red';
  const geoColorClasses = {
    green: 'text-green-600 bg-green-50 border-green-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    red: 'text-red-600 bg-red-50 border-red-200',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">📊 Traditional SEO vs GEO</span>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            Compare
          </span>
        </div>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Instructions toggle */}
          <div>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              {showInstructions ? '▲ Hide' : '▼ Show'} where to get these metrics (all free)
            </button>
            {showInstructions && (
              <div className="mt-2 space-y-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                {INSTRUCTIONS.map((f) => (
                  <div key={f.key} className="flex gap-2 text-xs">
                    <span className="font-semibold text-indigo-700 w-36 shrink-0">{f.label}:</span>
                    <span className="text-indigo-600">{f.where}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {INSTRUCTIONS.map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  {f.label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={metrics[f.key]}
                  onChange={(e) => setMetrics((m) => ({ ...m, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            ))}
          </div>

          {/* Comparison */}
          {hasAnyMetric && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Traditional SEO */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Traditional SEO
                  </p>
                  {INSTRUCTIONS.map((f) => {
                    const val = metrics[f.key];
                    const num = parseFloat(val) || 0;
                    const isPosition = f.key === 'googlePosition';
                    const isSpam = f.key === 'spamScore';
                    let status: 'green' | 'yellow' | 'red' = 'red';
                    if (val) {
                      if (isPosition) {
                        status = num <= 3 ? 'green' : num <= 10 ? 'yellow' : 'red';
                      } else if (isSpam) {
                        status = num <= 2 ? 'green' : num <= 10 ? 'yellow' : 'red';
                      } else {
                        status = getStatus(num, f.thresholds);
                      }
                    }
                    return (
                      <MetricRow
                        key={f.key}
                        label={f.label}
                        value={
                          val
                            ? f.key === 'googlePosition'
                              ? `#${val}`
                              : f.key === 'spamScore'
                                ? `${val}%`
                                : Number(val).toLocaleString()
                            : ''
                        }
                        status={val ? status : 'red'}
                        hint={val ? f.hint(val) : 'Not entered'}
                      />
                    );
                  })}
                </div>

                {/* GEO Score */}
                <div className={`rounded-xl border p-3 ${geoColorClasses[geoColor]}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">
                    GEO Score
                  </p>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-black">{geoScore}</span>
                    <span className="text-sm opacity-60">/ 100</span>
                  </div>
                  <div className="space-y-1.5">
                    {signals.map((s) => (
                      <div key={s.name} className="flex items-center justify-between">
                        <span className="text-[11px] flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full inline-block ${s.emoji === 'pass' ? 'bg-green-400' : s.emoji === 'warn' ? 'bg-amber-400' : 'bg-red-400'}`}
                          />
                          <span className="opacity-80">{s.name}</span>
                        </span>
                        <span className="text-[11px] font-bold">
                          {s.score}/{s.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div className="bg-gray-900 text-white rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  Verdict
                </p>
                <p className="text-sm leading-relaxed">
                  {generateVerdict(metrics, geoScore, signals)}
                </p>
              </div>
            </div>
          )}

          {!hasAnyMetric && (
            <p className="text-xs text-gray-400 text-center py-2">
              Enter at least one metric above to see the comparison.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
