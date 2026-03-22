'use client';

import { useState, useEffect } from 'react';
import { useStream } from '@/lib/hooks/useStream';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SubmitButton } from '@/components/ui/SubmitButton';
import {
  getCachedReport,
  setCachedReport,
  bustCache,
  cacheAgeLabel,
  cacheKey,
  type CachedReport,
} from '@/lib/analysis-cache';
import { fetchPageContent } from '@/lib/fetch-page';
import { getScoreStatus, getScoreColor } from '@/lib/parse-geo';

interface RankReason {
  title: string;
  reason: string;
}
interface SignalGap {
  signal: string;
  priority: 'High' | 'Medium' | 'Low';
  fix: string;
}
interface DisplacementPlay {
  impact: 'High Impact' | 'Medium Impact' | 'Low Impact';
  title: string;
  description: string;
}

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}
function parseMyScore(text: string): number | null {
  const m =
    text.match(/Your\s+(?:GEO\s+)?Score:\s*(\d+)/i) ||
    text.match(/My\s+(?:GEO\s+)?Score:\s*(\d+)/i);
  return m ? parseInt(m[1]) : null;
}
function parseCompetitorScore(text: string): number | null {
  const m = text.match(/Competitor\s+(?:GEO\s+)?Score:\s*(\d+)/i);
  return m ? parseInt(m[1]) : null;
}
function parseRankReasons(text: string): RankReason[] {
  const items: RankReason[] = [];
  const regex = /(?:^|\n)\s*\d+[.)]\s+\*{0,2}([^*\n—–]+)\*{0,2}\s*[—–-]+\s*(.+)/gm;
  let m;
  while ((m = regex.exec(text)) !== null) {
    items.push({ title: m[1].trim(), reason: m[2].trim() });
  }
  return items.slice(0, 5);
}
const SCORE_COLOR_CLASS = {
  green: 'text-green-600',
  yellow: 'text-amber-500',
  red: 'text-red-500',
} as const;
function scoreLabel(score: number): { label: string; color: string } {
  return { label: getScoreStatus(score), color: SCORE_COLOR_CLASS[getScoreColor(score)] };
}

function parseSignalGaps(text: string): SignalGap[] {
  const items: SignalGap[] = [];
  const regex = /\|\s*([^|]+?)\s*\|\s*(High|Medium|Low)\s*\|\s*([^|]+?)\s*\|/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const signal = m[1].trim();
    if (/signal/i.test(signal)) continue; // skip header row
    items.push({ signal, priority: m[2] as SignalGap['priority'], fix: m[3].trim() });
  }
  return items.slice(0, 6);
}
function parseDisplacementPlays(text: string): DisplacementPlay[] {
  const items: DisplacementPlay[] = [];
  const regex =
    /\b(High|Medium|Low)\s+Impact\b[^\n]*\n+\*{0,2}([^\n*]+)\*{0,2}\n+([\s\S]+?)(?=\n\n|\n\*|\n\d|\bHigh\b|\bMedium\b|\bLow\b|$)/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    items.push({
      impact: `${m[1]} Impact` as DisplacementPlay['impact'],
      title: m[2].trim(),
      description: m[3].trim(),
    });
  }
  return items.slice(0, 4);
}

const PLACEHOLDER_REASONS: RankReason[] = [
  {
    title: 'Complete schema markup',
    reason:
      'They have LocalBusiness + FAQPage JSON-LD fully implemented, giving AI engines a structured entity map.',
  },
  {
    title: 'Higher factual density',
    reason:
      'Their page contains 6 verifiable data points (founding year, client count, certifications) versus your 2.',
  },
  {
    title: 'Stronger FAQ coverage',
    reason: 'They answer 8 natural-language questions matching common AI queries in this category.',
  },
];
const PLACEHOLDER_GAPS: SignalGap[] = [
  {
    signal: 'Schema Health',
    priority: 'High',
    fix: 'Add LocalBusiness + FAQPage JSON-LD. Competitor has full schema; you have none.',
  },
  {
    signal: 'Factual Density',
    priority: 'High',
    fix: 'Add founding year, client count, and a credential. Competitor scores 18/20; you score 10/20.',
  },
  {
    signal: 'Format Quality',
    priority: 'Medium',
    fix: 'Add a 6–8 question FAQ section. Competitor has a full FAQ; yours has none.',
  },
  {
    signal: 'Citability',
    priority: 'Medium',
    fix: 'Rewrite your intro with a BLUF statement. Lead with who, where, what in the first 2 sentences.',
  },
  {
    signal: 'Entity Clarity',
    priority: 'Low',
    fix: 'Reinforce business name in 2–3 more places. Competitor mentions theirs 9× vs your 4×.',
  },
];
const PLACEHOLDER_PLAYS: DisplacementPlay[] = [
  {
    impact: 'High Impact',
    title: 'Schema blitz',
    description:
      'Implement LocalBusiness + FAQPage schema this week. This alone could close 60% of the gap — lowest effort, highest return.',
  },
  {
    impact: 'High Impact',
    title: 'Facts injection',
    description:
      'Add 4 verifiable data points: founding year, total clients, primary service area, and one named credential or award.',
  },
  {
    impact: 'Medium Impact',
    title: 'FAQ content block',
    description:
      "Write 8 Q&A pairs targeting queries your competitor's FAQ covers. Use natural language — how a customer would ask an AI.",
  },
];

const PRIORITY_STYLES: Record<string, { badge: string; text: string }> = {
  High: { badge: 'border border-red-300 bg-red-50', text: 'text-red-500' },
  Medium: { badge: 'border border-amber-300 bg-amber-50', text: 'text-amber-500' },
  Low: { badge: 'border border-green-300 bg-green-50', text: 'text-green-600' },
};
const IMPACT_STYLES: Record<string, { badge: string; text: string }> = {
  'High Impact': { badge: 'bg-brand-purple/15', text: 'text-brand-purple' },
  'Medium Impact': { badge: 'bg-brand-cyan/15', text: 'text-brand-cyan' },
  'Low Impact': { badge: 'bg-gray-100', text: 'text-gray-500' },
};

interface CompetitorTabProps {
  apiKey: string;
  provider: string;
  model: string;
}

export function CompetitorTab({ apiKey, provider, model }: CompetitorTabProps) {
  const [myUrl, setMyUrl] = useState(() => sessionStorage.getItem('competitor-myUrl') || '');
  const [competitorUrl, setCompetitorUrl] = useState(
    () => sessionStorage.getItem('competitor-competitorUrl') || ''
  );
  const [targetQuery, setTargetQuery] = useState(
    () => sessionStorage.getItem('competitor-targetQuery') || ''
  );
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [cachedReport, setCachedReportState] = useState<CachedReport | null>(null);

  const [myScore, setMyScore] = useState<number | null>(null);
  const [competitorScore, setCompetitorScore] = useState<number | null>(null);
  const [rankReasons, setRankReasons] = useState<RankReason[]>([]);
  const [signalGaps, setSignalGaps] = useState<SignalGap[]>([]);
  const [displacementPlays, setDisplacementPlays] = useState<DisplacementPlay[]>([]);

  // Persist inputs across tab switches
  useEffect(() => {
    sessionStorage.setItem('competitor-myUrl', myUrl);
  }, [myUrl]);
  useEffect(() => {
    sessionStorage.setItem('competitor-competitorUrl', competitorUrl);
  }, [competitorUrl]);
  useEffect(() => {
    sessionStorage.setItem('competitor-targetQuery', targetQuery);
  }, [targetQuery]);

  // Restore cached report on mount if URLs are already filled
  useEffect(() => {
    if (myUrl.trim() && competitorUrl.trim()) {
      const key = cacheKey('competitor', myUrl.trim(), competitorUrl.trim(), targetQuery.trim());
      const cached = getCachedReport(key);
      if (cached) setCachedReportState(cached);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    output: streamOutput,
    isStreaming,
    error: streamError,
    timing,
    run,
    reset,
  } = useStream('/api/competitor');
  const output = cachedReport?.text || streamOutput;

  useEffect(() => {
    if (!output) return;
    const ms = parseMyScore(output);
    if (ms !== null) setMyScore(ms);
    const cs = parseCompetitorScore(output);
    if (cs !== null) setCompetitorScore(cs);
    const rr = parseRankReasons(output);
    if (rr.length > 0) setRankReasons(rr);
    const sg = parseSignalGaps(output);
    if (sg.length > 0) setSignalGaps(sg);
    const dp = parseDisplacementPlays(output);
    if (dp.length > 0) setDisplacementPlays(dp);
  }, [output]);

  useEffect(() => {
    if (!isStreaming && streamOutput && myUrl.trim() && competitorUrl.trim()) {
      setCachedReport(
        cacheKey('competitor', myUrl.trim(), competitorUrl.trim(), targetQuery.trim()),
        streamOutput,
        provider,
        model
      );
      // Save to Supabase — captures my score vs competitor score for thesis gap analysis
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'competitor',
          url: myUrl.trim(),
          targetQuery: targetQuery.trim(),
          reportText: streamOutput,
          geoScore: myScore,
          competitorUrl: competitorUrl.trim(),
          competitorScore: competitorScore,
          provider,
          model,
          durationMs: timing.durationMs,
          timeToFirstTokenMs: timing.timeToFirstTokenMs,
        }),
      }).catch(() => {});
    }
  }, [isStreaming, streamOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOne = async (url: string) => {
    const { text } = await fetchPageContent(url);
    return text;
  };

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please add your API key.');
      return;
    }
    if (!myUrl.trim()) {
      setValidationError('Please enter your page URL.');
      return;
    }
    if (!competitorUrl.trim()) {
      setValidationError("Please enter the competitor's page URL.");
      return;
    }

    setValidationError('');
    setCachedReportState(null);

    const key = cacheKey('competitor', myUrl.trim(), competitorUrl.trim(), targetQuery.trim());
    const cached = getCachedReport(key);
    if (cached) {
      setCachedReportState(cached);
      return;
    }

    setIsFetching(true);
    try {
      const [myContent, competitorContent] = await Promise.all([
        fetchOne(myUrl.trim()),
        fetchOne(competitorUrl.trim()),
      ]);
      setIsFetching(false);
      run({
        myContent,
        competitorContent,
        targetQuery: targetQuery.trim() || 'Infer the most relevant target query from the content',
        apiKey: apiKey.trim(),
        provider,
        model,
      });
    } catch (err: any) {
      setValidationError(err.message || 'Failed to fetch one or both pages.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleReset = () => {
    reset();
    setCachedReportState(null);
    setValidationError('');
    setMyUrl('');
    setCompetitorUrl('');
    setTargetQuery('');
    setMyScore(null);
    setCompetitorScore(null);
    setRankReasons([]);
    setSignalGaps([]);
    setDisplacementPlays([]);
    sessionStorage.removeItem('competitor-myUrl');
    sessionStorage.removeItem('competitor-competitorUrl');
    sessionStorage.removeItem('competitor-targetQuery');
  };

  const handleRefresh = () => {
    bustCache(cacheKey('competitor', myUrl.trim(), competitorUrl.trim(), targetQuery.trim()));
    setCachedReportState(null);
    reset();
    handleAnalyze();
  };

  const isLoading = isFetching || isStreaming;
  const loadingLabel = isFetching ? 'Fetching pages…' : 'Analyzing…';
  const error = validationError || streamError;
  const hasOutput = myScore !== null || competitorScore !== null || rankReasons.length > 0;

  const myDomain = myUrl ? parseDomain(myUrl) : 'yoursite.com';
  const competitorDomain = competitorUrl ? parseDomain(competitorUrl) : 'competitor.com';
  const myStatus = myScore !== null ? scoreLabel(myScore) : null;
  const competitorStatus = competitorScore !== null ? scoreLabel(competitorScore) : null;

  const displayReasons = rankReasons.length > 0 ? rankReasons : PLACEHOLDER_REASONS;
  const displayGaps = signalGaps.length > 0 ? signalGaps : PLACEHOLDER_GAPS;
  const displayPlays = displacementPlays.length > 0 ? displacementPlays : PLACEHOLDER_PLAYS;
  const isPlaceholder = rankReasons.length === 0;

  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2';
  const inputCls =
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent placeholder:text-gray-300';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
          Competitor Gap
        </p>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
          Why Are They Ranking in AI?
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter your URL and a competitor's to see exactly what they're doing that you're not.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className={labelCls}>Your URL</label>
            <input
              type="url"
              value={myUrl}
              onChange={(e) => setMyUrl(e.target.value)}
              placeholder="https://yoursite.com/page"
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <label className={labelCls}>Competitor URL</label>
            <input
              type="url"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              placeholder="https://competitor.com/page"
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <label className={labelCls}>Target Query</label>
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              placeholder="e.g. best dentist Cebu"
              className={inputCls}
            />
          </div>
          <div className="shrink-0">
            <SubmitButton
              isLoading={isLoading}
              label="⚡ Run Analysis"
              loadingLabel={loadingLabel}
              onClick={handleAnalyze}
            />
          </div>
          {hasOutput && !isLoading && (
            <button
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600 shrink-0 pb-1"
            >
              ↺ Reset
            </button>
          )}
        </div>

        {cachedReport && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 pt-1 border-t border-gray-100">
            <span>⚡</span>
            <span>
              Cached · {cacheAgeLabel(cachedReport.cachedAt)} · via {cachedReport.provider}
            </span>
            <button onClick={handleRefresh} className="underline ml-1">
              Refresh
            </button>
          </span>
        )}

        <ErrorBanner error={error} />
      </div>

      {/* Score comparison — always visible */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="grid grid-cols-[1fr_64px_1fr]">
          {/* Your site */}
          <div className="p-6">
            <p className={labelCls}>Your Site</p>
            <p className="text-sm font-bold text-gray-800 mb-3">{myDomain}</p>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-[3.5rem] font-black tabular-nums leading-none ${
                  myScore !== null && competitorScore !== null && myScore > competitorScore
                    ? 'text-green-600'
                    : myScore !== null && competitorScore !== null && myScore < competitorScore
                      ? 'text-red-500'
                      : 'text-gray-900'
                }`}
              >
                {myScore ?? '—'}
              </span>
              <span className="text-lg text-gray-400 font-medium">/100</span>
            </div>
            {myStatus ? (
              <p className={`text-sm font-bold mt-2 ${myStatus.color}`}>{myStatus.label}</p>
            ) : (
              <p className="text-sm text-gray-300 mt-2">Run analysis to score</p>
            )}
          </div>

          {/* VS divider */}
          <div className="flex items-center justify-center border-x border-gray-100">
            <span className="text-xs font-black text-gray-300 tracking-widest">VS</span>
          </div>

          {/* Competitor */}
          <div className="p-6">
            <p className={labelCls}>Competitor</p>
            <p className="text-sm font-bold text-gray-800 mb-3">{competitorDomain}</p>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-[3.5rem] font-black tabular-nums leading-none ${
                  competitorScore !== null && myScore !== null && competitorScore > myScore
                    ? 'text-green-600'
                    : competitorScore !== null && myScore !== null && competitorScore < myScore
                      ? 'text-red-500'
                      : 'text-gray-900'
                }`}
              >
                {competitorScore ?? '—'}
              </span>
              <span className="text-lg text-gray-400 font-medium">/100</span>
            </div>
            {competitorStatus ? (
              <p className={`text-sm font-bold mt-2 ${competitorStatus.color}`}>
                {competitorStatus.label}
              </p>
            ) : (
              <p className="text-sm text-gray-300 mt-2">Run analysis to score</p>
            )}
          </div>
        </div>
      </div>

      {/* Competitive edge analysis — always visible with placeholders */}
      <div className="space-y-3">
        <p className={labelCls}>Competitive Edge Analysis</p>
        <div
          className={`bg-white rounded-2xl shadow-card p-6 space-y-5 transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
        >
          <div>
            <p className="text-sm font-bold text-gray-900">
              {myScore !== null && competitorScore !== null
                ? myScore > competitorScore
                  ? `You outrank ${competitorDomain} in AI citability:`
                  : myScore < competitorScore
                    ? `${competitorDomain} currently outranks you:`
                    : `Neck and neck with ${competitorDomain}:`
                : `${competitorDomain} — competitive breakdown:`}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {displayReasons.length} key differentiator{displayReasons.length !== 1 ? 's' : ''}{' '}
              identified from the content signal comparison.
            </p>
          </div>
          <div className="space-y-4">
            {displayReasons.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-brand-purple text-white text-xs font-black flex items-center justify-center">
                  {idx + 1}
                </span>
                <p className="text-sm text-gray-700 leading-snug pt-0.5">
                  <span className="font-bold">{item.title}</span>
                  {' — '}
                  {item.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signal-by-Signal Gap table */}
      <div className="space-y-3">
        <p className={labelCls}>Signal-by-Signal Gap</p>
        <div
          className={`bg-white rounded-2xl shadow-card overflow-hidden transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
        >
          {/* Header */}
          <div className="grid grid-cols-[1fr_96px_1fr] px-6 py-3 border-b border-gray-100">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Signal
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Priority
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              What to Fix
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {displayGaps.map((row, idx) => {
              const p = PRIORITY_STYLES[row.priority] ?? PRIORITY_STYLES.Low;
              return (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_96px_1fr] px-6 py-4 items-start hover:bg-brand-lavender/40 transition-colors cursor-default"
                >
                  <span className="text-sm font-bold text-gray-800">{row.signal}</span>
                  <span>
                    <span
                      className={`inline-block text-[10px] font-black px-3 py-1 rounded-full ${p.badge} ${p.text}`}
                    >
                      {row.priority}
                    </span>
                  </span>
                  <p className="text-sm text-gray-700 leading-snug">{row.fix}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* GEO Displacement Plays */}
      <div className="space-y-3">
        <p className={labelCls}>GEO Action Plan</p>
        <div
          className={`bg-white rounded-2xl shadow-card p-6 space-y-6 transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
        >
          <div>
            <p className="text-sm font-bold text-gray-900">
              {displayPlays.length} moves to strengthen your position in AI answers
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              Ordered by impact — do these in sequence.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {displayPlays.map((play, idx) => {
              const s = IMPACT_STYLES[play.impact] ?? IMPACT_STYLES['Low Impact'];
              return (
                <div
                  key={idx}
                  className="flex items-start gap-4 py-5 px-2 first:pt-0 last:pb-0 hover:bg-brand-lavender/40 rounded-xl transition-colors cursor-default"
                >
                  <span
                    className={`shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full whitespace-nowrap ${s.badge} ${s.text}`}
                  >
                    {play.impact}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{play.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 leading-snug">{play.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
