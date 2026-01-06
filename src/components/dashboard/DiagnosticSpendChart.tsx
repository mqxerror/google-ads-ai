'use client';

import { useState, useMemo } from 'react';
import { useCampaignsStore } from '@/stores/campaigns-store';
import { useShallow } from 'zustand/react/shallow';

interface DailySpend {
  date: string;
  spend: number;
  projected?: number;
  isAnomaly?: boolean;
  anomalyType?: 'spike' | 'drop';
  drivers?: string[];
}

interface SpendChartProps {
  monthlyBudget?: number;
}

export default function DiagnosticSpendChart({ monthlyBudget = 15000 }: SpendChartProps) {
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d' | 'mtd'>('mtd');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [showDrivers, setShowDrivers] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const campaigns = useCampaignsStore(useShallow((state) => state.campaigns));

  // Calculate total daily spend from campaigns
  const totalDailySpend = useMemo(() => {
    return campaigns.reduce((sum, c) => sum + (c.dailyBudget ?? 0), 0);
  }, [campaigns]);

  // Generate daily data for the month (simulated for now, would come from API)
  const dailyData = useMemo((): DailySpend[] => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();

    const data: DailySpend[] = [];
    let runningTotal = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(today.getFullYear(), today.getMonth(), day);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (day <= currentDay) {
        // Past/current days - actual spend with some variance
        const baseSpend = totalDailySpend || 400;
        const variance = (Math.random() - 0.5) * baseSpend * 0.3;
        const daySpend = Math.max(0, baseSpend + variance);
        runningTotal += daySpend;

        // Detect anomalies (>20% deviation from average)
        const avgSpend = runningTotal / day;
        const deviation = Math.abs(daySpend - avgSpend) / avgSpend;
        const isAnomaly = deviation > 0.25;

        data.push({
          date: dateStr,
          spend: daySpend,
          isAnomaly,
          anomalyType: isAnomaly ? (daySpend > avgSpend ? 'spike' : 'drop') : undefined,
          drivers: isAnomaly ? generateDrivers(daySpend > avgSpend) : undefined,
        });
      } else {
        // Future days - projected
        const avgDailySpend = currentDay > 0 ? runningTotal / currentDay : totalDailySpend;
        data.push({
          date: dateStr,
          spend: 0,
          projected: avgDailySpend,
        });
      }
    }

    return data;
  }, [totalDailySpend]);

  // Calculate pacing metrics
  const pacingMetrics = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const actualSpend = dailyData.slice(0, currentDay).reduce((sum, d) => sum + d.spend, 0);
    const expectedSpend = (monthlyBudget / daysInMonth) * currentDay;
    const projectedMonthEnd = (actualSpend / currentDay) * daysInMonth;

    const pacingPercent = (actualSpend / expectedSpend) * 100;
    let pacingStatus: 'on-pace' | 'over-pace' | 'under-pace';
    if (pacingPercent >= 95 && pacingPercent <= 105) {
      pacingStatus = 'on-pace';
    } else if (pacingPercent > 105) {
      pacingStatus = 'over-pace';
    } else {
      pacingStatus = 'under-pace';
    }

    return {
      actualSpend,
      expectedSpend,
      projectedMonthEnd,
      pacingPercent,
      pacingStatus,
      daysRemaining: daysInMonth - currentDay,
    };
  }, [dailyData, monthlyBudget]);

  // Get visible data based on date range
  const visibleData = useMemo(() => {
    const today = new Date().getDate();
    switch (dateRange) {
      case '7d':
        return dailyData.slice(Math.max(0, today - 7), today);
      case '14d':
        return dailyData.slice(Math.max(0, today - 14), today);
      case '30d':
      case 'mtd':
      default:
        return dailyData;
    }
  }, [dailyData, dateRange]);

  const maxSpend = Math.max(...visibleData.map(d => d.spend || d.projected || 0), monthlyBudget / 30);

  // Anomaly count
  const anomalyCount = dailyData.filter(d => d.isAnomaly).length;

  return (
    <div className="card overflow-hidden">
      {/* Header with pacing status */}
      <div className="p-4 border-b border-divider">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-text">Spend Diagnostic</h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                pacingMetrics.pacingStatus === 'on-pace'
                  ? 'bg-success/20 text-success'
                  : pacingMetrics.pacingStatus === 'over-pace'
                  ? 'bg-danger/20 text-danger'
                  : 'bg-warning/20 text-warning'
              }`}>
                {pacingMetrics.pacingStatus === 'on-pace' && 'On Pace'}
                {pacingMetrics.pacingStatus === 'over-pace' && 'Over Pace'}
                {pacingMetrics.pacingStatus === 'under-pace' && 'Under Pace'}
              </span>
              {anomalyCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent/20 text-accent">
                  {anomalyCount} anomal{anomalyCount === 1 ? 'y' : 'ies'}
                </span>
              )}
            </div>
            <p className="text-sm text-text3 mt-1">
              ${pacingMetrics.actualSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent
              <span className="mx-1">·</span>
              Projected: ${pacingMetrics.projectedMonthEnd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="mx-1">of</span>
              ${monthlyBudget.toLocaleString()} target
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Date range selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="px-3 py-1.5 bg-surface2 rounded-lg text-sm text-text border-none focus:ring-2 focus:ring-accent"
            >
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="mtd">Month to date</option>
              <option value="30d">Last 30 days</option>
            </select>

            {/* Compare toggle */}
            <button
              onClick={() => setCompareEnabled(!compareEnabled)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                compareEnabled ? 'bg-accent text-white' : 'bg-surface2 text-text2 hover:bg-divider'
              }`}
            >
              Compare
            </button>

            {/* Show drivers toggle */}
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

      {/* Chart area */}
      <div className="p-4">
        <div className="relative h-52">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-xs text-text3">
            <span>${(maxSpend / 1000).toFixed(1)}k</span>
            <span>${(maxSpend / 2000).toFixed(1)}k</span>
            <span>$0</span>
          </div>

          {/* Chart container */}
          <div className="ml-14 h-full flex items-end gap-1">
            {visibleData.map((d, i) => {
              const today = new Date().getDate();
              const dayIndex = dailyData.indexOf(d) + 1;
              const isPast = dayIndex <= today;
              const isToday = dayIndex === today;
              const barHeight = ((d.spend || d.projected || 0) / maxSpend) * 100;

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center relative group"
                  onMouseEnter={() => setHoveredDay(i)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Anomaly marker */}
                  {d.isAnomaly && (
                    <div className={`absolute -top-1 w-3 h-3 rounded-full ${
                      d.anomalyType === 'spike' ? 'bg-danger' : 'bg-warning'
                    } animate-pulse z-10`} />
                  )}

                  {/* Bar */}
                  <div
                    className={`w-full rounded-t transition-all cursor-pointer ${
                      isToday
                        ? 'bg-accent'
                        : isPast
                        ? d.isAnomaly
                          ? d.anomalyType === 'spike' ? 'bg-danger/60' : 'bg-warning/60'
                          : 'bg-accent/40'
                        : 'bg-surface2 border-2 border-dashed border-text3/30'
                    }`}
                    style={{ height: `${Math.max(barHeight, 2)}%` }}
                  />

                  {/* Tooltip */}
                  {hoveredDay === i && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 w-48 bg-surface border border-divider rounded-lg shadow-lg p-3">
                      <p className="text-xs font-medium text-text">{d.date}</p>
                      <p className="text-sm font-semibold text-text mt-1">
                        ${(d.spend || d.projected || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        {!isPast && <span className="text-text3 font-normal ml-1">(projected)</span>}
                      </p>
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

                  {/* X-axis label (show every few days) */}
                  {(i % Math.ceil(visibleData.length / 8) === 0 || i === visibleData.length - 1) && (
                    <span className="text-[10px] text-text3 mt-1 whitespace-nowrap">
                      {d.date.split(' ')[1]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Target line */}
          <div
            className="absolute left-14 right-0 border-t-2 border-dashed border-accent/50"
            style={{ bottom: `${((monthlyBudget / 30) / maxSpend) * 100}%` }}
          >
            <span className="absolute right-0 -top-4 text-xs text-accent bg-surface px-1">
              Target
            </span>
          </div>

          {/* Forecast band (faint expected range) */}
          <div
            className="absolute left-14 right-0 bg-accent/5 pointer-events-none"
            style={{
              bottom: `${(((monthlyBudget / 30) * 0.85) / maxSpend) * 100}%`,
              height: `${(((monthlyBudget / 30) * 0.3) / maxSpend) * 100}%`
            }}
          />
        </div>
      </div>

      {/* Drivers panel (expandable) */}
      {showDrivers && (
        <div className="p-4 border-t border-divider bg-surface2/30">
          <h4 className="text-sm font-medium text-text mb-3">Top Spend Drivers</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {getTopSpendDrivers(campaigns).map((driver, i) => (
              <div key={i} className="bg-surface rounded-lg p-3">
                <p className="text-xs text-text3 truncate">{driver.name}</p>
                <p className="text-sm font-semibold text-text">
                  ${driver.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className={`text-xs ${driver.change >= 0 ? 'text-success' : 'text-danger'}`}>
                  {driver.change >= 0 ? '+' : ''}{driver.change}% vs avg
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to generate anomaly drivers (would come from real analysis)
function generateDrivers(isSpike: boolean): string[] {
  const spikeDrivers = [
    'Brand Search +45% clicks',
    'Shopping campaigns ramped',
    'Competitor bidding detected',
    'New keyword expansion',
  ];
  const dropDrivers = [
    'Budget caps hit early',
    'Quality score drops',
    'Paused underperformers',
    'Seasonal decline',
  ];

  const pool = isSpike ? spikeDrivers : dropDrivers;
  return pool.slice(0, 2 + Math.floor(Math.random() * 2));
}

// Helper to get top spend drivers from campaigns
function getTopSpendDrivers(campaigns: { name: string; spend?: number }[]) {
  return campaigns
    .filter(c => c.spend)
    .sort((a, b) => (b.spend || 0) - (a.spend || 0))
    .slice(0, 4)
    .map(c => ({
      name: c.name,
      spend: c.spend || 0,
      change: Math.round((Math.random() - 0.3) * 40), // Simulated
    }));
}
