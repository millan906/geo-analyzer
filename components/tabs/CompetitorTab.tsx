'use client';

import { useState } from 'react';
import { useStream } from '@/lib/hooks/useStream';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PROVIDERS, type ProviderId } from '@/lib/providers';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StreamingOutput } from '@/components/ui/StreamingOutput';

interface CompetitorTabProps {
  apiKey: string;
  provider: string;
  model: string;
}

export function CompetitorTab({ apiKey, provider, model }: CompetitorTabProps) {
  const [myUrl, setMyUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const { output, isStreaming, error: streamError, run, reset } = useStream('/api/competitor');

  const fetchOne = async (url: string) => {
    const res = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed to fetch page.');
    return data.text as string;
  };

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please add your API key — click the provider button in the top right.');
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
    setValidationError('');
    setMyUrl('');
    setCompetitorUrl('');
    setTargetQuery('');
  };

  const isLoading = isFetching || isStreaming;
  const loadingLabel = isFetching ? 'Fetching pages…' : 'Analyzing…';
  const error = validationError || streamError;

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-indigo-900 mb-1">Competitor GEO Gap Analysis</p>
        <p className="text-xs text-indigo-700">
          Enter your URL and a competitor's URL. {PROVIDERS[provider as ProviderId]?.name ?? 'AI'}{' '}
          fetches both pages and diagnoses why they show up in AI answers instead of you — plus 3
          displacement plays.
        </p>
      </div>

      {/* Two URL inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Page URL</label>
          <input
            type="url"
            value={myUrl}
            onChange={(e) => setMyUrl(e.target.value)}
            placeholder="https://yoursite.com/page"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-400">The page NOT appearing in AI answers</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Competitor Page URL
          </label>
          <input
            type="url"
            value={competitorUrl}
            onChange={(e) => setCompetitorUrl(e.target.value)}
            placeholder="https://competitor.com/page"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-400">The page that IS appearing in AI answers</p>
        </div>
      </div>

      {/* Optional query */}
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
          placeholder={`e.g. "best divorce lawyer in Chicago"`}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

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
            label="⚡ Analyze Gap"
            loadingLabel={loadingLabel}
            onClick={handleAnalyze}
          />
        </div>
      </div>

      <ErrorBanner error={error} />
      <StreamingOutput
        output={output}
        isStreaming={isStreaming}
        label="Competitor Gap Report"
        copyLabel="⎘ Copy Report"
      />
    </div>
  );
}
