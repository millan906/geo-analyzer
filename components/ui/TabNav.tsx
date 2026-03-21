'use client';

export type Tab = 'analyze' | 'schema' | 'rewrite' | 'competitor' | 'audit' | 'history';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'analyze', label: 'Analyze', icon: '✦' },
  { id: 'schema', label: 'Schema Builder', icon: '{}' },
  { id: 'rewrite', label: 'Content Rewriter', icon: '↺' },
  { id: 'competitor', label: 'Competitor Gap', icon: '⚡' },
  { id: 'audit', label: 'Marketing Strategy', icon: '◈' },
  { id: 'history', label: 'History', icon: '⧖' },
];

interface TabNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-1.5 text-sm font-semibold flex items-center gap-1.5 rounded-full transition-all whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-brand-purple text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-500 hover:border-brand-purple hover:text-brand-purple'
            }`}
          >
            <span className="text-xs">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
