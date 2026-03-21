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

const REWRITE_FOCUS_OPTIONS = [
  'Full GEO Optimization',
  'BLUF Intro Rewrite',
  'FAQ Addition',
  'Entity Clarity',
  'Factual Density',
  'Format Structure',
];

const TAG_STYLES: Record<string, { bg: string; text: string }> = {
  BLUF: { bg: 'bg-brand-purple/15', text: 'text-brand-purple' },
  ENTITY: { bg: 'bg-brand-cyan/15', text: 'text-brand-cyan' },
  FACTS: { bg: 'bg-red-100', text: 'text-red-600' },
  FAQ: { bg: 'bg-green-100', text: 'text-green-700' },
  FORMAT: { bg: 'bg-teal-100', text: 'text-teal-700' },
  SCHEMA: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

interface ChangeItem {
  tag: string;
  title: string;
  reason: string;
}

function parseScoreBefore(text: string): number | null {
  const m = text.match(/Score Before:\s*(\d+)\s*\/\s*100/i);
  return m ? parseInt(m[1]) : null;
}
function parseScoreAfter(text: string): number | null {
  const m = text.match(/Score After:\s*(\d+)\s*\/\s*100/i);
  return m ? parseInt(m[1]) : null;
}
function parseSignalsFixed(text: string): { fixed: number; total: number } | null {
  const m = text.match(/Signals Fixed:\s*(\d+)\s*of\s*(\d+)/i);
  return m ? { fixed: parseInt(m[1]), total: parseInt(m[2]) } : null;
}
function parseRewrittenContent(text: string): string | null {
  const m = text.match(/OPTIMIZED CONTENT\n+([\s\S]*?)(?:━{5,}|WHAT CHANGED)/);
  return m ? m[1].trim() : null;
}
function parseChanges(text: string): ChangeItem[] {
  const section = text.match(/WHAT CHANGED(?:\s*&\s*WHY)?\n([\s\S]*?)(?:━{5,}|$)/i);
  if (!section) return [];
  const items: ChangeItem[] = [];
  const regex = /\[(BLUF|ENTITY|FACTS|FAQ|FORMAT|SCHEMA)\]\s*(.+?)\s*—\s*(.+)/g;
  let m;
  while ((m = regex.exec(section[1])) !== null) {
    items.push({ tag: m[1], title: m[2].trim(), reason: m[3].trim() });
  }
  return items;
}

interface RewriteTabProps {
  apiKey: string;
  provider: string;
  model: string;
  url: string;
}

export function RewriteTab({ apiKey, provider, model, url }: RewriteTabProps) {
  const [rewriteFocus, setRewriteFocus] = useState('Full GEO Optimization');
  const [businessName, setBusinessName] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [userContent, setUserContent] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [cachedReport, setCachedReportState] = useState<CachedReport | null>(null);

  // Parsed output state
  const [scoreBefore, setScoreBefore] = useState<number | null>(null);
  const [scoreAfter, setScoreAfter] = useState<number | null>(null);
  const [signalsFixed, setSignalsFixed] = useState<{ fixed: number; total: number } | null>(null);
  const [rewrittenContent, setRewrittenContent] = useState<string | null>(null);
  const [changes, setChanges] = useState<ChangeItem[]>([]);

  const {
    output: streamOutput,
    isStreaming,
    error: streamError,
    timing,
    run,
    reset,
  } = useStream('/api/rewrite');
  const output = cachedReport?.text || streamOutput;

  useEffect(() => {
    if (!output) return;
    const sb = parseScoreBefore(output);
    if (sb !== null) setScoreBefore(sb);
    const sa = parseScoreAfter(output);
    if (sa !== null) setScoreAfter(sa);
    const sf = parseSignalsFixed(output);
    if (sf) setSignalsFixed(sf);
    const rc = parseRewrittenContent(output);
    if (rc) setRewrittenContent(rc);
    const ch = parseChanges(output);
    if (ch.length > 0) setChanges(ch);
  }, [output]);

  useEffect(() => {
    if (!isStreaming && streamOutput && url.trim()) {
      setCachedReport(
        cacheKey('rewrite', url.trim(), targetQuery.trim()),
        streamOutput,
        provider,
        model
      );
      // Save to Supabase for thesis data — captures before/after score improvement
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rewrite',
          url: url.trim(),
          targetQuery: targetQuery.trim(),
          reportText: streamOutput,
          geoScore: scoreAfter,
          scoreBeforeRewrite: scoreBefore,
          scoreAfterRewrite: scoreAfter,
          signalsFixed: signalsFixed?.fixed ?? null,
          provider,
          model,
          durationMs: timing.durationMs,
          timeToFirstTokenMs: timing.timeToFirstTokenMs,
        }),
      }).catch(() => {});
    }
  }, [isStreaming, streamOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRewrite = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please add your API key in the provider settings.');
      return;
    }
    if (!userContent.trim() && !url.trim()) {
      setValidationError('Paste your content below or enter a URL in the Analyze tab first.');
      return;
    }

    setValidationError('');
    setCachedReportState(null);

    const cKey = cacheKey('rewrite', url.trim(), targetQuery.trim());
    const cached = getCachedReport(cKey);
    if (cached) {
      setCachedReportState(cached);
      return;
    }

    let content = userContent.trim();

    if (!content && url.trim()) {
      setIsFetching(true);
      try {
        const { text } = await fetchPageContent(url);
        content = text;
      } catch (err) {
        setValidationError(err instanceof Error ? err.message : 'Failed to fetch page.');
        setIsFetching(false);
        return;
      }
      setIsFetching(false);
    }

    run({
      content,
      targetQuery: targetQuery.trim() || 'Infer the most relevant target query from the content',
      rewriteFocus,
      businessName: businessName.trim(),
      apiKey: apiKey.trim(),
      provider,
      model,
    });
  };

  const handleReset = () => {
    reset();
    setCachedReportState(null);
    setValidationError('');
    setScoreBefore(null);
    setScoreAfter(null);
    setSignalsFixed(null);
    setRewrittenContent(null);
    setChanges([]);
  };

  const handleRefresh = () => {
    bustCache(cacheKey('rewrite', url.trim(), targetQuery.trim()));
    setCachedReportState(null);
    handleReset();
    handleRewrite();
  };

  const isLoading = isFetching || isStreaming;
  const loadingLabel = isFetching ? 'Fetching page…' : 'Rewriting…';
  const error = validationError || streamError;
  const hasOutput = scoreBefore !== null || scoreAfter !== null || rewrittenContent;
  const delta = scoreBefore !== null && scoreAfter !== null ? scoreAfter - scoreBefore : null;

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent placeholder:text-gray-300';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
          Content Rewriter
        </p>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
          Rewrite for AI Citability
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Paste your content below. We'll apply GEO transformations and show you exactly what
          changed.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow-card p-6 space-y-5">
        {/* Row: Rewrite Focus | Business Name | Target AI Query | Button */}
        <div className="flex gap-3 items-end">
          <div className="w-52 shrink-0">
            <label className={labelCls}>Rewrite Focus</label>
            <select
              value={rewriteFocus}
              onChange={(e) => setRewriteFocus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
            >
              {REWRITE_FOCUS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className={labelCls}>Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. SpeedPro South Jersey"
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <label className={labelCls}>Target AI Query</label>
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              placeholder="e.g. best printing services NJ"
              className={inputCls}
            />
          </div>
          <div className="shrink-0 pb-0">
            <SubmitButton
              isLoading={isLoading}
              label="↺ Rewrite for GEO"
              loadingLabel={loadingLabel}
              onClick={handleRewrite}
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

      {/* Score metrics — 3 cards (always visible) */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className={labelCls}>Score Before</p>
          <p className="text-[2.75rem] font-black tabular-nums leading-none text-gray-900">
            {scoreBefore ?? '—'}
          </p>
          <p className="text-sm text-gray-400 mt-1">/ 100</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className={labelCls}>Score After</p>
          <p className="text-[2.75rem] font-black tabular-nums leading-none text-gray-900">
            {scoreAfter ?? '—'}
          </p>
          {delta !== null ? (
            <p
              className={`text-sm font-bold mt-1 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}
            >
              {delta >= 0 ? '↑' : '↓'} {delta >= 0 ? '+' : ''}
              {delta} points
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">/ 100</p>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className={labelCls}>Signals Fixed</p>
          <p className="text-[2.75rem] font-black tabular-nums leading-none text-green-600">
            {signalsFixed?.fixed ?? '—'}
          </p>
          {signalsFixed ? (
            <p className="text-sm font-bold text-green-600 mt-1">
              of {signalsFixed.total} improved
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">of 6</p>
          )}
        </div>
      </div>

      {/* Content comparison — 2 columns (always visible) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Original */}
        <div className="bg-white rounded-2xl shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className={labelCls}>Original Content</p>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-300 text-red-500 bg-red-50">
              Before
            </span>
          </div>
          <textarea
            value={userContent}
            onChange={(e) => setUserContent(e.target.value)}
            placeholder="Paste your existing page content here — intro, about section, service description…"
            rows={12}
            className="w-full text-sm text-gray-600 leading-relaxed resize-none focus:outline-none placeholder:text-gray-300"
          />
        </div>

        {/* Right: Rewritten */}
        <div className="bg-white rounded-2xl shadow-card p-5 space-y-3 overflow-y-auto max-h-[360px]">
          <div className="flex items-center justify-between">
            <p className={labelCls}>GEO-Optimized Version</p>
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${rewrittenContent ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400 bg-gray-50'}`}
            >
              GEO Ready
            </span>
          </div>
          {rewrittenContent ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {rewrittenContent}
            </p>
          ) : isLoading ? (
            <p className="text-sm text-brand-purple animate-pulse">Rewriting…</p>
          ) : (
            <div className="text-sm text-gray-300 leading-relaxed space-y-4">
              <p>
                <span className="font-semibold">Q:</span> Where is [Your Business] located?
                <br />
                <span className="font-semibold">A:</span> [Your Business] is based in [City, Region]
                and serves clients across [geographic area].
              </p>
              <p>
                <span className="font-semibold">Q:</span> What makes [Your Business] different?
                <br />
                <span className="font-semibold">A:</span> Unlike generic providers, [Your Business]
                offers [specific differentiator] backed by [credential or proof].
              </p>
              <p>
                <span className="font-semibold">Q:</span> What services does [Your Business]
                provide?
                <br />
                <span className="font-semibold">A:</span> [Your Business] specializes in [service
                1], [service 2], and [service 3] for clients in [region].
              </p>
            </div>
          )}
        </div>
      </div>

      {/* What Changed & Why — always visible */}
      <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
        <p className={labelCls}>What Changed &amp; Why</p>
        <div className="divide-y divide-gray-100">
          {changes.length > 0
            ? changes.map((item, idx) => {
                const style = TAG_STYLES[item.tag] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-5 py-4 px-2 first:pt-0 last:pb-0 hover:bg-brand-lavender/40 rounded-xl transition-colors cursor-default"
                  >
                    <span
                      className={`shrink-0 w-16 text-center text-[10px] font-black px-2 py-1.5 rounded-md tracking-widest ${style.bg} ${style.text}`}
                    >
                      {item.tag}
                    </span>
                    <p className="text-sm text-gray-700 leading-snug">
                      <span className="font-bold">{item.title}</span>
                      {' — '}
                      {item.reason}
                    </p>
                  </div>
                );
              })
            : [
                {
                  tag: 'BLUF',
                  title: 'Intro rewritten',
                  reason:
                    'replaced vague opener with a direct BLUF statement naming the business, location, and core service.',
                },
                {
                  tag: 'ENTITY',
                  title: 'Entity anchor added',
                  reason:
                    'business name and city inserted so AI systems can clearly identify and cite the correct entity.',
                },
                {
                  tag: 'FACTS',
                  title: 'Vague claims replaced',
                  reason:
                    '"years of experience" → specific founding year; "trusted by clients" → named client count and region served.',
                },
                {
                  tag: 'FAQ',
                  title: 'FAQ block added',
                  reason:
                    '6 natural-language Q&A pairs targeting the most common AI queries about this business category.',
                },
              ].map((item, idx) => {
                const style = TAG_STYLES[item.tag];
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-5 py-4 first:pt-0 last:pb-0 opacity-80"
                  >
                    <span
                      className={`shrink-0 w-16 text-center text-[10px] font-black px-2 py-1.5 rounded-md tracking-widest ${style.bg} ${style.text}`}
                    >
                      {item.tag}
                    </span>
                    <p className="text-sm text-gray-700 leading-snug">
                      <span className="font-bold">{item.title}</span>
                      {' — '}
                      {item.reason}
                    </p>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
