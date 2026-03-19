'use client';

import { useState, useEffect, useRef } from 'react';
import {
  parseGeoScore,
  parseSignals,
  getScoreStatus,
  getScoreColor,
  type Signal,
} from '@/lib/parse-geo';
import { useStream } from '@/lib/hooks/useStream';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StreamingOutput } from '@/components/ui/StreamingOutput';
import { saveAnalysis, getUrlHistory, type HistoryEntry } from '@/lib/history';

const COLOR_CLASSES = {
  green: {
    text: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    bar: 'bg-green-500',
    badge: 'bg-green-100 text-green-800',
  },
  yellow: {
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    bar: 'bg-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  red: {
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-800',
  },
} as const;

function ScoreRing({ score, color }: { score: number; color: 'green' | 'yellow' | 'red' }) {
  const c = COLOR_CLASSES[color];
  return (
    <div className="text-center">
      <div className={`text-7xl font-black tabular-nums ${c.text}`}>{score}</div>
      <div className="text-sm text-gray-400 font-medium -mt-1">/ 100</div>
      <div className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-bold ${c.badge}`}>
        {getScoreStatus(score)}
      </div>
    </div>
  );
}

function SignalBar({ signal }: { signal: Signal }) {
  const pct = Math.round((signal.score / signal.maxScore) * 100);
  const color = signal.emoji === '🟢' ? 'green' : signal.emoji === '🟡' ? 'yellow' : 'red';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-700 font-medium flex items-center gap-1">
          <span>{signal.emoji}</span>
          <span>{signal.name}</span>
        </span>
        <span className="text-xs text-gray-400 tabular-nums">
          {signal.score}/{signal.maxScore}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${COLOR_CLASSES[color].bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface AnalyzeTabProps {
  apiKey: string;
  provider: string;
  model: string;
}

export function AnalyzeTab({ apiKey, provider, model }: AnalyzeTabProps) {
  const [url, setUrl] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [geoScore, setGeoScore] = useState<number | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [priorHistory, setPriorHistory] = useState<HistoryEntry[]>([]);
  const hasSaved = useRef(false);

  const {
    output: analysis,
    isStreaming: isAnalyzing,
    error: streamError,
    run,
    reset,
  } = useStream('/api/analyze');

  useEffect(() => {
    if (!analysis) return;
    const score = parseGeoScore(analysis);
    if (score !== null) setGeoScore(score);
    const parsed = parseSignals(analysis);
    if (parsed.length > 0) setSignals(parsed);
  }, [analysis]);

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
      hasSaved.current = true;
    }
  }, [isAnalyzing, geoScore, signals]);

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
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
    setIsFetching(true);
    hasSaved.current = false;

    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setValidationError(data.error || 'Failed to fetch page.');
        return;
      }
      setIsFetching(false);

      const historyContext =
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

      run({
        content: data.text + historyContext,
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

  const handleReset = () => {
    reset();
    setGeoScore(null);
    setSignals([]);
    setValidationError('');
    setUrl('');
    setTargetQuery('');
  };

  const scoreColor = geoScore !== null ? getScoreColor(geoScore) : null;
  const isLoading = isFetching || isAnalyzing;
  const loadingLabel = isFetching ? 'Fetching page…' : 'Analyzing…';
  const error = validationError || streamError;

  return (
    <div className="space-y-5">
      <div className="flex gap-5 items-start">
        {/* Left: Inputs */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* URL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Page URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="https://yoursite.com/service-page"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {priorHistory.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <span>
                  Last analyzed {new Date(priorHistory[0].analyzedAt).toLocaleDateString()}:
                </span>
                <span
                  className={`font-bold ${priorHistory[0].score >= 80 ? 'text-green-600' : priorHistory[0].score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}
                >
                  {priorHistory[0].score}/100
                </span>
                {priorHistory.length > 1 && (
                  <span className="text-gray-400">(was {priorHistory[1].score} before that)</span>
                )}
              </div>
            )}
          </div>

          {/* Target query — optional */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Target AI Query
              <span className="ml-1.5 font-normal text-gray-400">
                (optional — we'll infer it if blank)
              </span>
            </label>
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              placeholder={`e.g. "best dental clinic in Cebu City"`}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            {(analysis || isLoading) && !isLoading && (
              <button
                onClick={handleReset}
                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-2 rounded-xl"
              >
                ↺ Reset
              </button>
            )}
            <div className="ml-auto">
              <SubmitButton
                isLoading={isLoading}
                label="✦ Analyze Page"
                loadingLabel={loadingLabel}
                onClick={handleAnalyze}
              />
            </div>
          </div>

          <ErrorBanner error={error} />
        </div>

        {/* Right: Score Panel */}
        <div className="w-64 shrink-0 space-y-4">
          <div
            className={`rounded-xl border-2 p-5 transition-colors duration-500 ${scoreColor ? `${COLOR_CLASSES[scoreColor].bg} ${COLOR_CLASSES[scoreColor].border}` : 'bg-white border-gray-200'}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
              GEO Score
            </p>
            {geoScore === null && !isLoading && (
              <div className="text-center py-6">
                <div className="text-4xl text-gray-200 mb-2">◎</div>
                <p className="text-xs text-gray-400">Enter a URL and click Analyze</p>
              </div>
            )}
            {geoScore === null && isLoading && (
              <div className="text-center py-6">
                <div className="text-3xl text-indigo-300 animate-pulse mb-2">◎</div>
                <p className="text-xs text-gray-400">{loadingLabel}</p>
              </div>
            )}
            {geoScore !== null && scoreColor && <ScoreRing score={geoScore} color={scoreColor} />}
            {signals.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-200 space-y-3">
                {signals.map((s) => (
                  <SignalBar key={s.name} signal={s} />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              What is GEO?
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Generative Engine Optimization makes your content more likely to be cited by AI
              systems like ChatGPT, Perplexity, and Google AI Overviews.
            </p>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="text-green-500">●</span>
                <span>80–100: GEO Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-yellow-500">●</span>
                <span>50–79: Needs Work</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-red-500">●</span>
                <span>0–49: Not Optimized</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StreamingOutput output={analysis} isStreaming={isAnalyzing} label="GEO Analysis Report" />
    </div>
  );
}
