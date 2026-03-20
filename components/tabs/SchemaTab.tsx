'use client';

import { useState } from 'react';
import { useStream } from '@/lib/hooks/useStream';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PROVIDERS, type ProviderId } from '@/lib/providers';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { StreamingOutput } from '@/components/ui/StreamingOutput';

const BUSINESS_TYPES = [
  'LocalBusiness',
  'Dentist',
  'LegalService',
  'Physician',
  'Plumber',
  'Electrician',
  'RoofingContractor',
  'HVACBusiness',
  'AutoRepair',
  'Restaurant',
  'BeautySalon',
  'HairSalon',
  'Gym',
  'RealEstateAgent',
  'AccountingService',
  'FinancialService',
  'Hotel',
  'SoftwareApplication',
  'Organization',
];

interface SchemaTabProps {
  apiKey: string;
  provider: string;
  model: string;
  url: string;
}

export function SchemaTab({ apiKey, provider, model, url }: SchemaTabProps) {
  const [businessType, setBusinessType] = useState('LocalBusiness');
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const { output, isStreaming, error: streamError, run, reset } = useStream('/api/schema');

  const handleGenerate = async () => {
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
      // Pass the page content as description + services — Claude extracts what it needs
      run({
        businessName: '[Extract from page]',
        businessType,
        description: data.text,
        services: '',
        faqs: '',
        city: '',
        state: '',
        country: '',
        phone: '',
        website: url.trim(),
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
  const loadingLabel = isFetching ? 'Fetching page…' : 'Generating…';
  const error = validationError || streamError;

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-indigo-900 mb-1">GEO Schema Builder</p>
        <p className="text-xs text-indigo-700">
          Enter your page URL and business type — {PROVIDERS[provider as ProviderId]?.name ?? 'AI'}{' '}
          reads the page and generates complete JSON-LD schema ready to paste into Yoast or
          RankMath.
        </p>
      </div>

      <div className="flex gap-3 items-end">
        {url && (
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1.5 font-medium">Page</p>
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-700 font-medium truncate">
              <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
              {url}
            </div>
          </div>
        )}
        <div className="w-52 shrink-0">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business Type</label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton
          isLoading={isLoading}
          label="{} Generate Schema"
          loadingLabel={loadingLabel}
          onClick={handleGenerate}
        />
      </div>

      <ErrorBanner error={error} />
      <StreamingOutput
        output={output}
        isStreaming={isStreaming}
        label="Generated Schema Markup"
        copyLabel="⎘ Copy Schema"
      />
    </div>
  );
}
