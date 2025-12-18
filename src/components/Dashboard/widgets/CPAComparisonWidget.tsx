'use client';

import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useMemo } from 'react';

export default function CPAComparisonWidget() {
  const { campaigns, isLoading } = useCampaignsData();

  const campaignCPAs = useMemo(() => {
    return [...campaigns]
      .filter(c => c.status === 'ENABLED' && c.conversions > 0)
      .map(c => ({
        id: c.id,
        name: c.name,
        cpa: c.cpa || 0,
        conversions: c.conversions || 0,
      }))
      .sort((a, b) => a.cpa - b.cpa)
      .slice(0, 8);
  }, [campaigns]);

  const maxCPA = Math.max(...campaignCPAs.map(c => c.cpa), 1);
  const avgCPA = campaignCPAs.length > 0
    ? campaignCPAs.reduce((sum, c) => sum + c.cpa, 0) / campaignCPAs.length
    : 0;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">CPA by Campaign</h3>
        <span className="text-sm text-slate-500">
          Avg: ${avgCPA.toFixed(2)}
        </span>
      </div>

      {campaignCPAs.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-slate-400">
          No campaigns with conversions
        </div>
      ) : (
        <div className="space-y-3">
          {campaignCPAs.map(campaign => {
            const barWidth = (campaign.cpa / maxCPA) * 100;
            const isGood = campaign.cpa < avgCPA;

            return (
              <div key={campaign.id} className="group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700 truncate max-w-[60%]" title={campaign.name}>
                    {campaign.name}
                  </span>
                  <span className={`text-sm font-semibold ${isGood ? 'text-emerald-600' : 'text-slate-700'}`}>
                    ${campaign.cpa.toFixed(2)}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${isGood ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                  {/* Average line marker */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-slate-400"
                    style={{ left: `${(avgCPA / maxCPA) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              Below average
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              Above average
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
