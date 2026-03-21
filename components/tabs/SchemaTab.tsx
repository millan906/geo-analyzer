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

const IMPL_METHODS = [
  { label: 'Yoast SEO', path: 'Schema tab → Custom Schema' },
  { label: 'RankMath', path: 'Schema → Add Custom' },
  { label: 'Manual', path: 'wp_head hook' },
];

interface SchemaTabProps {
  apiKey: string;
  provider: string;
  model: string;
  url: string;
}

function parseSchemaOutput(text: string): string | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  return jsonMatch ? jsonMatch[1].trim() : null;
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Simple line-by-line JSON syntax colorizer
function colorizeJson(raw: string): string {
  return raw
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*)("(?:[^"\\]|\\.)*")\s*:\s*([\s\S]*)$/);
      if (m) {
        const [, ws, key, val] = m;
        const kHtml = `<span style="color:#5B35D5;font-weight:600">${escHtml(key)}</span>`;
        const trimVal = val.trimEnd();
        let vHtml: string;
        if (/^"/.test(trimVal)) vHtml = `<span style="color:#0891b2">${escHtml(trimVal)}</span>`;
        else if (/^-?\d/.test(trimVal))
          vHtml = `<span style="color:#16a34a">${escHtml(trimVal)}</span>`;
        else if (/^(true|false|null)/.test(trimVal))
          vHtml = `<span style="color:#d97706">${escHtml(trimVal)}</span>`;
        else vHtml = escHtml(trimVal);
        return `${escHtml(ws)}${kHtml}: ${vHtml}`;
      }
      return escHtml(line);
    })
    .join('\n');
}

export function SchemaTab({ apiKey, provider, model, url }: SchemaTabProps) {
  const [businessType, setBusinessType] = useState('LocalBusiness');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [parsedJson, setParsedJson] = useState<string | null>(null);
  const [cachedReport, setCachedReportState] = useState<CachedReport | null>(null);

  const {
    output: streamOutput,
    isStreaming,
    error: streamError,
    run,
    reset,
  } = useStream('/api/schema');
  const output = cachedReport?.text || streamOutput;

  useEffect(() => {
    if (!output) return;
    setParsedJson(parseSchemaOutput(output));
  }, [output]);

  useEffect(() => {
    if (!isStreaming && streamOutput && url.trim()) {
      setCachedReport(cacheKey('schema', url.trim(), businessType), streamOutput, provider, model);
    }
  }, [isStreaming, streamOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill website URL from the shared URL
  useEffect(() => {
    if (url && !websiteUrl) setWebsiteUrl(url);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please add your API key in the provider settings.');
      return;
    }
    if (!url.trim()) {
      setValidationError('No URL found — enter a URL in the Analyze tab first.');
      return;
    }
    setValidationError('');
    setParsedJson(null);
    setCachedReportState(null);

    const key = cacheKey('schema', url.trim(), businessType);
    const cached = getCachedReport(key);
    if (cached) {
      setCachedReportState(cached);
      return;
    }

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
        businessName: businessName.trim() || '[Extract from page]',
        businessType,
        description: data.text,
        services: '',
        faqs: '',
        city: city.trim(),
        state: '',
        country: '',
        phone: phone.trim(),
        website: websiteUrl.trim() || url.trim(),
        extraContext: description.trim() ? `Business description: ${description.trim()}` : '',
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

  const handleCopy = () => {
    if (!parsedJson) return;
    navigator.clipboard.writeText(parsedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!parsedJson) return;
    const blob = new Blob([parsedJson], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'schema.json';
    a.click();
  };

  const handleReset = () => {
    reset();
    setParsedJson(null);
    setCachedReportState(null);
    setValidationError('');
    setBusinessName('');
    setCity('');
    setPhone('');
    setWebsiteUrl(url || '');
    setDescription('');
  };

  const handleRefresh = () => {
    bustCache(cacheKey('schema', url.trim(), businessType));
    setCachedReportState(null);
    setParsedJson(null);
    reset();
    handleGenerate();
  };

  const isLoading = isFetching || isStreaming;
  const loadingLabel = isFetching ? 'Fetching page…' : 'Generating schema…';
  const error = validationError || streamError;

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent placeholder:text-gray-300';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
          Schema Builder
        </p>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
          Generate JSON-LD Schema
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Reads your page and generates complete schema ready to paste into Yoast or RankMath.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow-card p-6 space-y-5">
        {/* Business Type + CTA */}
        <div>
          <label className={labelCls}>Business Type</label>
          <div className="flex items-center gap-3">
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-48 border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <SubmitButton
              isLoading={isLoading}
              label="{ } Generate Schema"
              loadingLabel={loadingLabel}
              onClick={handleGenerate}
            />
            {output && !isLoading && (
              <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">
                ↺ Reset
              </button>
            )}
          </div>
        </div>

        {/* Business Name + City */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Acme Digital Agency"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>City / Location</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Cebu City, PH"
              className={inputCls}
            />
          </div>
        </div>

        {/* Phone + Website URL */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +63 32 123 4567"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Website URL</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className={inputCls}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of your business"
            className={inputCls}
          />
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

      {/* JSON Output */}
      {(parsedJson || (isLoading && !isFetching)) && (
        <div className="space-y-3">
          {/* Output header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-brand-purple font-bold">{'{ }'}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Generated JSON-LD Schema
              </p>
              {isLoading && (
                <span className="text-[10px] text-brand-purple font-medium animate-pulse">
                  Generating…
                </span>
              )}
            </div>
            {parsedJson && !isLoading && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ↓ Download
                </button>
              </div>
            )}
          </div>

          {/* Code block */}
          <div className="bg-white rounded-2xl shadow-card overflow-auto max-h-[420px] p-6">
            {parsedJson ? (
              <pre
                className="text-xs font-mono leading-relaxed"
                dangerouslySetInnerHTML={{ __html: colorizeJson(parsedJson) }}
              />
            ) : (
              <span className="text-brand-purple animate-pulse text-sm">▋</span>
            )}
          </div>
        </div>
      )}

      {/* Implementation badges + validate link */}
      {parsedJson && !isLoading && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {IMPL_METHODS.map((m) => (
              <span
                key={m.label}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-purple/20 bg-brand-lavender text-xs font-semibold text-gray-700"
              >
                <span className="w-2 h-2 rounded-full bg-brand-purple shrink-0" />
                {m.label} → {m.path}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Validate at:{' '}
            <span className="font-semibold text-brand-purple">
              search.google.com/test/rich-results ↗
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
