'use client';

import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import TrendIndicator from '../TrendIndicator';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';

interface MetricCardProps {
  title: string;
  value: string;
  previousValue?: number;
  currentValue?: number;
  format?: 'number' | 'currency' | 'percentage';
  icon: React.ReactNode;
  loading?: boolean;
  inverted?: boolean; // For metrics where down is good (e.g., CPA)
}

function MetricCard({
  title,
  value,
  previousValue,
  currentValue,
  format = 'number',
  icon,
  loading,
  inverted = false,
}: MetricCardProps) {
  const showTrend = previousValue !== undefined && currentValue !== undefined && previousValue > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        {showTrend && (
          <TrendIndicator
            value={currentValue}
            previousValue={previousValue}
            format={format}
            showValue={false}
            size="sm"
          />
        )}
      </div>
      <div className="mt-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {loading ? (
          <div className="mt-1 h-8 w-24 animate-pulse rounded bg-slate-200" />
        ) : (
          <div className="mt-1">
            <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
            {showTrend && (
              <p className="mt-0.5 text-xs text-slate-500">
                vs prev period
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MetricCardsWidget() {
  const { campaigns, isLoading } = useCampaignsData();

  // Calculate current period totals from campaigns data
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Simulated previous period data (in production, this would come from the API)
  // Using a realistic variance from current values
  const previousSpend = totalSpend * 0.88; // ~12% increase in spend
  const previousConversions = totalConversions * 0.95; // ~5% increase in conversions
  const previousCTR = avgCTR * 1.02; // ~2% decrease in CTR
  const previousCPA = previousConversions > 0
    ? (previousSpend / previousConversions)
    : avgCPA * 0.85; // ~15% increase in CPA (costs more)

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <MetricCard
        title="Total Spend"
        value={formatCurrency(totalSpend, { compact: true })}
        currentValue={totalSpend}
        previousValue={previousSpend}
        format="currency"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        loading={isLoading}
      />
      <MetricCard
        title="Conversions"
        value={formatNumber(totalConversions, { compact: true })}
        currentValue={totalConversions}
        previousValue={previousConversions}
        format="number"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        loading={isLoading}
      />
      <MetricCard
        title="Avg CTR"
        value={formatPercent(avgCTR, { decimals: 2 })}
        currentValue={avgCTR}
        previousValue={previousCTR}
        format="percentage"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        }
        loading={isLoading}
      />
      <MetricCard
        title="Avg CPA"
        value={formatCurrency(avgCPA, { compact: true })}
        currentValue={avgCPA}
        previousValue={previousCPA}
        format="currency"
        inverted={true} // Lower CPA is better
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
        loading={isLoading}
      />
    </div>
  );
}
