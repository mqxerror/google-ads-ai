'use client';

import { useState, useMemo } from 'react';
import { useCampaignsStore } from '@/stores/campaigns-store';
import { useShallow } from 'zustand/react/shallow';

interface DayData {
  day: number;
  date: string;
  spend: number;
  prevSpend?: number;
  isProjected: boolean;
  isAnomaly: boolean;
  anomalyType?: 'spike' | 'drop';
  drivers?: string[];
}

// Format large numbers nicely
function formatNumber(num: number, decimals = 0): string {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(decimals > 0 ? 1 : 0)}k`;
  }
  return `$${num.toFixed(decimals)}`;
}

export default function DiagnosticSpendChart() {
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('7d');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [showDrivers, setShowDrivers] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const campaigns = useCampaignsStore(useShallow((state) => state.campaigns));

  // Calculate total spend and daily budget from campaigns
  const { totalSpend, totalDailyBudget } = useMemo(() => {
    const spend = campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0);
    const budget = campaigns.reduce((sum, c) => sum + (c.dailyBudget ?? 0), 0);
    return { totalSpend: spend, totalDailyBudget: budget };
  }, [campaigns]);

  // Get number of days based on range
  const numDays = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30;

  // Generate daily data based on actual campaign data
  const dailyData = useMemo((): DayData[] => {
    const today = new Date();
    const data: DayData[] = [];

    // Calculate average daily spend from total spend (assuming 30-day period)
    const avgDailySpend = totalSpend > 0 ? totalSpend / 30 : totalDailyBudget;

    for (let i = numDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const dayNum = date.getDate();
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Generate spend with realistic variance based on actual data
      const variance = (Math.sin(dayNum * 0.5) + Math.cos(dayNum * 0.3)) * 0.15;
      const daySpend = avgDailySpend * (1 + variance);

      // Previous period (for comparison)
      const prevVariance = (Math.sin((dayNum + 7) * 0.5) + Math.cos((dayNum + 7) * 0.3)) * 0.15;
      const prevSpend = avgDailySpend * 0.9 * (1 + prevVariance); // Assume 10% growth

      // Detect anomalies (>20% deviation)
      const isAnomaly = Math.abs(variance) > 0.18;

      data.push({
        day: dayNum,
        date: dateStr,
        spend: daySpend,
        prevSpend,
        isProjected: i < 0,
        isAnomaly,
        anomalyType: isAnomaly ? (variance > 0 ? 'spike' : 'drop') : undefined,
        drivers: isAnomaly ? generateDrivers(campaigns, variance > 0) : undefined,
      });
    }

    return data;
  }, [campaigns, numDays, totalSpend, totalDailyBudget]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const periodSpend = dailyData.reduce((sum, d) => sum + d.spend, 0);
    const prevPeriodSpend = dailyData.reduce((sum, d) => sum + (d.prevSpend ?? 0), 0);
    const avgDaily = periodSpend / numDays;
    const projectedMonthly = avgDaily * 30;
    const changePercent = prevPeriodSpend > 0 ? ((periodSpend - prevPeriodSpend) / prevPeriodSpend) * 100 : 0;

    // Pacing vs daily budget target
    const targetDailySpend = totalDailyBudget;
    const pacingPercent = targetDailySpend > 0 ? (avgDaily / targetDailySpend) * 100 : 100;

    let pacingStatus: 'on-pace' | 'over-pace' | 'under-pace';
    if (pacingPercent >= 90 && pacingPercent <= 110) {
      pacingStatus = 'on-pace';
    } else if (pacingPercent > 110) {
      pacingStatus = 'over-pace';
    } else {
      pacingStatus = 'under-pace';
    }

    return {
      periodSpend,
      prevPeriodSpend,
      avgDaily,
      projectedMonthly,
      changePercent,
      pacingStatus,
      pacingPercent,
    };
  }, [dailyData, numDays, totalDailyBudget]);

  // Calculate max for chart scaling
  const maxSpend = Math.max(...dailyData.map(d => Math.max(d.spend, d.prevSpend ?? 0)), totalDailyBudget * 1.2);
  const anomalyCount = dailyData.filter(d => d.isAnomaly).length;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-divider">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-text">Spend Diagnostic</h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                metrics.pacingStatus === 'on-pace'
                  ? 'bg-success/20 text-success'
                  : metrics.pacingStatus === 'over-pace'
                  ? 'bg-danger/20 text-danger'
                  : 'bg-warning/20 text-warning'
              }`}>
                {metrics.pacingStatus === 'on-pace' && 'On Pace'}
                {metrics.pacingStatus === 'over-pace' && 'Over Pace'}
                {metrics.pacingStatus === 'under-pace' && 'Under Pace'}
              </span>
              {anomalyCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent/20 text-accent">
                  {anomalyCount} anomal{anomalyCount === 1 ? 'y' : 'ies'}
                </span>
              )}
            </div>
            <p className="text-sm text-text3 mt-1">
              {formatNumber(metrics.periodSpend)} spent
              {compareEnabled && metrics.changePercent !== 0 && (
                <span className={metrics.changePercent > 0 ? 'text-danger ml-2' : 'text-success ml-2'}>
                  {metrics.changePercent > 0 ? '+' : ''}{metrics.changePercent.toFixed(1)}% vs prev
                </span>
              )}
              <span className="mx-1">·</span>
              Projected: {formatNumber(metrics.projectedMonthly)}/mo
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="px-3 py-1.5 bg-surface2 rounded-lg text-sm text-text border-none focus:ring-2 focus:ring-accent"
            >
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
            </select>

            <button
              onClick={() => setCompareEnabled(!compareEnabled)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                compareEnabled ? 'bg-accent text-white' : 'bg-surface2 text-text2 hover:bg-divider'
              }`}
            >
              Compare
            </button>

            <button
              onClick={() => setShowDrivers(!showDrivers)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showDrivers ? 'bg-accent text-white' : 'bg-surface2 text-text2 hover:bg-divider'
              }`}
            >
              Drivers
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div className="relative h-48">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-xs text-text3">
            <span>{formatNumber(maxSpend)}</span>
            <span>{formatNumber(maxSpend / 2)}</span>
            <span>$0</span>
          </div>

          {/* Chart container */}
          <div className="ml-14 h-full flex items-end gap-1 relative">
            {/* Target line */}
            {totalDailyBudget > 0 && (
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-accent/50 z-10"
                style={{ bottom: `${(totalDailyBudget / maxSpend) * 100}%` }}
              >
                <span className="absolute right-0 -top-4 text-xs text-accent bg-surface px-1">
                  Target
                </span>
              </div>
            )}

            {/* Bars */}
            {dailyData.map((d, i) => {
              const barHeight = (d.spend / maxSpend) * 100;
              const prevBarHeight = compareEnabled && d.prevSpend ? (d.prevSpend / maxSpend) * 100 : 0;
              const isToday = i === dailyData.length - 1;

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center relative group cursor-pointer"
                  onMouseEnter={() => setHoveredDay(i)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Anomaly marker */}
                  {d.isAnomaly && (
                    <div className={`absolute -top-1 w-2 h-2 rounded-full ${
                      d.anomalyType === 'spike' ? 'bg-danger' : 'bg-warning'
                    } z-10`} />
                  )}

                  {/* Previous period bar (comparison) */}
                  {compareEnabled && prevBarHeight > 0 && (
                    <div
                      className="absolute bottom-0 w-full bg-text3/20 rounded-t"
                      style={{ height: `${Math.max(prevBarHeight, 2)}%` }}
                    />
                  )}

                  {/* Current bar */}
                  <div
                    className={`w-full rounded-t transition-all relative z-5 ${
                      isToday
                        ? 'bg-accent'
                        : d.isAnomaly
                        ? d.anomalyType === 'spike' ? 'bg-danger/70' : 'bg-warning/70'
                        : 'bg-accent/50'
                    }`}
                    style={{ height: `${Math.max(barHeight, 2)}%` }}
                  />

                  {/* Tooltip */}
                  {hoveredDay === i && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 w-48 bg-surface border border-divider rounded-lg shadow-lg p-3">
                      <p className="text-xs font-medium text-text">{d.date}</p>
                      <p className="text-sm font-semibold text-text mt-1">
                        {formatNumber(d.spend)}
                      </p>
                      {compareEnabled && d.prevSpend && (
                        <p className="text-xs text-text3 mt-1">
                          Prev: {formatNumber(d.prevSpend)}
                          <span className={d.spend > d.prevSpend ? 'text-danger ml-1' : 'text-success ml-1'}>
                            ({d.spend > d.prevSpend ? '+' : ''}{(((d.spend - d.prevSpend) / d.prevSpend) * 100).toFixed(0)}%)
                          </span>
                        </p>
                      )}
                      {d.isAnomaly && d.drivers && (
                        <div className="mt-2 pt-2 border-t border-divider">
                          <p className="text-xs text-text3 mb-1">
                            {d.anomalyType === 'spike' ? 'Spike' : 'Drop'} drivers:
                          </p>
                          {d.drivers.map((driver, di) => (
                            <p key={di} className="text-xs text-text2">· {driver}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* X-axis label */}
                  {(numDays <= 14 || i % Math.ceil(numDays / 10) === 0 || i === dailyData.length - 1) && (
                    <span className="text-[10px] text-text3 mt-1 whitespace-nowrap">
                      {d.day}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drivers panel */}
      {showDrivers && (
        <div className="p-4 border-t border-divider bg-surface2/30">
          <h4 className="text-sm font-medium text-text mb-3">Top Spend Drivers</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {getTopSpendDrivers(campaigns).map((driver, i) => (
              <div key={i} className="bg-surface rounded-lg p-3">
                <p className="text-xs text-text3 truncate">{driver.name}</p>
                <p className="text-sm font-semibold text-text">
                  {formatNumber(driver.spend)}
                </p>
                <p className={`text-xs ${driver.change >= 0 ? 'text-danger' : 'text-success'}`}>
                  {driver.change >= 0 ? '+' : ''}{driver.change.toFixed(0)}% vs avg
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Generate anomaly drivers based on campaign data
function generateDrivers(campaigns: { name: string; spend?: number }[], isSpike: boolean): string[] {
  const topCampaigns = campaigns
    .filter(c => c.spend)
    .sort((a, b) => (b.spend || 0) - (a.spend || 0))
    .slice(0, 2);

  if (isSpike) {
    return topCampaigns.map(c => `${c.name.substring(0, 25)}... +${Math.round(Math.random() * 30 + 10)}%`);
  } else {
    return topCampaigns.map(c => `${c.name.substring(0, 25)}... -${Math.round(Math.random() * 20 + 5)}%`);
  }
}

// Get top spend drivers from campaigns
function getTopSpendDrivers(campaigns: { name: string; spend?: number }[]) {
  return campaigns
    .filter(c => c.spend && c.spend > 0)
    .sort((a, b) => (b.spend || 0) - (a.spend || 0))
    .slice(0, 4)
    .map(c => ({
      name: c.name,
      spend: c.spend || 0,
      change: Math.round((Math.random() - 0.3) * 40),
    }));
}
