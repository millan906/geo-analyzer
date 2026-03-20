'use client';

import { useState } from 'react';
import { useStream } from '@/lib/hooks/useStream';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PROVIDERS, type ProviderId } from '@/lib/providers';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StreamingOutput } from '@/components/ui/StreamingOutput';

interface MarketingAuditTabProps {
  apiKey: string;
  provider: string;
  model: string;
  url: string;
}

export function MarketingAuditTab({ apiKey, provider, model, url }: MarketingAuditTabProps) {
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const { output, isStreaming, error: streamError, run, reset } = useStream('/api/marketing-audit');

  const handleAudit = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please add your API key — click the provider button in the top right.');
      return;
    }
    if (!url.trim()) {
      setValidationError('No URL found — run a GEO analysis first in the Analyze tab.');
      return;
    }

    setValidationError('');
    setIsFetching(true);

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
      run({ content: data.text, apiKey: apiKey.trim(), provider, model });
    } catch {
      setValidationError('Network error. Please try again.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleReset = () => {
    reset();
    setValidationError('');
  };

  const isLoading = isFetching || isStreaming;
  const loadingLabel = isFetching ? 'Fetching page…' : 'Auditing…';
  const error = validationError || streamError;

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-indigo-900 mb-1">Marketing Audit + AI Ranking</p>
        <p className="text-xs text-indigo-700 mb-3">
          Enter any URL — {PROVIDERS[provider as ProviderId]?.name ?? 'AI'} audits it across 6
          marketing dimensions and estimates how it ranks in AI search results vs. competitors.
          Includes a prioritized improvement roadmap.
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'GEO Score', pts: '30pts', color: 'indigo' },
            { label: 'SEO', pts: '20pts', color: 'blue' },
            { label: 'Content', pts: '20pts', color: 'violet' },
            { label: 'Social Proof', pts: '15pts', color: 'purple' },
            { label: 'Brand Clarity', pts: '10pts', color: 'fuchsia' },
            { label: 'CTA', pts: '5pts', color: 'pink' },
          ].map((d) => (
            <div
              key={d.label}
              className="bg-white rounded-lg p-2 text-center border border-indigo-100"
            >
              <p className="text-[10px] font-bold text-gray-500">{d.label}</p>
              <p className="text-xs font-bold text-indigo-700">{d.pts}</p>
            </div>
          ))}
        </div>
      </div>

      {url && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-700 font-medium truncate">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
          {url}
        </div>
      )}

      <div className="flex items-center justify-between">
        {(output || isLoading) && !isLoading && (
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
            label="◈ Run Marketing Audit"
            loadingLabel={loadingLabel}
            onClick={handleAudit}
          />
        </div>
      </div>

      <ErrorBanner error={error} />
      <StreamingOutput
        output={output}
        isStreaming={isStreaming}
        label="Marketing Audit Report"
        copyLabel="⎘ Copy Report"
      />
    </div>
  );
}
