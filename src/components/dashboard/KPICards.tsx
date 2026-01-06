'use client';

import { useDashboardStats } from '@/hooks/useCampaigns';
import { useCampaignsStore } from '@/stores/campaigns-store';

export default function KPICards() {
  const { totalSpend, totalConversions, avgScore, potentialSavings, wasterCount } = useDashboardStats();
  const loading = useCampaignsStore((state) => state.loading);

  const kpis = [
    {
      label: 'Total Spend',
      value: `$${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      isAccent: true,
    },
    {
      label: 'Conversions',
      value: totalConversions.toLocaleString(),
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
      label: 'Potential Savings',
      value: `$${Math.round(potentialSavings).toLocaleString()}`,
      subtext: '/month',
      highlight: wasterCount > 0,
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
          className={`p-5 rounded-xl ${kpi.isAccent ? 'card-accent' : 'card'} ${kpi.highlight ? 'ring-2 ring-red-500/50' : ''}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm ${kpi.isAccent ? 'text-white/80' : 'text-text3'}`}>{kpi.label}</span>
            {kpi.badge && <span>{kpi.badge}</span>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${kpi.isAccent ? 'text-white' : 'text-text'}`}>
              {kpi.value}
            </span>
            {kpi.subtext && (
              <span className={`text-sm ${kpi.isAccent ? 'text-white/70' : 'text-text3'}`}>
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
