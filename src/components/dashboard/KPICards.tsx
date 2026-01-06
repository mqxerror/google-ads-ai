'use client';

import { useDashboardStats } from '@/hooks/useCampaigns';
import { useCampaignsStore } from '@/stores/campaigns-store';

// Format large numbers nicely
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 10000) {
    return Math.round(num / 1000) + 'k';
  }
  if (num >= 1000) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: num < 100 ? 1 : 0 });
}

// Get waste level based on savings
function getWasteLevel(savings: number, totalSpend: number): { level: 'none' | 'low' | 'medium' | 'high'; label: string } {
  if (savings === 0 || totalSpend === 0) {
    return { level: 'none', label: 'None detected' };
  }
  const wastePercent = (savings / totalSpend) * 100;
  if (wastePercent < 5) {
    return { level: 'low', label: 'Low' };
  }
  if (wastePercent < 15) {
    return { level: 'medium', label: 'Medium' };
  }
  return { level: 'high', label: 'High' };
}

export default function KPICards() {
  const { totalSpend, totalConversions, avgScore, potentialSavings, wasterCount } = useDashboardStats();
  const loading = useCampaignsStore((state) => state.loading);
  const lastFetchedAt = useCampaignsStore((state) => state.lastFetchedAt);

  const wasteStatus = getWasteLevel(potentialSavings, totalSpend);

  // Format last scan time
  const lastScanText = lastFetchedAt
    ? `Last scan: ${new Date(lastFetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Not yet scanned';

  const kpis = [
    {
      label: 'Total Spend',
      value: `$${formatNumber(totalSpend)}`,
      isAccent: true,
    },
    {
      label: 'Conversions',
      value: formatNumber(totalConversions),
      change: '+8.4%',
      changePositive: true,
    },
    {
      label: 'Avg AI Score',
      value: avgScore.toString(),
      change: avgScore >= 60 ? '+5 pts' : '-3 pts',
      changePositive: avgScore >= 60,
      badge: avgScore >= 70 ? '🟢' : avgScore >= 40 ? '🟡' : '🔴',
    },
    {
      label: 'Waste Detected',
      value: wasteStatus.label,
      subtext: potentialSavings > 0 ? `~$${formatNumber(potentialSavings)}/mo` : lastScanText,
      isWaste: true,
      wasteLevel: wasteStatus.level,
      highlight: wasteStatus.level === 'high',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-4 bg-surface2 rounded w-20 mb-3" />
            <div className="h-8 bg-surface2 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className={`p-5 rounded-xl ${kpi.isAccent ? 'card-accent' : 'card'} ${kpi.highlight ? 'ring-2 ring-danger/50' : ''}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm ${kpi.isAccent ? 'text-white/80' : 'text-text3'}`}>{kpi.label}</span>
            {kpi.badge && <span>{kpi.badge}</span>}
            {kpi.isWaste && (
              <span className={`w-2 h-2 rounded-full ${
                kpi.wasteLevel === 'none' ? 'bg-success' :
                kpi.wasteLevel === 'low' ? 'bg-success' :
                kpi.wasteLevel === 'medium' ? 'bg-warning' :
                'bg-danger animate-pulse'
              }`} />
            )}
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-2xl font-bold ${
              kpi.isAccent ? 'text-white' :
              kpi.isWaste && kpi.wasteLevel === 'high' ? 'text-danger' :
              kpi.isWaste && kpi.wasteLevel === 'medium' ? 'text-warning' :
              kpi.isWaste && kpi.wasteLevel === 'none' ? 'text-success' :
              'text-text'
            }`}>
              {kpi.value}
            </span>
            {kpi.subtext && (
              <span className={`text-xs ${kpi.isAccent ? 'text-white/70' : 'text-text3'}`}>
                {kpi.subtext}
              </span>
            )}
            {kpi.change && (
              <span className={`text-sm ${kpi.changePositive ? 'text-success' : 'text-danger'}`}>
                {kpi.change}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
