'use client';

import { useState, useEffect, useRef } from 'react';
import { parseGeoScore, parseSignals, getScoreStatus, getScoreColor, type Signal } from '@/lib/parse-geo';

const COLOR_CLASSES = {
  green: {
    text: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    bar: 'bg-green-500',
    badge: 'bg-green-100 text-green-800',
  },
  yellow: {
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    bar: 'bg-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  red: {
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-800',
  },
} as const;

function ScoreRing({ score, color }: { score: number; color: 'green' | 'yellow' | 'red' }) {
  const c = COLOR_CLASSES[color];
  return (
    <div className="text-center">
      <div className={`text-7xl font-black tabular-nums ${c.text}`}>{score}</div>
      <div className="text-sm text-gray-400 font-medium -mt-1">/ 100</div>
      <div className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-bold ${c.badge}`}>
        {getScoreStatus(score)}
      </div>
    </div>
  );
}

function SignalBar({ signal }: { signal: Signal }) {
  const pct = Math.round((signal.score / signal.maxScore) * 100);
  const color =
    signal.emoji === '🟢' ? 'green' : signal.emoji === '🟡' ? 'yellow' : 'red';
  const bar = COLOR_CLASSES[color].bar;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-700 font-medium flex items-center gap-1">
          <span>{signal.emoji}</span>
          <span>{signal.name}</span>
        </span>
        <span className="text-xs text-gray-400 tabular-nums">
          {signal.score}/{signal.maxScore}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function GeoAnalyzer() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [targetQuery, setTargetQuery] = useState('');
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [geoScore, setGeoScore] = useState<number | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);

  const analysisRef = useRef<HTMLDivElement>(null);

  // Load saved API key
  useEffect(() => {
    const saved = localStorage.getItem('geo-analyzer-api-key');
    if (saved) {
      setApiKey(saved);
    } else {
      setShowApiKey(true);
    }
  }, []);

  // Parse score + signals from streamed text
  useEffect(() => {
    if (!analysis) return;
    const score = parseGeoScore(analysis);
    if (score !== null) setGeoScore(score);
    const parsed = parseSignals(analysis);
    if (parsed.length > 0) setSignals(parsed);
  }, [analysis]);

  // Auto-scroll analysis panel while streaming
  useEffect(() => {
    if (isAnalyzing && analysisRef.current) {
      analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
    }
  }, [analysis, isAnalyzing]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Anthropic API key.');
      setShowApiKey(true);
      return;
    }
    if (!targetQuery.trim()) {
      setError('Please enter a Target AI Query.');
      return;
    }
    if (!content.trim()) {
      setError('Please paste content to analyze.');
      return;
    }

    setError('');
    setIsAnalyzing(true);
    setAnalysis('');
    setGeoScore(null);
    setSignals([]);

    localStorage.setItem('geo-analyzer-api-key', apiKey.trim());

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          targetQuery: targetQuery.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnalysis((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Analysis failed. Check your API key and try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setAnalysis('');
    setGeoScore(null);
    setSignals([]);
    setError('');
    setContent('');
    setTargetQuery('');
  };

  const scoreColor = geoScore !== null ? getScoreColor(geoScore) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-sm">G</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-none">GEO Analyzer</h1>
              <p className="text-[10px] text-gray-400 tracking-wide uppercase mt-0.5">
                The Yoast SEO of the AI Era
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {analysis && !isAnalyzing && (
              <button
                onClick={handleReset}
                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg"
              >
                ↺ Reset
              </button>
            )}
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                apiKey
                  ? 'text-green-700 bg-green-50 border-green-200'
                  : 'text-gray-500 bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <span>{apiKey ? '🔑 Key saved' : '🔑 Add API Key'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* API Key Panel */}
        {showApiKey && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="mb-3">
                <h3 className="font-semibold text-blue-900 text-sm">Anthropic API Key</h3>
                <p className="text-xs text-blue-700 mt-0.5">
                  Get a free key at{' '}
                  <span className="font-medium underline">console.anthropic.com</span>
                  {' '}— stored only in your browser, never on our servers.
                </p>
              </div>
              {apiKey && (
                <button
                  onClick={() => setShowApiKey(false)}
                  className="text-blue-400 hover:text-blue-600 text-xs ml-4 shrink-0"
                >
                  ✕ Close
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setShowApiKey(false)}
                placeholder="sk-ant-api03-..."
                className="flex-1 text-sm border border-blue-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  if (apiKey.trim()) {
                    localStorage.setItem('geo-analyzer-api-key', apiKey.trim());
                    setShowApiKey(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shrink-0"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Target AI Query */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Target AI Query
          </label>
          <input
            type="text"
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            placeholder={`e.g. "best dental clinic in Cebu City" or "top HR software for small business"`}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-400">
            The natural language prompt users type into ChatGPT, Perplexity, or Google AI. This
            drives the entire analysis.
          </p>
        </div>

        {/* Content + Score Panel */}
        <div className="flex gap-5 items-start">
          {/* Left: Content */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Content to Analyze
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your page content here — homepage copy, service page, about page, blog post, product description..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-64 font-mono leading-relaxed"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {wordCount > 0 ? `${wordCount.toLocaleString()} words` : 'Paste content above'}
              </span>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm ${
                  isAnalyzing
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-95'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin inline-block">⟳</span>
                    <span>Analyzing…</span>
                  </>
                ) : (
                  <>
                    <span>✦</span>
                    <span>Run GEO Analysis</span>
                  </>
                )}
              </button>
            </div>
            {error && (
              <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Right: Score Panel */}
          <div className="w-64 shrink-0 space-y-4">
            {/* Score Card */}
            <div
              className={`rounded-xl border-2 p-5 transition-colors duration-500 ${
                scoreColor
                  ? `${COLOR_CLASSES[scoreColor].bg} ${COLOR_CLASSES[scoreColor].border}`
                  : 'bg-white border-gray-200'
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                GEO Score
              </p>

              {geoScore === null && !isAnalyzing && (
                <div className="text-center py-6">
                  <div className="text-4xl text-gray-200 mb-2">◎</div>
                  <p className="text-xs text-gray-400">Run analysis to see your score</p>
                </div>
              )}

              {geoScore === null && isAnalyzing && (
                <div className="text-center py-6">
                  <div className="text-3xl text-indigo-300 animate-pulse mb-2">◎</div>
                  <p className="text-xs text-gray-400">Analyzing content…</p>
                </div>
              )}

              {geoScore !== null && scoreColor && (
                <ScoreRing score={geoScore} color={scoreColor} />
              )}

              {signals.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-200 space-y-3">
                  {signals.map((s) => (
                    <SignalBar key={s.name} signal={s} />
                  ))}
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                What is GEO?
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Generative Engine Optimization makes your content more likely to be cited by AI
                systems like ChatGPT, Perplexity, and Google AI Overviews.
              </p>
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="text-green-500">●</span>
                  <span>80–100: GEO Ready</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-yellow-500">●</span>
                  <span>50–79: Needs Work</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-red-500">●</span>
                  <span>0–49: Not Optimized</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Output */}
        {(analysis || isAnalyzing) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                GEO Analysis Report
              </h2>
              {analysis && !isAnalyzing && (
                <button
                  onClick={handleCopy}
                  className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1"
                >
                  {copied ? '✓ Copied' : '⎘ Copy Report'}
                </button>
              )}
            </div>
            <div
              ref={analysisRef}
              className="bg-slate-900 text-slate-100 rounded-xl p-6 font-mono text-sm leading-relaxed overflow-auto max-h-[640px] whitespace-pre-wrap"
            >
              {analysis}
              {isAnalyzing && <span className="animate-pulse text-indigo-400">▋</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
