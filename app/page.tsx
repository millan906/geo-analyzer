'use client';

import { useState, useEffect } from 'react';
import { TabNav, type Tab } from '@/components/ui/TabNav';
import { AnalyzeTab } from '@/components/tabs/AnalyzeTab';
import { SchemaTab } from '@/components/tabs/SchemaTab';
import { RewriteTab } from '@/components/tabs/RewriteTab';
import { CompetitorTab } from '@/components/tabs/CompetitorTab';
import { MarketingAuditTab } from '@/components/tabs/MarketingAuditTab';
import { PROVIDERS, type ProviderId } from '@/lib/providers';

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export default function GeoAnalyzer() {
  const [activeTab, setActiveTab] = useState<Tab>('analyze');
  const [showSettings, setShowSettings] = useState(false);

  const [provider, setProvider] = useState<ProviderId>('gemini');
  const [model, setModel] = useState<string>(PROVIDERS.gemini.defaultModel);
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
    anthropic: '',
    gemini: '',
    groq: '',
    openai: '',
  });
  const [draftKey, setDraftKey] = useState('');

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
  }, []);

  const activeKey = apiKeys[provider];
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        {/* Top bar */}
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

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
              activeKey
                ? 'text-green-700 bg-green-50 border-green-200'
                : 'text-gray-500 bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${activeKey ? 'bg-green-500' : 'bg-gray-300'}`}
            />
            <span className="font-medium">{providerConfig.name}</span>
            <span className="text-gray-400">{activeKey ? '· Connected' : '· Add key'}</span>
          </button>
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
                    const hasKey = !!apiKeys[p];
                    return (
                      <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                          provider === p
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-green-400' : 'bg-gray-300'}`}
                        />
                        {cfg.fullName}
                        {cfg.freeTier && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${provider === p ? 'bg-indigo-500 text-indigo-100' : 'bg-green-100 text-green-700'}`}
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
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleSaveKey}
                      disabled={!activeKey}
                      className={`px-4 py-2 text-sm font-medium rounded-lg shrink-0 transition-colors ${activeKey ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            </div>
          </div>
        )}

        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'analyze' && (
          <AnalyzeTab
            {...tabProps}
            consensusKeys={{
              gemini: apiKeys.gemini,
              groq: apiKeys.groq,
              geminiModel: PROVIDERS.gemini.defaultModel,
              groqModel: PROVIDERS.groq.defaultModel,
            }}
          />
        )}
        {activeTab === 'schema' && <SchemaTab {...tabProps} />}
        {activeTab === 'rewrite' && <RewriteTab {...tabProps} />}
        {activeTab === 'competitor' && <CompetitorTab {...tabProps} />}
        {activeTab === 'audit' && <MarketingAuditTab {...tabProps} />}
      </div>
    </div>
  );
}
