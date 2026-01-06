'use client';

import { useCampaignsStore } from '@/stores/campaigns-store';
import { useShallow } from 'zustand/react/shallow';

export default function KeywordsTable() {
  const keywords = useCampaignsStore(useShallow((state) => state.keywords));
  const loading = useCampaignsStore((state) => state.keywordsLoading);
  const selectedCampaign = useCampaignsStore((state) => state.selectedCampaign);
  const selectedAdGroup = useCampaignsStore((state) => state.selectedAdGroup);
  const goBack = useCampaignsStore((state) => state.goBack);
  const resetDrilldown = useCampaignsStore((state) => state.resetDrilldown);

  // Match type badge colors
  const getMatchTypeColor = (matchType: string) => {
    switch (matchType) {
      case 'EXACT': return 'bg-accent/20 text-accent';
      case 'PHRASE': return 'bg-blue-500/20 text-blue-500';
      case 'BROAD': return 'bg-text3/20 text-text2';
      default: return 'bg-surface2 text-text3';
    }
  };

  // Quality score color
  const getQSColor = (qs: number | null) => {
    if (qs === null) return 'text-text3';
    if (qs >= 7) return 'text-success';
    if (qs >= 5) return 'text-warning';
    return 'text-danger';
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-surface2 rounded w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-surface2 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header with breadcrumb */}
      <div className="p-4 border-b border-divider">
        <div className="flex items-center gap-2 text-sm mb-2">
          <button onClick={resetDrilldown} className="text-accent hover:underline">
            Campaigns
          </button>
          <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <button onClick={goBack} className="text-accent hover:underline">
            {selectedCampaign?.name}
          </button>
          <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-text font-medium">{selectedAdGroup?.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-2 hover:bg-surface2 rounded-lg transition-colors"
              title="Go back"
            >
              <svg className="w-5 h-5 text-text2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="font-semibold text-text">Keywords</h2>
              <p className="text-sm text-text3">{keywords.length} keywords in {selectedAdGroup?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="divide-y divide-divider">
        {/* Header row */}
        <div className="px-4 py-3 flex items-center gap-4 text-xs text-text3 uppercase tracking-wide bg-surface2/30">
          <div className="flex-1">Keyword</div>
          <div className="w-20 text-center">Match</div>
          <div className="w-12 text-center">QS</div>
          <div className="w-20 text-right">Spend</div>
          <div className="w-16 text-right">Clicks</div>
          <div className="w-16 text-right">Conv</div>
          <div className="w-16 text-right">CTR</div>
          <div className="w-16 text-right">CPA</div>
        </div>

        {/* Keyword rows */}
        {keywords.map((keyword) => (
          <div key={keyword.id} className="px-4 py-3 flex items-center gap-4 hover:bg-surface2/30 transition-colors">
            {/* Keyword */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${keyword.status === 'ENABLED' ? 'bg-success' : 'bg-text3'}`} />
                <span className="font-medium text-text truncate">{keyword.keyword}</span>
              </div>
            </div>

            {/* Match Type */}
            <div className="w-20 flex justify-center">
              <span className={`px-2 py-0.5 text-xs rounded-full ${getMatchTypeColor(keyword.matchType)}`}>
                {keyword.matchType.toLowerCase()}
              </span>
            </div>

            {/* Quality Score */}
            <div className={`w-12 text-center text-sm font-medium ${getQSColor(keyword.qualityScore)}`}>
              {keyword.qualityScore ?? '-'}
            </div>

            {/* Spend */}
            <div className="w-20 text-right text-sm text-text tabular-nums">
              ${keyword.spend.toLocaleString()}
            </div>

            {/* Clicks */}
            <div className="w-16 text-right text-sm text-text tabular-nums">
              {keyword.clicks.toLocaleString()}
            </div>

            {/* Conversions */}
            <div className="w-16 text-right text-sm text-text tabular-nums">
              {keyword.conversions}
            </div>

            {/* CTR */}
            <div className="w-16 text-right text-sm text-text tabular-nums">
              {keyword.ctr.toFixed(2)}%
            </div>

            {/* CPA */}
            <div className="w-16 text-right text-sm text-text tabular-nums">
              ${keyword.cpa.toFixed(0)}
            </div>
          </div>
        ))}

        {keywords.length === 0 && (
          <div className="p-8 text-center text-text3">
            No keywords found in this ad group
          </div>
        )}
      </div>
    </div>
  );
}
