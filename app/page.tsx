'use client';

import { useState, useEffect } from 'react';
import { TabNav, type Tab } from '@/components/ui/TabNav';
import { AnalyzeTab } from '@/components/tabs/AnalyzeTab';
import { SchemaTab } from '@/components/tabs/SchemaTab';
import { RewriteTab } from '@/components/tabs/RewriteTab';
import { CompetitorTab } from '@/components/tabs/CompetitorTab';
import { MarketingAuditTab } from '@/components/tabs/MarketingAuditTab';
import { HistoryTab } from '@/components/tabs/HistoryTab';
import { PROVIDERS, type ProviderId } from '@/lib/providers';
import { UserMenu } from '@/components/ui/UserMenu';
import { ConsentModal } from '@/components/ui/ConsentModal';

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export default function GeoAnalyzer() {
  const [activeTab, setActiveTab] = useState<Tab>('analyze');
  const [showSettings, setShowSettings] = useState(false);
  const [sharedUrl, setSharedUrl] = useState('');

  const [provider, setProvider] = useState<ProviderId>('gemini');
  const [model, setModel] = useState<string>(PROVIDERS.gemini.defaultModel);
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
    anthropic: '',
    gemini: '',
    groq: '',
    openai: '',
  });
  const [draftKey, setDraftKey] = useState('');
  const [serverKeys, setServerKeys] = useState<Partial<Record<ProviderId, boolean>>>({});

  // Load saved settings
  useEffect(() => {
    const savedProvider = (localStorage.getItem('geo-provider') as ProviderId) || 'gemini';
    const savedKeys: Record<ProviderId, string> = {
      anthropic: localStorage.getItem('geo-key-anthropic') || '',
      gemini: localStorage.getItem('geo-key-gemini') || '',
      groq: localStorage.getItem('geo-key-groq') || '',
      openai: localStorage.getItem('geo-key-openai') || '',
    };
    const deprecatedModels = ['gemini-1.5-flash', 'gemini-1.5-pro'];
    const rawModel = localStorage.getItem(`geo-model-${savedProvider}`);
    const savedModel =
      rawModel && !deprecatedModels.includes(rawModel)
        ? rawModel
        : PROVIDERS[savedProvider].defaultModel;

    setProvider(savedProvider);
    setApiKeys(savedKeys);
    setModel(savedModel);
    setDraftKey(savedKeys[savedProvider]);

    if (!savedKeys[savedProvider]) setShowSettings(true);

    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        setServerKeys(cfg);
        // If server has a key for the active provider, don't force settings open
        if (cfg[savedProvider]) setShowSettings(false);
      })
      .catch(() => {});
  }, []);

  const activeKey = apiKeys[provider];
  const hasServerKey = !!serverKeys[provider];
  const isReady = !!activeKey || hasServerKey;
  const providerConfig = PROVIDERS[provider];

  const handleProviderChange = (p: ProviderId) => {
    setProvider(p);
    setModel(PROVIDERS[p].defaultModel);
    setDraftKey(apiKeys[p]);
    localStorage.setItem('geo-provider', p);
  };

  const handleModelChange = (m: string) => {
    setModel(m);
    localStorage.setItem(`geo-model-${provider}`, m);
  };

  // Save immediately on every keystroke — no Save button required
  const handleKeyChange = (value: string) => {
    setDraftKey(value);
    const updated = { ...apiKeys, [provider]: value.trim() };
    setApiKeys(updated);
    if (value.trim()) {
      localStorage.setItem(`geo-key-${provider}`, value.trim());
    } else {
      localStorage.removeItem(`geo-key-${provider}`);
    }
  };

  const handleSaveKey = () => {
    setShowSettings(false);
  };

  const tabProps = { apiKey: activeKey, provider, model };

  return (
    <div className="min-h-screen bg-brand-lavender">
      <ConsentModal />
      <header className="bg-white sticky top-0 z-10 shadow-[0_2px_12px_rgba(91,53,213,0.08)]">
        {/* Top bar */}
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-purple rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-black text-sm tracking-tight">G</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm leading-none tracking-tight">
                GEO Analyzer
              </h1>
              <p className="text-[10px] text-gray-400 tracking-widest uppercase mt-0.5">
                SEO + GEO · Full AI Visibility
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <UserMenu />
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                isReady
                  ? 'text-green-700 bg-green-50 border-green-200'
                  : 'text-gray-500 bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              <span className="font-medium">{providerConfig.name}</span>
              <span className="text-gray-400">
                {activeKey ? '· Connected' : hasServerKey ? '· Ready' : '· Add key'}
              </span>
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
            <div className="max-w-7xl mx-auto space-y-4">
              {/* Provider selector */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  AI Provider
                </p>
                <div className="flex gap-2 flex-wrap">
                  {PROVIDER_IDS.map((p) => {
                    const cfg = PROVIDERS[p];
                    const ready = !!apiKeys[p] || !!serverKeys[p];
                    return (
                      <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                          provider === p
                            ? 'bg-brand-purple text-white border-brand-purple shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-green-400' : 'bg-gray-300'}`}
                        />
                        {cfg.fullName}
                        {serverKeys[p] && !apiKeys[p] && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${provider === p ? 'bg-[#4E2EC4] text-white' : 'bg-blue-100 text-blue-700'}`}
                          >
                            SERVER
                          </span>
                        )}
                        {cfg.freeTier && !serverKeys[p] && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${provider === p ? 'bg-[#4E2EC4] text-white' : 'bg-green-100 text-green-700'}`}
                          >
                            FREE
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4 items-end flex-wrap">
                {/* API Key */}
                <div className="flex-1 min-w-64">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    {providerConfig.keyLabel}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={draftKey}
                      onChange={(e) => handleKeyChange(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                      placeholder={providerConfig.keyPlaceholder}
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                    <button
                      onClick={handleSaveKey}
                      disabled={!activeKey}
                      className={`px-4 py-2 text-sm font-medium rounded-lg shrink-0 transition-colors ${activeKey ? 'bg-brand-purple text-white hover:bg-[#4E2EC4]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                      {activeKey ? '✓ Done' : 'Paste key above'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Get{providerConfig.freeTier ? ' a free key' : ' your key'} at{' '}
                    <span className="font-medium text-indigo-600">{providerConfig.keyLink}</span>
                    {providerConfig.freeTier && ' — no credit card required'}
                  </p>
                </div>

                {/* Model selector */}
                <div className="w-56 shrink-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  >
                    {providerConfig.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {activeKey && (
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 pb-2 shrink-0"
                  >
                    ✕ Close
                  </button>
                )}
              </div>

              {/* Model consistency notice */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠</span>
                <p className="text-xs text-amber-700 leading-relaxed">
                  <span className="font-bold">Model consistency note:</span> GEO scoring determinism
                  varies by model — Claude and GPT-4o produce the most consistent scores across
                  repeated runs, while open-source models (Llama, Mixtral) may show higher score
                  variance. For thesis-grade or client-facing reports, Claude or GPT-4o is
                  recommended.
                </p>
              </div>
            </div>
          </div>
        )}

        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'analyze' && (
          <AnalyzeTab
            {...tabProps}
            isReady={isReady}
            url={sharedUrl}
            onUrlChange={setSharedUrl}
            onTabChange={(tab) => setActiveTab(tab as Tab)}
            consensusKeys={{
              gemini: apiKeys.gemini,
              groq: apiKeys.groq,
              geminiModel: PROVIDERS.gemini.defaultModel,
              groqModel: PROVIDERS.groq.defaultModel,
            }}
          />
        )}
        {activeTab === 'schema' && <SchemaTab {...tabProps} url={sharedUrl} />}
        {activeTab === 'rewrite' && <RewriteTab {...tabProps} url={sharedUrl} />}
        {activeTab === 'competitor' && <CompetitorTab {...tabProps} />}
        {activeTab === 'audit' && (
          <MarketingAuditTab
            {...tabProps}
            url={sharedUrl}
            onUrlChange={setSharedUrl}
            onTabChange={(tab) => setActiveTab(tab as Tab)}
          />
        )}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}
