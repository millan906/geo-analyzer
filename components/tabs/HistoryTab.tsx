'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';

interface Report {
  id: string;
  url: string;
  geo_score: number;
  target_query: string | null;
  provider: string;
  model: string;
  report_text: string;
  created_at: string;
  updated_at: string;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-green-100 text-green-700 border-green-200'
      : score >= 50
        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
        : 'bg-red-100 text-red-700 border-red-200';
  const emoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${color}`}
    >
      {emoji} {score}/100
    </span>
  );
}

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

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-4xl">🔒</div>
        <p className="font-bold text-gray-900">Sign in to view your report history</p>
        <p className="text-sm text-gray-500">All your past GEO analyses are saved here.</p>
        <button
          onClick={() => signIn('google')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-xl text-sm transition-colors"
        >
          Sign in with Google — it's free
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400 animate-pulse">Loading reports…</div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="text-4xl">📭</div>
        <p className="font-bold text-gray-900">No reports yet</p>
        <p className="text-sm text-gray-500">Run a GEO analysis to see your history here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Report History</h2>
        <span className="text-xs text-gray-400">
          {reports.length} report{reports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {reports.map((report) => (
        <div key={report.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Row */}
          <div className="flex items-center gap-4 px-4 py-3">
            <ScoreBadge score={report.geo_score} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{report.url}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(report.updated_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {report.target_query && (
                  <span className="ml-2 text-indigo-500">· {report.target_query}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-gray-400 hidden sm:block">{report.provider}</span>
              <button
                onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                {expanded === report.id ? 'Hide' : 'View'}
              </button>
              <button
                onClick={() => handleDelete(report.id)}
                disabled={deleting === report.id}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deleting === report.id ? '…' : '✕'}
              </button>
            </div>
          </div>

          {/* Expanded report */}
          {expanded === report.id && (
            <div className="border-t border-gray-100 px-4 py-4 bg-slate-50">
              <pre className="font-mono text-xs leading-relaxed text-slate-700 whitespace-pre-wrap break-words max-h-96 overflow-auto">
                {report.report_text}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
