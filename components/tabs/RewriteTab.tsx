'use client';

import { useState } from 'react';
import { useStream } from '@/lib/hooks/useStream';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StreamingOutput } from '@/components/ui/StreamingOutput';

interface RewriteTabProps {
  apiKey: string;
  provider: string;
  model: string;
}

export function RewriteTab({ apiKey, provider, model }: RewriteTabProps) {
  const [url, setUrl] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const { output, isStreaming, error: streamError, run, reset } = useStream('/api/rewrite');

  const handleRewrite = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please add your API key — click the provider button in the top right.');
      return;
    }
    if (!url.trim()) {
      setValidationError('Please enter a URL.');
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
      run({
        content: data.text,
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

  const isLoading = isFetching || isStreaming;
  const loadingLabel = isFetching ? 'Fetching page…' : 'Rewriting…';
  const error = validationError || streamError;

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-indigo-900 mb-1">GEO Content Rewriter</p>
        <p className="text-xs text-indigo-700">
          Enter your page URL — Claude rewrites it with BLUF intro, H2/H3 structure, FAQ block, and
          entity signals to maximize AI citability.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Page URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRewrite()}
          placeholder="https://yoursite.com/service-page"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

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
          placeholder={`e.g. "best plumber in Austin TX"`}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="flex justify-end">
        <SubmitButton
          isLoading={isLoading}
          label="↺ Rewrite for GEO"
          loadingLabel={loadingLabel}
          onClick={handleRewrite}
        />
      </div>

      <ErrorBanner error={error} />
      <StreamingOutput
        output={output}
        isStreaming={isStreaming}
        label="GEO-Optimized Rewrite"
        copyLabel="⎘ Copy Rewrite"
      />
    </div>
  );
}
