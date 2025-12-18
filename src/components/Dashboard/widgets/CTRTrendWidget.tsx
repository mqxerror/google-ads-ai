'use client';

import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useMemo } from 'react';
import { formatPercent } from '@/lib/format';
import ChartEmptyState from './ChartEmptyState';

export default function CTRTrendWidget() {
  const { campaigns, dailyMetrics, isDailyMetricsLoading } = useCampaignsData();

  const chartData = useMemo(() => {
    if (!dailyMetrics.length) return [];
    return dailyMetrics.slice(-14).map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ctr: d.ctr,
    }));
  }, [dailyMetrics]);

  const maxCTR = Math.max(...chartData.map(d => d.ctr), 1);
  const avgCTR = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.ctr, 0) / chartData.length
    : 0;

  // Check if we have aggregated data but no daily breakdown
  const hasAggregatedData = campaigns.some(c => {
    const impressions = c.impressions || 0;
    const clicks = c.clicks || 0;
    return impressions > 0 && clicks > 0;
  });

  if (isDailyMetricsLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-48 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">CTR Trend</h3>
        {chartData.length > 0 && (
          <span className="text-sm tabular-nums text-slate-500">
            Avg: {formatPercent(avgCTR, { decimals: 2 })}
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <ChartEmptyState
          metric="ctr"
          hasAggregatedData={hasAggregatedData}
          onRetrySync={() => window.location.reload()}
        />
      ) : (
        <div className="relative h-48">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-xs tabular-nums text-slate-400 w-12">
            <span>{formatPercent(maxCTR, { decimals: 1 })}</span>
            <span>{formatPercent(maxCTR / 2, { decimals: 1 })}</span>
            <span>0%</span>
          </div>

          {/* Line Chart Area */}
          <div className="ml-14 h-full pb-6 relative">
            <svg className="w-full h-full" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeDasharray="4" className="text-slate-200" />

              {/* Line path */}
              <polyline
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="2"
                points={chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1)) * 100;
                  const y = 100 - (d.ctr / maxCTR) * 100;
                  return `${x}%,${y}%`;
                }).join(' ')}
              />

              {/* Data points */}
              {chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 100;
                const y = 100 - (d.ctr / maxCTR) * 100;
                return (
                  <g key={i} className="group">
                    <circle
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="4"
                      fill="#8B5CF6"
                      className="transition-all hover:r-6"
                    />
                    <title>{d.date}: {formatPercent(d.ctr, { decimals: 2 })}</title>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* X-axis labels */}
          <div className="ml-14 flex justify-between text-xs text-slate-400 mt-1">
            {chartData.filter((_, i) => i % 3 === 0 || i === chartData.length - 1).map((d, i) => (
              <span key={i}>{d.date}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
