'use client';

import { useState, useEffect, useRef } from 'react';
import {
  parseGeoScore,
  parseSignals,
  parseAiAnswerPreview,
  getScoreStatus,
  getScoreColor,
  type Signal,
  type AiAnswerPreview,
} from '@/lib/parse-geo';
import {
  parseAuditScore,
  parseAuditSignals,
  getAuditStatus,
  getAuditColor,
  getSeoQuickFixes,
  type AuditSignal,
} from '@/lib/parse-seo';
import { useStream } from '@/lib/hooks/useStream';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StreamingOutput } from '@/components/ui/StreamingOutput';
import { saveAnalysis, getUrlHistory, type HistoryEntry } from '@/lib/history';
import { fetchPageContent } from '@/lib/fetch-page';
import { getTrainingConsent } from '@/components/ui/ConsentModal';
import {
  getCachedReport,
  setCachedReport,
  bustCache,
  cacheAgeLabel,
  cacheKey,
  type CachedReport,
} from '@/lib/analysis-cache';

const COLOR_CLASSES = {
  green: {
    text: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badgeBorder: 'border-green-400',
    bar: 'bg-green-500',
    badge: 'bg-green-100 text-green-800',
  },
  yellow: {
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badgeBorder: 'border-yellow-400',
    bar: 'bg-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  red: {
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badgeBorder: 'border-red-400',
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-800',
  },
} as const;

// Fixed signal schemas — defines the canonical order, names, and max scores.
// The breakdown always renders all rows; parsed AI data fills in scores/findings.
const GEO_SIGNAL_SCHEMA = [
  { name: 'Citability', maxScore: 25 },
  { name: 'Entity Clarity', maxScore: 20 },
  { name: 'Factual Density', maxScore: 20 },
  { name: 'Format Quality', maxScore: 15 },
  { name: 'Topical Authority', maxScore: 10 },
  { name: 'Schema Health', maxScore: 10 },
] as const;

const SEO_SIGNAL_SCHEMA = [
  { name: 'Title & Meta', maxScore: 20 },
  { name: 'Heading Structure', maxScore: 20 },
  { name: 'Content Depth', maxScore: 20 },
  { name: 'Social Proof', maxScore: 15 },
  { name: 'Brand Clarity', maxScore: 15 },
  { name: 'CTA & Conversion', maxScore: 10 },
] as const;

function getScoreSubtitle(score: number): string {
  if (score >= 80) return 'Your content is well-optimized for AI discovery.';
  if (score >= 65) return 'Approaching citability — a few targeted fixes will get you there.';
  return 'Significant improvements needed to appear in AI answers.';
}

function ScoreDelta({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta === 0) return null;
  const isPositive = delta > 0;
  return (
    <div
      className={`mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
        isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}
      {delta} pts from last scan
    </div>
  );
}

function ScoreRing({
  score,
  color,
  previousScore,
}: {
  score: number;
  color: 'green' | 'yellow' | 'red';
  previousScore?: number | null;
}) {
  const c = COLOR_CLASSES[color];
  return (
    <div className="text-center">
      <div className={`text-5xl font-black tabular-nums ${c.text}`}>{score}</div>
      <div className="text-sm text-gray-400 font-medium -mt-1">/ 100</div>
      <div className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-bold ${c.badge}`}>
        {getScoreStatus(score)}
      </div>
      {previousScore != null && <ScoreDelta current={score} previous={previousScore} />}
    </div>
  );
}

interface ConsensusKeys {
  gemini?: string;
  groq?: string;
  geminiModel?: string;
  groqModel?: string;
}

interface AnalyzeTabProps {
  apiKey: string;
  provider: string;
  model: string;
  isReady?: boolean;
  consensusKeys?: ConsensusKeys;
  url: string;
  onUrlChange: (url: string) => void;
  onTabChange?: (tab: string) => void;
}

export function AnalyzeTab({
  apiKey,
  provider,
  model,
  isReady,
  consensusKeys,
  url,
  onUrlChange,
  onTabChange,
}: AnalyzeTabProps) {
  const setUrl = onUrlChange;
  const [targetQuery, setTargetQuery] = useState('');
  const [geoScore, setGeoScore] = useState<number | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [aiPreview, setAiPreview] = useState<AiAnswerPreview | null>(null);
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [seoSignals, setSeoSignals] = useState<AuditSignal[]>([]);
  const [seoFixes, setSeoFixes] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [priorHistory, setPriorHistory] = useState<HistoryEntry[]>([]);
  const [isConsensusMode, setIsConsensusMode] = useState(false);
  const [cachedReport, setCachedReportState] = useState<CachedReport | null>(null);
  const hasSaved = useRef(false);
  const pageContentRef = useRef<string>('');

  const {
    output: analysis,
    isStreaming: isAnalyzing,
    error: streamError,
    timing: analyzeTiming,
    run,
    reset,
  } = useStream('/api/analyze');

  const {
    output: consensusAnalysis,
    isStreaming: isConsensusAnalyzing,
    error: consensusError,
    run: runConsensus,
    reset: resetConsensus,
  } = useStream('/api/consensus');

  const hasBothFreeKeys = !!(consensusKeys?.gemini && consensusKeys?.groq);

  const activeOutput = cachedReport?.text || (isConsensusMode ? consensusAnalysis : analysis);

  useEffect(() => {
    if (!activeOutput) return;
    const geo = parseGeoScore(activeOutput);
    if (geo !== null) setGeoScore(geo);
    const geoSigs = parseSignals(activeOutput);
    if (geoSigs.length > 0) setSignals(geoSigs);
    const seo = parseAuditScore(activeOutput);
    if (seo !== null) setSeoScore(seo);
    const seoSigs = parseAuditSignals(activeOutput);
    if (seoSigs.length > 0) setSeoSignals(seoSigs);
    const fixes = getSeoQuickFixes(activeOutput);
    if (Object.keys(fixes).length > 0) setSeoFixes(fixes);
    const preview = parseAiAnswerPreview(activeOutput);
    if (preview) setAiPreview(preview);
  }, [activeOutput]);

  useEffect(() => {
    if (url.trim()) {
      setPriorHistory(getUrlHistory(url.trim()));
    } else {
      setPriorHistory([]);
    }
  }, [url]);

  useEffect(() => {
    if (!isAnalyzing && geoScore !== null && signals.length > 0 && !hasSaved.current) {
      saveAnalysis({
        url: url.trim(),
        targetQuery: targetQuery.trim() || 'Inferred',
        score: geoScore,
        signals,
        analyzedAt: new Date().toISOString(),
      });
      // Save full report to cache
      const reportText = isConsensusMode ? consensusAnalysis : analysis;
      if (reportText && url.trim()) {
        setCachedReport(cacheKey('analyze', url.trim()), reportText, provider, model);
      }
      // Save to server (training data) for signed-in users
      if (reportText && url.trim()) {
        fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'analyze',
            url: url.trim(),
            targetQuery: targetQuery.trim() || 'Inferred',
            reportText,
            geoScore,
            signals,
            pageContent: pageContentRef.current,
            provider,
            model,
            durationMs: analyzeTiming.durationMs,
            timeToFirstTokenMs: analyzeTiming.timeToFirstTokenMs,
            consentTraining: getTrainingConsent(),
          }),
        }).catch(() => {}); // silent — user may not be signed in
      }
      hasSaved.current = true;
    }
  }, [isAnalyzing, geoScore, signals]);

  const fetchPageText = async (): Promise<string | null> => {
    try {
      const { text } = await fetchPageContent(url);
      pageContentRef.current = text;
      return text;
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to fetch page.');
      return null;
    }
  };

  const buildHistoryContext = () =>
    priorHistory.length > 0
      ? `\n\nPREVIOUS ANALYSIS HISTORY FOR THIS URL:\n` +
        priorHistory
          .slice(0, 3)
          .map(
            (h) =>
              `- Analyzed ${new Date(h.analyzedAt).toLocaleDateString()}: Score ${h.score}/100 (${h.signals.map((s) => `${s.name}: ${s.score}/${s.maxScore}`).join(', ')})`
          )
          .join('\n') +
        '\n\nNote: Factor in this history when giving recommendations — acknowledge improvements or regressions.'
      : '';

  const handleAnalyze = async () => {
    if (!apiKey.trim() && !isReady) {
      setValidationError('Please add your API key — click the provider button in the top right.');
      return;
    }
    if (!url.trim()) {
      setValidationError('Please enter a URL to analyze.');
      return;
    }

    setValidationError('');
    setGeoScore(null);
    setSignals([]);
    setSeoScore(null);
    setSeoSignals([]);
    setSeoFixes({});
    setAiPreview(null);
    setIsConsensusMode(false);
    hasSaved.current = false;
    pageContentRef.current = '';

    // Check cache first
    const cached = getCachedReport(cacheKey('analyze', url.trim()));
    if (cached) {
      setCachedReportState(cached);
      const score = parseGeoScore(cached.text);
      if (score !== null) setGeoScore(score);
      const parsed = parseSignals(cached.text);
      if (parsed.length > 0) setSignals(parsed);
      return;
    }

    setCachedReportState(null);
    setIsFetching(true);

    try {
      const text = await fetchPageText();
      if (!text) return;
      setIsFetching(false);

      run({
        content: text + buildHistoryContext(),
        targetQuery: targetQuery.trim() || 'Infer the most relevant target query from the content',
        apiKey: apiKey.trim(),
        provider,
        model,
      });
    } catch {
      setValidationError('Network error. Please try again.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleConsensus = async () => {
    if (!url.trim()) {
      setValidationError('Please enter a URL to analyze.');
      return;
    }

    setValidationError('');
    setGeoScore(null);
    setSignals([]);
    setAiPreview(null);
    setIsFetching(true);
    setIsConsensusMode(true);
    hasSaved.current = false;

    try {
      const text = await fetchPageText();
      if (!text) return;
      setIsFetching(false);

      runConsensus({
        content: text + buildHistoryContext(),
        targetQuery: targetQuery.trim() || '',
        geminiKey: consensusKeys?.gemini || '',
        groqKey: consensusKeys?.groq || '',
        geminiModel: consensusKeys?.geminiModel || 'gemini-2.0-flash',
        groqModel: consensusKeys?.groqModel || 'llama-3.3-70b-versatile',
      });
    } catch {
      setValidationError('Network error. Please try again.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleReset = () => {
    reset();
    resetConsensus();
    setGeoScore(null);
    setSignals([]);
    setSeoScore(null);
    setSeoSignals([]);
    setSeoFixes({});
    setAiPreview(null);
    setValidationError('');
    setUrl('');
    setTargetQuery('');
    setIsConsensusMode(false);
    setCachedReportState(null);
  };

  const handleRefresh = () => {
    bustCache(cacheKey('analyze', url.trim()));
    setCachedReportState(null);
    setGeoScore(null);
    setSignals([]);
    reset();
    handleAnalyze();
  };

  const scoreColor = geoScore !== null ? getScoreColor(geoScore) : null;
  const isLoading = isFetching || isAnalyzing || isConsensusAnalyzing;
  const loadingLabel = isFetching
    ? 'Fetching page…'
    : isConsensusMode
      ? 'Running Gemini + Llama…'
      : 'Analyzing…';
  const error = validationError || (isConsensusMode ? consensusError : streamError);

  return (
    <div className="space-y-5">
      {/* Input card */}
      <div className="bg-white rounded-2xl p-5 space-y-4 shadow-card">
        {/* Value prop badges */}
        {!activeOutput && !isLoading && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand-purple/40 bg-brand-purple/5 text-xs font-semibold text-brand-purple">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-purple shrink-0" />
              SEO gets you found on Google.
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand-cyan/40 bg-brand-cyan/5 text-xs font-semibold text-brand-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan shrink-0" />
              GEO gets you cited by AI.
            </span>
            <span className="text-xs text-gray-400">Enter a URL to measure both.</span>
          </div>
        )}

        {/* Inputs + stacked action buttons */}
        <div className="flex gap-3 items-start">
          {/* URL */}
          <div className="flex-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="https://yoursite.com/service-page"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent"
            />
          </div>
          {/* Target query */}
          <div className="w-64 shrink-0">
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              placeholder="Target AI query (optional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent"
            />
          </div>
          {/* Actions — stacked vertically */}
          <div className="flex flex-col gap-2 shrink-0">
            <SubmitButton
              isLoading={isLoading}
              label="✦ Analyze"
              loadingLabel={loadingLabel}
              onClick={handleAnalyze}
            />
            {hasBothFreeKeys && (
              <button
                onClick={handleConsensus}
                disabled={isLoading}
                title="Runs Gemini + Llama simultaneously for a bias-averaged score"
                className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
                  isLoading
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-brand-purple hover:text-brand-purple'
                }`}
              >
                ⊞ 2-Model Check
              </button>
            )}
          </div>
        </div>

        {/* Meta row — cache info, history, reset */}
        {(priorHistory.length > 0 || cachedReport || activeOutput) && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-gray-100">
            <div className="flex items-center gap-3">
              {priorHistory.length > 0 && (
                <span className="text-xs text-gray-400">
                  Last scan:{' '}
                  <span
                    className={`font-bold ${priorHistory[0].score >= 80 ? 'text-green-600' : priorHistory[0].score >= 65 ? 'text-yellow-600' : 'text-red-600'}`}
                  >
                    {priorHistory[0].score}/100
                  </span>
                  {priorHistory.length > 1 && (
                    <span className="text-gray-300 ml-1">(was {priorHistory[1].score})</span>
                  )}
                </span>
              )}
              {cachedReport && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600">
                  <span>⚡</span>
                  <span>
                    Cached · {cacheAgeLabel(cachedReport.cachedAt)} · via {cachedReport.provider}
                  </span>
                  <button onClick={handleRefresh} className="underline ml-1">
                    Refresh
                  </button>
                </span>
              )}
            </div>
            {activeOutput && !isLoading && (
              <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">
                ↺ Reset
              </button>
            )}
          </div>
        )}

        <ErrorBanner error={error} />
      </div>

      {/* Loading state */}
      {isLoading && seoScore === null && (
        <div className="flex items-center gap-3 bg-white rounded-2xl shadow-card px-5 py-4">
          <div className="text-2xl text-brand-purple animate-pulse">◎</div>
          <div>
            <p className="text-sm font-medium text-gray-700">{loadingLabel}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Analyzing SEO foundation first, then GEO layer…
            </p>
          </div>
        </div>
      )}

      {/* GEO Score */}
      {(geoScore !== null || (isLoading && !isFetching)) && (
        <div className="px-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            GEO Score
          </p>
          <div className="flex items-start justify-between">
            <div className="flex items-baseline gap-3">
              <span className="text-[4rem] font-black tabular-nums leading-none text-gray-900">
                {geoScore ?? <span className="text-gray-200 animate-pulse">…</span>}
              </span>
              <span className="text-2xl text-gray-400 font-medium">/100</span>
              {priorHistory.length > 0 && geoScore !== null && (
                <ScoreDelta current={geoScore} previous={priorHistory[0].score} />
              )}
            </div>
            {geoScore !== null && scoreColor && (
              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${COLOR_CLASSES[scoreColor].badgeBorder} bg-white ${COLOR_CLASSES[scoreColor].text}`}
                >
                  <span className={`w-2 h-2 rounded-full ${COLOR_CLASSES[scoreColor].bar}`} />
                  {getScoreStatus(geoScore)}
                </span>
                <p className="text-xs text-gray-400 mt-2 max-w-[200px] ml-auto">
                  {getScoreSubtitle(geoScore)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GEO Signal Breakdown — always renders all 6 rows once GEO score is available */}
      {geoScore !== null && (
        <div className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            GEO Signal Breakdown
          </p>
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="grid grid-cols-[160px_72px_1fr] px-6 py-3 border-b border-gray-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Signal
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">
                Score
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-4">
                Finding
              </span>
            </div>
            {GEO_SIGNAL_SCHEMA.map((def, idx) => {
              const parsed = signals.find((s) => s.name === def.name);
              const c = parsed
                ? COLOR_CLASSES[
                    parsed.emoji === 'pass' ? 'green' : parsed.emoji === 'warn' ? 'yellow' : 'red'
                  ]
                : null;
              return (
                <div
                  key={def.name}
                  className="grid grid-cols-[160px_72px_1fr] px-6 py-4 border-b border-gray-100 last:border-0 items-center opacity-0 animate-row-in hover:bg-brand-lavender/40 transition-colors cursor-default"
                  style={{ animationDelay: `${idx * 0.07}s` }}
                >
                  <span className="text-sm font-bold text-gray-900">{def.name}</span>
                  <div className="text-center">
                    {parsed && c ? (
                      <>
                        <span className={`text-2xl font-black tabular-nums leading-none ${c.text}`}>
                          {parsed.score}
                        </span>
                        <span className="block text-xs text-gray-400 mt-0.5">/{def.maxScore}</span>
                      </>
                    ) : (
                      <span className="text-gray-300 text-sm tabular-nums">—/{def.maxScore}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed pl-4">
                    {parsed?.finding ?? <span className="text-gray-300">Analyzing…</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEO Score */}
      {seoScore !== null && (
        <div className="px-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            SEO Score
          </p>
          <div className="flex items-start justify-between">
            <div className="flex items-baseline gap-3">
              <span className="text-[4rem] font-black tabular-nums leading-none text-gray-900">
                {seoScore}
              </span>
              <span className="text-2xl text-gray-400 font-medium">/100</span>
            </div>
            {(() => {
              const seoColor = getAuditColor(seoScore);
              const c = COLOR_CLASSES[seoColor];
              return (
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${c.badgeBorder} bg-white ${c.text}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.bar}`} />
                    {getAuditStatus(seoScore)}
                  </span>
                  <p className="text-xs text-gray-400 mt-2 max-w-[200px] ml-auto">
                    {seoScore >= 75
                      ? 'Your SEO foundation is solid.'
                      : seoScore >= 45
                        ? 'Fix these signals to strengthen your base.'
                        : 'Core SEO issues need addressing first.'}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SEO Signal Breakdown — always renders all 6 rows once SEO score is available */}
      {seoScore !== null && (
        <div className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            SEO Signal Breakdown
          </p>
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="grid grid-cols-[160px_72px_1fr_1fr] px-6 py-3 border-b border-gray-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Signal
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">
                Score
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-4">
                Finding
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-4">
                Quick Fix
              </span>
            </div>
            {SEO_SIGNAL_SCHEMA.map((def, idx) => {
              const parsed = seoSignals.find((s) => s.name === def.name);
              const c = parsed
                ? COLOR_CLASSES[
                    parsed.emoji === 'pass' ? 'green' : parsed.emoji === 'warn' ? 'yellow' : 'red'
                  ]
                : null;
              const fix = seoFixes[def.name];
              return (
                <div
                  key={def.name}
                  className="grid grid-cols-[160px_72px_1fr_1fr] px-6 py-4 border-b border-gray-100 last:border-0 items-center opacity-0 animate-row-in hover:bg-brand-lavender/40 transition-colors cursor-default"
                  style={{ animationDelay: `${idx * 0.07}s` }}
                >
                  <span className="text-sm font-bold text-gray-900">{def.name}</span>
                  <div className="text-center">
                    {parsed && c ? (
                      <>
                        <span className={`text-2xl font-black tabular-nums leading-none ${c.text}`}>
                          {parsed.score}
                        </span>
                        <span className="block text-xs text-gray-400 mt-0.5">/{def.maxScore}</span>
                      </>
                    ) : (
                      <span className="text-gray-300 text-sm tabular-nums">—/{def.maxScore}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed pl-4">
                    {parsed?.finding ?? <span className="text-gray-300">Analyzing…</span>}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed pl-4">
                    {fix ?? <span className="text-gray-300">Analyzing…</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Answer Preview card */}
      {aiPreview && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {isConsensusMode ? '🔀 2-Model Consensus' : 'Preview of Analysis Report'}
            </p>
            <button
              onClick={() => onTabChange?.('audit')}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Full report → Marketing Strategy
            </button>
          </div>
          <div className="p-5 space-y-4">
            {aiPreview.query && (
              <p className="text-xs text-gray-500">
                If an AI was asked{' '}
                <span className="font-semibold text-gray-700">"{aiPreview.query}"</span> and read
                this page, it would likely say:
              </p>
            )}
            {aiPreview.answer && (
              <blockquote className="border-l-4 border-indigo-300 pl-4 text-sm text-gray-700 leading-relaxed italic">
                "{aiPreview.answer}"
              </blockquote>
            )}
            {aiPreview.missing && (
              <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                    What's missing
                  </p>
                  <p className="text-xs text-amber-800 leading-snug">{aiPreview.missing}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streaming placeholder while preview hasn't parsed yet */}
      {activeOutput && !aiPreview && (
        <StreamingOutput
          output={activeOutput}
          isStreaming={isLoading && !isFetching}
          label={isConsensusMode ? '🔀 2-Model Consensus' : 'Full Analysis Report'}
          url={url.trim()}
          geoScore={geoScore}
        />
      )}
    </div>
  );
}
