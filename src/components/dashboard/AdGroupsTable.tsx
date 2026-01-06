'use client';

import { useCampaignsStore, AdGroup } from '@/stores/campaigns-store';
import { useShallow } from 'zustand/react/shallow';

export default function AdGroupsTable() {
  const adGroups = useCampaignsStore(useShallow((state) => state.adGroups));
  const loading = useCampaignsStore((state) => state.adGroupsLoading);
  const selectedCampaign = useCampaignsStore((state) => state.selectedCampaign);
  const drillIntoAdGroup = useCampaignsStore((state) => state.drillIntoAdGroup);
  const goBack = useCampaignsStore((state) => state.goBack);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-surface2 rounded w-full" />
          {[1, 2, 3, 4].map((i) => (
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
          <button onClick={goBack} className="text-accent hover:underline">
            Campaigns
          </button>
          <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-text font-medium">{selectedCampaign?.name}</span>
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
              <h2 className="font-semibold text-text">Ad Groups</h2>
              <p className="text-sm text-text3">{adGroups.length} ad groups in {selectedCampaign?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="divide-y divide-divider">
        {/* Header row */}
        <div className="px-4 py-3 flex items-center gap-4 text-xs text-text3 uppercase tracking-wide bg-surface2/30">
          <div className="flex-1">Ad Group</div>
          <div className="w-20 text-right">Spend</div>
          <div className="w-16 text-right">Clicks</div>
          <div className="w-20 text-right">Impr.</div>
          <div className="w-16 text-right">Conv</div>
          <div className="w-16 text-right">CTR</div>
          <div className="w-16 text-right">CPA</div>
          <div className="w-20"></div>
        </div>

        {/* Ad Group rows */}
        {adGroups.map((adGroup) => (
          <div key={adGroup.id} className="px-4 py-3 flex items-center gap-4 hover:bg-surface2/30 transition-colors">
            {/* Name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${adGroup.status === 'ENABLED' ? 'bg-success' : 'bg-text3'}`} />
                <button
                  onClick={() => drillIntoAdGroup(adGroup)}
                  className="font-medium text-text truncate hover:text-accent hover:underline transition-colors text-left"
                >
                  {adGroup.name}
                </button>
              </div>
            </div>

            {/* Spend */}
            <div className="w-20 text-right text-sm text-text tabular-nums">
              ${adGroup.spend.toLocaleString()}
            </div>

            {/* Clicks */}
            <div className="w-16 text-right text-sm text-text tabular-nums">
              {adGroup.clicks.toLocaleString()}
            </div>

            {/* Impressions */}
            <div className="w-20 text-right text-sm text-text tabular-nums">
              {adGroup.impressions.toLocaleString()}
            </div>

            {/* Conversions */}
            <div className="w-16 text-right text-sm text-text tabular-nums">
              {adGroup.conversions}
            </div>

            {/* CTR */}
            <div className="w-16 text-right text-sm text-text tabular-nums">
              {adGroup.ctr.toFixed(2)}%
            </div>

            {/* CPA */}
            <div className="w-16 text-right text-sm text-text tabular-nums">
              ${adGroup.cpa.toFixed(0)}
            </div>

            {/* Actions */}
            <div className="w-20 flex justify-end">
              <button
                onClick={() => drillIntoAdGroup(adGroup)}
                className="px-3 py-1 text-xs bg-surface2 text-text2 rounded-lg hover:bg-accent hover:text-white transition-colors"
              >
                Keywords
              </button>
            </div>
          </div>
        ))}

        {adGroups.length === 0 && (
          <div className="p-8 text-center text-text3">
            No ad groups found in this campaign
          </div>
        )}
      </div>
    </div>
  );
}
