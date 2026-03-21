'use client';

import { useState, useEffect } from 'react';
import { useStream } from '@/lib/hooks/useStream';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SubmitButton } from '@/components/ui/SubmitButton';
import {
  parseAuditScore,
  parseAuditSignals,
  getAuditColor,
  type AuditSignal,
} from '@/lib/parse-seo';
import { parseGeoScore, parseSignals, getScoreStatus, type Signal } from '@/lib/parse-geo';
import {
  getCachedReport,
  setCachedReport,
  bustCache,
  cacheAgeLabel,
  cacheKey,
  type CachedReport,
} from '@/lib/analysis-cache';
import { generateAuditPdf } from '@/lib/generate-pdf';
import { fetchPageContent } from '@/lib/fetch-page';
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

interface MarketingAuditTabProps {
  apiKey: string;
  provider: string;
  model: string;
  url: string;
  onUrlChange: (url: string) => void;
  onTabChange?: (tab: string) => void;
}

interface SubItem {
  label: string;
  detail: string;
  status: 'pass' | 'fail' | 'warn' | null;
}
interface AuditSection {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  maxScore: number;
  placeholderScore: number;
  items: SubItem[];
}

const AUDIT_SECTIONS: AuditSection[] = [
  {
    id: 'content',
    icon: '◆',
    title: 'Content & Citability',
    subtitle: 'How well AI can extract and cite your content',
    maxScore: 25,
    placeholderScore: 17,
    items: [
      {
        label: 'BLUF Intro',
        detail: 'Opens with a direct answer — who, what, where in first 2 sentences',
        status: 'fail',
      },
      {
        label: 'FAQ Block',
        detail: 'Minimum 5 natural-language Q&A pairs targeting AI queries',
        status: 'warn',
      },
      {
        label: 'Entity Repetition',
        detail: 'Business name mentioned naturally in 3+ key paragraphs',
        status: 'pass',
      },
      {
        label: 'Topical Depth',
        detail: 'Content covers topic comprehensively with expert-level detail',
        status: 'warn',
      },
    ],
  },
  {
    id: 'schema',
    icon: '{}',
    title: 'Schema & Technical',
    subtitle: 'Structured data and entity signals',
    maxScore: 10,
    placeholderScore: 3,
    items: [
      {
        label: 'LocalBusiness JSON-LD',
        detail: 'Schema markup present and valid in page source',
        status: 'fail',
      },
      {
        label: 'FAQPage Schema',
        detail: 'FAQ section marked up for Google rich results',
        status: 'fail',
      },
      {
        label: 'sameAs Links',
        detail: 'External profiles connected (Google, Yelp, directories)',
        status: 'warn',
      },
    ],
  },
  {
    id: 'factual',
    icon: '◈',
    title: 'Factual Density',
    subtitle: 'Verifiable claims AI engines can extract',
    maxScore: 20,
    placeholderScore: 10,
    items: [
      {
        label: 'Founding Year',
        detail: 'Specific year or years in business stated explicitly',
        status: 'fail',
      },
      {
        label: 'Client Count / Stats',
        detail: 'Verifiable numbers: clients served, projects completed',
        status: 'warn',
      },
      {
        label: 'Credentials & Awards',
        detail: 'Named certifications, licenses, or recognitions listed',
        status: 'fail',
      },
      {
        label: 'Location Signals',
        detail: 'City and region mentioned explicitly in main body content',
        status: 'pass',
      },
    ],
  },
  {
    id: 'format',
    icon: '?',
    title: 'Format & FAQ Coverage',
    subtitle: 'Structural signals and question answering',
    maxScore: 15,
    placeholderScore: 11,
    items: [
      {
        label: 'H2/H3 Structure',
        detail: 'Proper heading hierarchy with descriptive, keyword-rich headers',
        status: 'pass',
      },
      {
        label: 'FAQ Section',
        detail: '6–8 Q&A pairs in FAQPage schema-ready format',
        status: 'fail',
      },
      {
        label: 'BLUF Sections',
        detail: 'Bottom Line Up Front — direct answer leads each major section',
        status: 'warn',
      },
    ],
  },
];

const SIGNAL_SECTION_MAP: Record<string, string> = {
  Citability: 'content',
  'Schema Health': 'schema',
  'Factual Density': 'factual',
  'Format Quality': 'format',
};

function scoreColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'text-green-600';
  if (pct >= 65) return 'text-amber-500';
  return 'text-red-500';
}

function StatusDot({ status }: { status: SubItem['status'] }) {
  if (status === 'pass')
    return (
      <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-[10px] font-black flex items-center justify-center shrink-0">
        ✓
      </span>
    );
  if (status === 'fail')
    return (
      <span className="w-5 h-5 rounded-full bg-red-100 text-red-500 text-[10px] font-black flex items-center justify-center shrink-0">
        ✕
      </span>
    );
  if (status === 'warn')
    return (
      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-500 text-[10px] font-black flex items-center justify-center shrink-0">
        !
      </span>
    );
  return <span className="w-5 h-5 rounded-full bg-gray-100 shrink-0" />;
}

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url || 'yoursite.com';
  }
}

// ─── Strategy Panel ──────────────────────────────────────────────────────────

interface StrategyPanelProps {
  auditOutput: string;
  strategyOutput: string;
  isStreaming: boolean;
  error: string;
  onGenerate: () => void;
}

function StrategyPanel({
  auditOutput,
  strategyOutput,
  isStreaming,
  error,
  onGenerate,
}: StrategyPanelProps) {
  const hasAudit = !!auditOutput;
  const hasStrategy = !!strategyOutput;
  const isPlaceholder = !hasStrategy;

  // Parse strategy data
  const currentScore = parseStrategyCurrentScore(strategyOutput);
  const quickWinsCount = parseStrategyQuickWinsCount(strategyOutput);
  const projectedScore = parseStrategyProjectedScore(strategyOutput);
  const projection = parseStrategyProjection(strategyOutput);
  const quickWins = parseStrategyQuickWins(strategyOutput);
  const plan = parseStrategy30DayPlan(strategyOutput);
  const schemaChecklist = parseStrategySchemaChecklist(strategyOutput);
  const contentGaps = parseStrategyContentGaps(strategyOutput);

  // Placeholder values shown at opacity-80 before data
  const displayScore = currentScore ?? 62;
  const displayQW = quickWinsCount ?? 5;
  const displayProjected = projectedScore ?? 81;

  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-gray-400';

  if (!hasAudit) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-12 flex flex-col items-center justify-center text-center space-y-3">
        <span className="text-4xl text-gray-200">→</span>
        <p className="text-sm font-bold text-gray-400">Strategy Report</p>
        <p className="text-xs text-gray-300">
          Run a full audit first to generate your strategy roadmap.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate button or streaming indicator */}
      {!hasStrategy && !isStreaming && (
        <div className="bg-white rounded-2xl shadow-card p-6 flex items-center justify-between gap-4 print:hidden">
          <div>
            <p className="text-sm font-bold text-gray-900">
              Audit complete — ready to generate strategy
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              AI will synthesize your audit findings into a prioritized action roadmap.
            </p>
          </div>
          <button
            onClick={onGenerate}
            className="shrink-0 bg-brand-purple text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-brand-purple/90 transition-colors whitespace-nowrap"
          >
            → Generate Strategy
          </button>
        </div>
      )}
      {isStreaming && (
        <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3 print:hidden">
          <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse shrink-0" />
          <p className="text-sm text-gray-500">Generating strategy roadmap…</p>
        </div>
      )}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div
        className={`grid grid-cols-3 gap-4 transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
      >
        {[
          { label: 'Current GEO Score', value: displayScore, sub: '/ 100' },
          { label: 'Quick Wins', value: displayQW, sub: 'this week' },
          { label: 'Projected Score', value: displayProjected, sub: 'after full plan' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl shadow-card p-5">
            <p className={`${labelCls} mb-3`}>{card.label}</p>
            <p className="text-[2.5rem] font-black tabular-nums leading-none text-gray-900">
              {card.value}
            </p>
            <p className="text-sm text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Wins */}
      <div
        className={`bg-white rounded-2xl shadow-card overflow-hidden transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className={labelCls}>Quick Wins</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              Do this week — under 30 min each
            </p>
          </div>
          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
            {quickWins.length || displayQW} tasks
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {(quickWins.length > 0
            ? quickWins
            : [
                {
                  action: 'Rewrite intro paragraph using BLUF format — lead with direct answer',
                  time: '~15min',
                },
                {
                  action: 'Add business name and location to first paragraph explicitly',
                  time: '~5min',
                },
                {
                  action: 'Add founding year and one verifiable credential to the content',
                  time: '~10min',
                },
                { action: 'Install LocalBusiness JSON-LD schema markup', time: '~20min' },
                { action: 'Add FAQ section with 5 natural-language Q&A pairs', time: '~30min' },
              ]
          ).map((win, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-6 py-3.5 hover:bg-brand-lavender/40 transition-colors cursor-default"
            >
              <span className="w-6 h-6 rounded-full bg-brand-purple/10 text-brand-purple text-[10px] font-black flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-gray-800 flex-1">{win.action}</p>
              {win.time && (
                <span className="text-[10px] font-bold text-gray-400 shrink-0 whitespace-nowrap">
                  {win.time}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 30-Day Plan */}
      <div
        className={`bg-white rounded-2xl shadow-card overflow-hidden transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <p className={labelCls}>30-Day Action Plan</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">
            Week-by-week implementation roadmap
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {(plan.length > 0
            ? plan
            : [
                {
                  title: 'Content Foundation',
                  tasks: [
                    'Rewrite service page intro with BLUF format',
                    'Add entity anchor paragraph with business name, location, and credentials',
                    'Replace vague claims with specific facts and numbers',
                  ],
                },
                {
                  title: 'Schema & Technical',
                  tasks: [
                    'Install LocalBusiness JSON-LD schema',
                    'Add FAQPage schema to FAQ section',
                    'Validate schema at search.google.com/test/rich-results',
                  ],
                },
                {
                  title: 'Entity & Authority',
                  tasks: [
                    'Audit NAP consistency across Google, Yelp, directories',
                    'Complete Google Business Profile to 100%',
                    'Add sameAs links to all external profiles in schema',
                  ],
                },
                {
                  title: 'Review & Optimize',
                  tasks: [
                    'Re-run GEO Analyzer to track score improvement',
                    'Test target query in ChatGPT and Perplexity',
                    'Address any remaining yellow or red signals',
                  ],
                },
              ]
          ).map((week, i) => (
            <div
              key={i}
              className="px-6 py-4 hover:bg-brand-lavender/40 transition-colors cursor-default"
            >
              <p className="text-xs font-black text-brand-purple mb-2">
                WEEK {i + 1} — {week.title.toUpperCase()}
              </p>
              <ul className="space-y-1.5">
                {week.tasks.map((task, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-gray-300 mt-0.5 shrink-0">•</span>
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Schema Checklist + Content Gaps */}
      <div
        className={`grid grid-cols-2 gap-4 transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
      >
        {/* Schema Checklist */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className={labelCls}>Schema Checklist</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">Structured data to implement</p>
          </div>
          <div className="px-6 py-4 space-y-3">
            {(schemaChecklist.length > 0
              ? schemaChecklist
              : [
                  { item: 'LocalBusiness JSON-LD', reason: 'Primary entity signal for AI engines' },
                  { item: 'FAQPage Schema', reason: 'Boosts FAQ visibility in AI Overviews' },
                  { item: 'Service Schema', reason: 'Links services to your entity' },
                  { item: 'sameAs Array', reason: 'Connects external profiles to entity' },
                ]
            ).map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded border-2 border-gray-200 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.item}</p>
                  {s.reason && <p className="text-xs text-gray-400 mt-0.5">{s.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Gaps */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className={labelCls}>Content Gaps</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              Topics AI engines expect to find
            </p>
          </div>
          <div className="px-6 py-4 space-y-3">
            {(contentGaps.length > 0
              ? contentGaps
              : [
                  {
                    title: 'Pricing & What to Expect',
                    reason: 'AI answers frequently include cost context',
                  },
                  {
                    title: 'Certifications & Credentials',
                    reason: 'Trust signals AI systems prioritize',
                  },
                  {
                    title: 'Service Process / How It Works',
                    reason: 'Process detail drives topical authority',
                  },
                  {
                    title: 'FAQ — 8+ Q&A pairs',
                    reason: 'AI systems extract FAQ content directly',
                  },
                  {
                    title: 'Local Area Service Coverage',
                    reason: 'Geographic signals for local AI queries',
                  },
                ]
            ).map((g, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xs font-black text-gray-300 mt-0.5 shrink-0 w-4">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{g.title}</p>
                  {g.reason && <p className="text-xs text-gray-400 mt-0.5">{g.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projected Impact */}
      {(projection || isPlaceholder) && (
        <div
          className={`bg-white rounded-2xl shadow-card p-6 transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
        >
          <p className={`${labelCls} mb-4`}>Projected Impact</p>
          <div className="flex items-center gap-4">
            {[
              { label: 'Now', value: projection?.current ?? displayScore, cls: 'text-red-500' },
              {
                label: 'After Quick Wins',
                value: projection?.afterQuickWins ?? Math.round(displayScore * 1.1),
                cls: 'text-amber-500',
              },
              {
                label: 'After 30-Day Plan',
                value: projection?.afterFullPlan ?? displayProjected,
                cls: 'text-green-600',
              },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-4">
                <div className="text-center">
                  <p className={`text-3xl font-black tabular-nums ${step.cls}`}>{step.value}</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wide">
                    {step.label}
                  </p>
                </div>
                {i < arr.length - 1 && <span className="text-gray-200 text-xl font-black">→</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export function MarketingAuditTab({
  apiKey,
  provider,
  model,
  url,
  onUrlChange,
  onTabChange,
}: MarketingAuditTabProps) {
  const [subTab, setSubTab] = useState<'audit' | 'strategy'>('audit');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [geoScore, setGeoScore] = useState<number | null>(null);
  const [geoSignals, setGeoSignals] = useState<Signal[]>([]);
  const [sectionScores, setSectionScores] = useState<Record<string, number>>({});
  const [cachedReport, setCachedReportState] = useState<CachedReport | null>(null);

  const {
    output: streamOutput,
    isStreaming,
    error: streamError,
    timing,
    run,
    reset,
  } = useStream('/api/marketing-audit');
  const {
    output: strategyOutput,
    isStreaming: isStrategyStreaming,
    error: strategyError,
    timing: strategyTiming,
    run: runStrategy,
    reset: resetStrategy,
  } = useStream('/api/strategy');
  const output = cachedReport?.text || streamOutput;

  useEffect(() => {
    if (!output) return;
    const seo = parseAuditScore(output);
    if (seo !== null) setSeoScore(seo);
    const geo = parseGeoScore(output);
    if (geo !== null) setGeoScore(geo);
    const geoSigs = parseSignals(output);
    if (geoSigs.length > 0) {
      setGeoSignals(geoSigs);
      const scores: Record<string, number> = {};
      for (const sig of geoSigs) {
        const sectionId = SIGNAL_SECTION_MAP[sig.name];
        if (sectionId) scores[sectionId] = (scores[sectionId] ?? 0) + sig.score;
      }
      setSectionScores(scores);
    }
  }, [output]);

  useEffect(() => {
    if (!isStreaming && streamOutput && url.trim()) {
      setCachedReport(cacheKey('audit', url.trim()), streamOutput, provider, model);
      // Save full audit to Supabase — the deep report for thesis documentation
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'audit',
          url: url.trim(),
          reportText: streamOutput,
          geoScore,
          signals: geoSignals,
          provider,
          model,
          durationMs: timing.durationMs,
          timeToFirstTokenMs: timing.timeToFirstTokenMs,
        }),
      }).catch(() => {});
    }
  }, [isStreaming, streamOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save strategy report to Supabase when streaming completes
  useEffect(() => {
    if (!isStrategyStreaming && strategyOutput && url.trim()) {
      const projection = parseStrategyProjection(strategyOutput);
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'strategy',
          url: url.trim(),
          reportText: strategyOutput,
          geoScore: projection?.current ?? geoScore,
          provider,
          model,
          durationMs: strategyTiming.durationMs,
          timeToFirstTokenMs: strategyTiming.timeToFirstTokenMs,
        }),
      }).catch(() => {});
    }
  }, [isStrategyStreaming, strategyOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAudit = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please add your API key — click the provider button in the top right.');
      return;
    }
    if (!url.trim()) {
      setValidationError('Please enter a URL above.');
      return;
    }

    setValidationError('');
    setSeoScore(null);
    setGeoScore(null);
    setGeoSignals([]);
    setSectionScores({});
    setCachedReportState(null);

    const key = cacheKey('audit', url.trim());
    const cached = getCachedReport(key);
    if (cached) {
      setCachedReportState(cached);
      return;
    }

    setIsFetching(true);
    try {
      const { text } = await fetchPageContent(url);
      setIsFetching(false);
      run({ content: text, apiKey: apiKey.trim(), provider, model });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to fetch page.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleReset = () => {
    reset();
    resetStrategy();
    setSeoScore(null);
    setGeoScore(null);
    setGeoSignals([]);
    setSectionScores({});
    setCachedReportState(null);
    setValidationError('');
  };

  const handleRefresh = () => {
    bustCache(cacheKey('audit', url.trim()));
    setCachedReportState(null);
    reset();
    handleAudit();
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isLoading = isFetching || isStreaming;
  const loadingLabel = isFetching ? 'Fetching page…' : 'Running audit…';
  const error = validationError || streamError;
  const hasOutput = geoScore !== null || seoScore !== null;
  const isPlaceholder = !hasOutput;

  // Stat card values
  const displayGeoScore = geoScore ?? null;
  const signalsPassing = geoSignals.filter((s) => s.emoji === 'pass').length;
  const quickWins = geoSignals.filter((s) => s.emoji === 'fail' || s.emoji === 'warn').length;
  const projectedScore = geoScore !== null ? Math.min(100, geoScore + quickWins * 4) : null;

  const handleExportPdf = () => {
    generateAuditPdf({
      url,
      provider,
      model,
      geoScore,
      seoScore,
      geoSignals,
      auditOutput: output,
      strategyOutput: strategyOutput || undefined,
      mode: subTab === 'strategy' ? 'strategy' : 'audit',
    });
  };

  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-gray-400';
  const inputCls =
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent placeholder:text-gray-300';
  const domain = parseDomain(url);

  return (
    <div className="space-y-6">
      {/* Print-only header — hidden on screen, visible when printing */}
      <div className="hidden print:block pb-5 mb-2 border-b-2 border-gray-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              GEO Analyzer
            </p>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              {subTab === 'strategy' ? 'Strategy Report' : 'Marketing Audit Report'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{url || domain}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Generated</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {provider} · {model}
            </p>
          </div>
        </div>
      </div>

      {/* Page header — hidden when printing */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
            Marketing Hub
          </p>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            Audit &amp; Strategy Report
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {domain} · {hasOutput ? 'Last analyzed today' : 'Not yet analyzed'}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleExportPdf}
            disabled={subTab === 'audit' ? !hasOutput : !strategyOutput}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↓ Export {subTab === 'strategy' ? 'Strategy' : 'Audit'} PDF
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            ⧉ Share Report
          </button>
        </div>
      </div>

      {/* Input card — hidden when printing */}
      <div className="bg-white rounded-2xl shadow-card p-6 space-y-4 print:hidden">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className={`${labelCls} mb-2`}>Page URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
              placeholder="https://yoursite.com/service-page"
              className={inputCls}
            />
          </div>
          <div className="shrink-0">
            <SubmitButton
              isLoading={isLoading}
              label="◈ Run Full Audit"
              loadingLabel={loadingLabel}
              onClick={handleAudit}
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

      {/* Sub-tab toggle — hidden when printing */}
      <div className="bg-white rounded-2xl shadow-card p-1.5 flex gap-1.5 print:hidden">
        <button
          onClick={() => setSubTab('audit')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${subTab === 'audit' ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          ◇ Marketing Audit
        </button>
        <button
          onClick={() => setSubTab('strategy')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${subTab === 'strategy' ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          → Strategy Report
        </button>
      </div>

      {subTab === 'audit' && (
        <>
          {/* 4 stat cards */}
          <div
            className={`grid grid-cols-4 gap-4 transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
          >
            {[
              {
                label: 'GEO Score',
                value: displayGeoScore ?? '—',
                sub: `/ 100 · ${displayGeoScore !== null ? getScoreStatus(displayGeoScore) : '—'}`,
              },
              {
                label: 'Signals Passing',
                value: hasOutput ? signalsPassing : '—',
                sub: `of ${geoSignals.length || 6} signals`,
              },
              { label: 'Quick Wins', value: hasOutput ? quickWins : '—', sub: 'under 30 min each' },
              { label: 'Projected Score', value: projectedScore ?? '—', sub: 'after fixes' },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl shadow-card p-5">
                <p className={`${labelCls} mb-3`}>{card.label}</p>
                <p className="text-[2.5rem] font-black tabular-nums leading-none text-gray-900">
                  {card.value}
                </p>
                <p className="text-sm text-gray-400 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Collapsible audit sections */}
          <div className={`space-y-3 transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}>
            {AUDIT_SECTIONS.map((section) => {
              const isOpen = openSections.has(section.id);
              const realScore = sectionScores[section.id] ?? null;
              const displayScore = realScore ?? section.placeholderScore;
              const colorCls = scoreColor(displayScore, section.maxScore);

              return (
                <div key={section.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
                  {/* Accordion header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50/50 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-black text-gray-600 shrink-0">
                      {section.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{section.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{section.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-black tabular-nums ${colorCls}`}>
                        {displayScore}/{section.maxScore}
                      </span>
                      <span
                        className={`text-gray-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      >
                        ▾
                      </span>
                    </div>
                  </button>

                  {/* Expanded sub-items */}
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {section.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 px-6 py-3.5 hover:bg-brand-lavender/40 transition-colors cursor-default"
                        >
                          <StatusDot status={item.status} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Rewrite CTA — after audit completes, hidden when printing */}
          {hasOutput && !isLoading && (
            <div className="bg-brand-purple rounded-2xl p-5 flex items-center justify-between gap-4 print:hidden">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
                  Next Step
                </p>
                <p className="text-white font-bold text-sm">
                  Audit complete — apply the fixes with Content Rewriter
                </p>
                <p className="text-white/60 text-xs mt-0.5">
                  GEO {geoScore}/100. Use the Content Rewriter to apply the improvements above.
                </p>
              </div>
              <button
                onClick={() => onTabChange?.('rewrite')}
                className="shrink-0 bg-white text-brand-purple font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-brand-lavender transition-colors whitespace-nowrap"
              >
                ↺ Rewrite Content →
              </button>
            </div>
          )}
        </>
      )}

      {subTab === 'strategy' && (
        <StrategyPanel
          auditOutput={output}
          strategyOutput={strategyOutput}
          isStreaming={isStrategyStreaming}
          error={strategyError}
          onGenerate={() => runStrategy({ auditReport: output, apiKey, provider, model })}
        />
      )}
    </div>
  );
}
