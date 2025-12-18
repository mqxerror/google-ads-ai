'use client';

import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useMemo } from 'react';

export default function TopCampaignsWidget() {
  const { campaigns, isLoading } = useCampaignsData();

  const topCampaigns = useMemo(() => {
    return [...campaigns]
      .filter(c => c.status === 'ENABLED')
      .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
      .slice(0, 5);
  }, [campaigns]);

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-slate-200" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Top Performing Campaigns</h3>

      {topCampaigns.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-slate-400">
          No active campaigns found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Campaign
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Spend
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Conv.
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  CPA
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  CTR
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topCampaigns.map((campaign, index) => (
                <tr key={campaign.id} className="group hover:bg-slate-50">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 max-w-[200px]">
                          {campaign.name}
                        </p>
                        <p className="text-xs text-slate-500">{campaign.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right text-sm text-slate-700">
                    {formatCurrency(campaign.spend || 0)}
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-semibold text-emerald-600">
                      {campaign.conversions?.toLocaleString() || 0}
                    </span>
                  </td>
                  <td className="py-3 text-right text-sm text-slate-700">
                    {formatCurrency(campaign.cpa || 0)}
                  </td>
                  <td className="py-3 text-right text-sm text-slate-700">
                    {(campaign.ctr || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
