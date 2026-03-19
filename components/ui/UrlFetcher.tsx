'use client';

import { useState } from 'react';

interface UrlFetcherProps {
  onFetched: (text: string) => void;
  placeholder?: string;
}

export function UrlFetcher({
  onFetched,
  placeholder = 'https://example.com/page',
}: UrlFetcherProps) {
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFetch = async () => {
    if (!url.trim()) return;
    setIsFetching(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to fetch page.');
      } else {
        onFetched(data.text);
        const words = data.text.trim().split(/\s+/).length;
        setSuccess(`Fetched — ${words.toLocaleString()} words extracted`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
            setSuccess('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          onClick={handleFetch}
          disabled={isFetching || !url.trim()}
          className={`px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${
            isFetching || !url.trim()
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isFetching ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Fetching…
            </span>
          ) : (
            '↓ Fetch Page'
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-600">✓ {success}</p>}
    </div>
  );
}
