'use client';

import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useMemo } from 'react';
import { formatNumber } from '@/lib/format';
import ChartEmptyState from './ChartEmptyState';

export default function ConversionsTrendWidget() {
  const { campaigns, dailyMetrics, isDailyMetricsLoading } = useCampaignsData();

  const chartData = useMemo(() => {
    if (!dailyMetrics.length) return [];
    return dailyMetrics.slice(-14).map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      conversions: d.conversions,
    }));
  }, [dailyMetrics]);

  const maxConversions = Math.max(...chartData.map(d => d.conversions), 1);
  const totalConversions = chartData.reduce((sum, d) => sum + d.conversions, 0);

  // Check if we have aggregated data but no daily breakdown
  const hasAggregatedData = campaigns.some(c => (c.conversions || 0) > 0);

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
        <h3 className="text-lg font-semibold text-slate-900">Conversions Trend</h3>
        {chartData.length > 0 && (
          <span className="text-sm tabular-nums text-slate-500">
            Total: {formatNumber(totalConversions)}
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <ChartEmptyState
          metric="conversions"
          hasAggregatedData={hasAggregatedData}
          onRetrySync={() => window.location.reload()}
        />
      ) : (
        <div className="relative h-48">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-xs tabular-nums text-slate-400 w-12">
            <span>{formatNumber(maxConversions, { compact: true })}</span>
            <span>{formatNumber(maxConversions / 2, { compact: true })}</span>
            <span>0</span>
          </div>

          {/* Chart area */}
          <div className="ml-14 h-full flex items-end gap-1 pb-6">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group">
                <div className="relative w-full flex justify-center">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div className="rounded bg-slate-800 px-2 py-1 text-xs tabular-nums text-white whitespace-nowrap">
                      {formatNumber(d.conversions)} conversions
                    </div>
                  </div>
                  {/* Bar */}
                  <div
                    className="w-full max-w-8 rounded-t bg-emerald-500 transition-all hover:bg-emerald-600"
                    style={{ height: `${Math.max((d.conversions / maxConversions) * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
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
