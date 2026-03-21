'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { getScoreStatus, getScoreColor } from '@/lib/parse-geo';

interface Report {
  id: string;
  type: 'analyze' | 'rewrite' | 'competitor' | 'audit';
  url: string;
  geo_score: number;
  target_query: string | null;
  provider: string;
  model: string;
  report_text: string;
  created_at: string;
  updated_at: string;
  duration_ms: number | null;
  time_to_first_token_ms: number | null;
  score_before: number | null;
  score_after: number | null;
  signals_fixed: number | null;
  competitor_url: string | null;
  competitor_score: number | null;
}

const TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  analyze: { label: 'Analyze', cls: 'bg-brand-purple/10 text-brand-purple border-brand-purple/20' },
  rewrite: { label: 'Rewrite', cls: 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20' },
  competitor: { label: 'Competitor', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  audit: { label: 'Audit', cls: 'bg-green-50 text-green-700 border-green-200' },
  strategy: { label: 'Strategy', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
};

function exportCsv(reports: Report[]) {
  const headers = [
    'type',
    'url',
    'geo_score',
    'score_before',
    'score_after',
    'signals_fixed',
    'competitor_url',
    'competitor_score',
    'target_query',
    'provider',
    'model',
    'duration_ms',
    'time_to_first_token_ms',
    'created_at',
  ];
  const rows = reports.map((r) =>
    headers
      .map((h) => {
        const val = (r as any)[h] ?? '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      })
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `geo-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}
function parsePath(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '') + u.pathname;
  } catch {
    return url;
  }
}
const SCORE_STATUS_CLS = {
  green: 'border-green-300 bg-green-50 text-green-700',
  yellow: 'border-amber-300 bg-amber-50 text-amber-600',
  red: 'border-red-300 bg-red-50 text-red-600',
} as const;
const SCORE_COLOR_CLS = {
  green: 'text-green-600',
  yellow: 'text-amber-500',
  red: 'text-red-500',
} as const;
function scoreStatus(score: number) {
  return { label: getScoreStatus(score), cls: SCORE_STATUS_CLS[getScoreColor(score)] };
}
function scoreColor(score: number) {
  return SCORE_COLOR_CLS[getScoreColor(score)];
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 1) return 'Just now';
  if (diffH < 24)
    return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  if (diffH < 48)
    return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function ScoreChart({ reports }: { reports: Report[] }) {
  const sorted = [...reports]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-12);
  if (sorted.length < 2) return null;

  const scores = sorted.map((r) => r.geo_score);
  const minS = Math.max(0, Math.min(...scores) - 8);
  const maxS = Math.min(100, Math.max(...scores) + 6);
  const range = maxS - minS || 1;
  const W = 1000,
    H = 110,
    PX = 24,
    PY = 16;

  const pts = scores.map((s, i) => ({
    x: PX + (i / (scores.length - 1)) * (W - PX * 2),
    y: PY + ((maxS - s) / range) * (H - PY * 2),
    s,
  }));
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const last = pts[pts.length - 1];
  const trend = scores[scores.length - 1] - scores[0];

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-900">GEO Score Over Time</p>
        <p className="text-xs text-gray-400">
          {parseDomain(sorted[0].url)} · last {sorted.length} analyses
        </p>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
          {/* Gradient fill */}
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B35D5" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#5B35D5" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Fill area */}
          <polygon points={`${pts[0].x},${H} ${polyline} ${last.x},${H}`} fill="url(#chartGrad)" />
          {/* Line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#5B35D5"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Dots */}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#5B35D5" />
          ))}
          {/* Score labels under dots */}
          {pts.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={H}
              textAnchor="middle"
              fontSize="11"
              fill="#9CA3AF"
              fontFamily="inherit"
            >
              {p.s}
            </text>
          ))}
        </svg>
        {/* Latest score callout */}
        <div className="absolute top-0 right-0 flex items-center gap-1 text-brand-purple font-black text-sm">
          <span>{scores[scores.length - 1]}</span>
          <span className="text-xs">{trend >= 0 ? '↑' : '↓'}</span>
        </div>
      </div>
    </div>
  );
}

// Placeholder data shown when no reports yet
const PLACEHOLDER_REPORTS: Report[] = [
  {
    id: 'p1',
    type: 'analyze',
    url: 'https://yoursite.com/service-page',
    geo_score: 84,
    target_query: 'best printing NJ',
    provider: 'gemini',
    model: '',
    report_text: '',
    duration_ms: null,
    time_to_first_token_ms: null,
    score_before: null,
    score_after: null,
    signals_fixed: null,
    competitor_url: null,
    competitor_score: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'p2',
    type: 'rewrite',
    url: 'https://yoursite.com/about',
    geo_score: 71,
    target_query: 'about us page',
    provider: 'gemini',
    model: '',
    report_text: '',
    duration_ms: null,
    time_to_first_token_ms: null,
    score_before: 52,
    score_after: 71,
    signals_fixed: 3,
    competitor_url: null,
    competitor_score: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'p3',
    type: 'competitor',
    url: 'https://yoursite.com/service-page',
    geo_score: 65,
    target_query: 'best printing NJ',
    provider: 'gemini',
    model: '',
    report_text: '',
    duration_ms: null,
    time_to_first_token_ms: null,
    score_before: null,
    score_after: null,
    signals_fixed: null,
    competitor_url: 'competitor.com',
    competitor_score: 79,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'p4',
    type: 'audit',
    url: 'https://yoursite.com/contact',
    geo_score: 38,
    target_query: 'contact page',
    provider: 'gemini',
    model: '',
    report_text: '',
    duration_ms: null,
    time_to_first_token_ms: null,
    score_before: null,
    score_after: null,
    signals_fixed: null,
    competitor_url: null,
    competitor_score: null,
    created_at: new Date(Date.now() - 518400000).toISOString(),
    updated_at: new Date(Date.now() - 518400000).toISOString(),
  },
  {
    id: 'p5',
    type: 'analyze',
    url: 'https://yoursite.com/blog/geo-guide',
    geo_score: 78,
    target_query: 'what is GEO',
    provider: 'gemini',
    model: '',
    report_text: '',
    duration_ms: null,
    time_to_first_token_ms: null,
    score_before: null,
    score_after: null,
    signals_fixed: null,
    competitor_url: null,
    competitor_score: null,
    created_at: new Date(Date.now() - 777600000).toISOString(),
    updated_at: new Date(Date.now() - 777600000).toISOString(),
  },
];

export function HistoryTab() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch('/api/reports')
      .then((r) => r.json())
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [session]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch('/api/reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setReports((prev) => prev.filter((r) => r.id !== id));
    setDeleting(null);
  };

  // Compute stats
  const displayReports = session && reports.length > 0 ? reports : PLACEHOLDER_REPORTS;
  const isPlaceholder = !session || reports.length === 0;
  const scores = displayReports.map((r) => r.geo_score);
  const bestReport = displayReports.reduce(
    (a, b) => (a.geo_score > b.geo_score ? a : b),
    displayReports[0]
  );
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const sorted = [...displayReports].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const trend = sorted.length >= 2 ? sorted[sorted.length - 1].geo_score - sorted[0].geo_score : 0;

  // Score change per row (vs previous analysis of same URL)
  function getChange(report: Report, idx: number): number | null {
    const sameUrl = displayReports.slice(idx + 1).find((r) => r.url === report.url);
    if (!sameUrl) return null;
    return report.geo_score - sameUrl.geo_score;
  }

  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-gray-400';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
            History
          </p>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Past Analyses</h2>
          <p className="text-sm text-gray-500 mt-1">Track how your GEO score changes over time</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => exportCsv(session && reports.length > 0 ? reports : PLACEHOLDER_REPORTS)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            ↓ Export CSV
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            ⧉ Share
          </button>
        </div>
      </div>

      {/* Sign-in prompt */}
      {!session && (
        <div className="bg-white rounded-2xl shadow-card p-8 flex flex-col items-center text-center space-y-3">
          <p className="font-bold text-gray-900">Sign in to save your report history</p>
          <p className="text-sm text-gray-400">
            All your past GEO analyses will be saved here automatically.
          </p>
          <button
            onClick={() => signIn('google')}
            className="bg-brand-purple hover:bg-[#4E2EC4] text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors mt-2"
          >
            Sign in with Google — it's free
          </button>
        </div>
      )}

      {/* Stat cards — always visible (placeholder when no data) */}
      <div
        className={`grid grid-cols-4 gap-4 transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
      >
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className={`${labelCls} mb-3`}>Analyses Run</p>
          <p className="text-[2.5rem] font-black tabular-nums leading-none text-gray-900">
            {displayReports.length}
          </p>
          <p className="text-sm text-gray-400 mt-1">all time</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className={`${labelCls} mb-3`}>Best Score</p>
          <p className="text-[2.5rem] font-black tabular-nums leading-none text-green-600">
            {bestReport?.geo_score ?? '—'}
          </p>
          <p className="text-sm text-green-600 font-semibold mt-1 truncate">
            ↑ {parsePath(bestReport?.url ?? '')}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className={`${labelCls} mb-3`}>Avg Score</p>
          <p className="text-[2.5rem] font-black tabular-nums leading-none text-gray-900">
            {avgScore}
          </p>
          <p className="text-sm text-gray-400 mt-1">across all pages</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className={`${labelCls} mb-3`}>Score Trend</p>
          <p
            className={`text-[2.5rem] font-black tabular-nums leading-none ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}
          >
            {trend >= 0 ? '+' : ''}
            {trend}
          </p>
          <p
            className={`text-sm font-semibold mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}
          >
            {trend >= 0 ? '↑' : '↓'} pts this month
          </p>
        </div>
      </div>

      {/* Score chart */}
      <div className={`transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}>
        <ScoreChart reports={displayReports} />
      </div>

      {/* History table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-gray-400 animate-pulse">Loading reports…</p>
        </div>
      ) : (
        <div
          className={`bg-white rounded-2xl shadow-card overflow-hidden transition-opacity ${isPlaceholder ? 'opacity-80' : ''}`}
        >
          {/* Table header */}
          <div className="grid grid-cols-[1fr_72px_80px_140px_160px_120px] px-6 py-3 border-b border-gray-100">
            {['Page', 'Score', 'Change', 'Status', 'Query', 'Actions'].map((h) => (
              <span key={h} className={labelCls}>
                {h}
              </span>
            ))}
          </div>

          <div className="divide-y divide-gray-100">
            {displayReports.map((report, idx) => {
              const change = getChange(report, idx);
              const status = scoreStatus(report.geo_score);
              const isExp = expanded === report.id;

              return (
                <div key={report.id}>
                  <div className="grid grid-cols-[1fr_72px_80px_140px_160px_120px] px-6 py-4 items-center hover:bg-brand-lavender/40 transition-colors cursor-default">
                    {/* Page */}
                    <div>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {parsePath(report.url)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {(() => {
                          const t = TYPE_STYLES[report.type ?? 'analyze'] ?? TYPE_STYLES.analyze;
                          return (
                            <span
                              className={`inline-flex text-[9px] font-black px-2 py-0.5 rounded-full border ${t.cls}`}
                            >
                              {t.label}
                            </span>
                          );
                        })()}
                        <p className="text-xs text-gray-400">{formatDate(report.updated_at)}</p>
                      </div>
                    </div>
                    {/* Score */}
                    <span
                      className={`text-xl font-black tabular-nums ${scoreColor(report.geo_score)}`}
                    >
                      {report.geo_score}
                    </span>
                    {/* Change */}
                    <span
                      className={`text-sm font-bold ${change === null ? 'text-gray-300' : change >= 0 ? 'text-green-600' : 'text-red-500'}`}
                    >
                      {change === null ? '—' : change >= 0 ? `↑ +${change}` : `↓ ${change}`}
                    </span>
                    {/* Status */}
                    <span
                      className={`inline-flex w-fit text-[10px] font-black px-3 py-1 rounded-full border whitespace-nowrap ${status.cls}`}
                    >
                      {status.label}
                    </span>
                    {/* Query */}
                    <span className="text-xs text-gray-500 truncate pr-3">
                      {report.target_query || <span className="text-gray-300">—</span>}
                    </span>
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpanded(isExp ? null : report.id)}
                        className="text-xs font-semibold text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {isExp ? 'Hide' : 'View'}
                      </button>
                      {session && (
                        <button
                          onClick={() => handleDelete(report.id)}
                          disabled={deleting === report.id}
                          title="Delete"
                          className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-80"
                        >
                          {deleting === report.id ? '…' : '↺'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded report */}
                  {isExp && (
                    <div className="px-6 py-5 bg-gray-50 border-t border-gray-100">
                      <pre className="font-mono text-xs leading-relaxed text-gray-600 whitespace-pre-wrap break-words max-h-80 overflow-auto">
                        {report.report_text ||
                          'No report text available for this placeholder entry.'}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
