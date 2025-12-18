'use client';

import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useMemo } from 'react';

const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  SEARCH: '#3B82F6',       // blue
  PERFORMANCE_MAX: '#8B5CF6', // purple
  SHOPPING: '#F97316',     // orange
  DISPLAY: '#06B6D4',      // cyan
  VIDEO: '#EF4444',        // red
  DEMAND_GEN: '#EC4899',   // pink
  APP: '#6366F1',          // indigo
};

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  SEARCH: 'Search',
  PERFORMANCE_MAX: 'Performance Max',
  SHOPPING: 'Shopping',
  DISPLAY: 'Display',
  VIDEO: 'Video',
  DEMAND_GEN: 'Demand Gen',
  APP: 'App',
};

export default function CampaignDistributionWidget() {
  const { campaigns, isLoading } = useCampaignsData();

  const distribution = useMemo(() => {
    const grouped = campaigns.reduce((acc, campaign) => {
      const type = campaign.type || 'SEARCH';
      if (!acc[type]) {
        acc[type] = { count: 0, spend: 0 };
      }
      acc[type].count += 1;
      acc[type].spend += campaign.spend || 0;
      return acc;
    }, {} as Record<string, { count: number; spend: number }>);

    const totalSpend = Object.values(grouped).reduce((sum, g) => sum + g.spend, 0);

    return Object.entries(grouped)
      .map(([type, data]) => ({
        type,
        label: CAMPAIGN_TYPE_LABELS[type] || type,
        color: CAMPAIGN_TYPE_COLORS[type] || '#94A3B8',
        count: data.count,
        spend: data.spend,
        percentage: totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [campaigns]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="flex gap-6">
          <div className="h-32 w-32 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 animate-pulse rounded bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalCampaigns = campaigns.length;

  // Calculate pie chart segments
  let cumulativePercentage = 0;
  const segments = distribution.map(d => {
    const start = cumulativePercentage;
    cumulativePercentage += d.percentage;
    return { ...d, start, end: cumulativePercentage };
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Campaign Distribution</h3>

      {distribution.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-slate-400">
          No campaigns found
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Pie Chart */}
          <div className="relative h-32 w-32 flex-shrink-0">
            <svg viewBox="0 0 32 32" className="h-full w-full -rotate-90">
              {segments.map((segment, i) => {
                const circumference = 2 * Math.PI * 15;
                const dashArray = (segment.percentage / 100) * circumference;
                const dashOffset = ((100 - segment.start) / 100) * circumference;

                return (
                  <circle
                    key={i}
                    cx="16"
                    cy="16"
                    r="15"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="2"
                    strokeDasharray={`${dashArray} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-300"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{totalCampaigns}</span>
              <span className="text-xs text-slate-500">campaigns</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {distribution.slice(0, 5).map(d => (
              <div key={d.type} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="flex-1 text-sm text-slate-600 truncate">
                  {d.label}
                </span>
                <span className="text-sm font-medium text-slate-900">
                  {d.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
            {distribution.length > 5 && (
              <div className="text-xs text-slate-400">
                +{distribution.length - 5} more types
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
