'use client';

export type Tab = 'analyze' | 'schema' | 'rewrite' | 'competitor' | 'audit';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'analyze', label: 'GEO Analyzer', icon: '✦' },
  { id: 'schema', label: 'Schema Builder', icon: '{}' },
  { id: 'rewrite', label: 'Content Rewriter', icon: '↺' },
  { id: 'competitor', label: 'Competitor Gap', icon: '⚡' },
  { id: 'audit', label: 'Marketing Audit', icon: '◈' },
];

interface TabNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 flex gap-1 pt-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
