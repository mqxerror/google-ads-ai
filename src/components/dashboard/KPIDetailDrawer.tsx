'use client';

import { useCampaignsStore } from '@/stores/campaigns-store';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStats } from '@/hooks/useCampaigns';

type KPIType = 'spend' | 'conversions' | 'score' | 'waste';

interface KPIDetailDrawerProps {
  type: KPIType | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 10000) return `$${Math.round(num / 1000)}k`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return `$${num.toFixed(0)}`;
}

export default function KPIDetailDrawer({ type, isOpen, onClose }: KPIDetailDrawerProps) {
  const campaigns = useCampaignsStore(useShallow((state) => state.campaigns));
  const { totalSpend, totalConversions, avgScore, potentialSavings, wasterCount } = useDashboardStats();

  if (!isOpen || !type) return null;

  const getTitle = () => {
    switch (type) {
      case 'spend': return 'Spend Breakdown';
      case 'conversions': return 'Conversion Analysis';
      case 'score': return 'Portfolio Health';
      case 'waste': return 'Waste Analysis';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'spend': return '💰';
      case 'conversions': return '🎯';
      case 'score': return '📊';
      case 'waste': return '🗑️';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-surface shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-divider px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getIcon()}</span>
            <h2 className="text-lg font-semibold text-text">{getTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {type === 'spend' && <SpendBreakdown campaigns={campaigns} totalSpend={totalSpend} />}
          {type === 'conversions' && <ConversionAnalysis campaigns={campaigns} totalConversions={totalConversions} />}
          {type === 'score' && <PortfolioHealth campaigns={campaigns} avgScore={avgScore} />}
          {type === 'waste' && <WasteAnalysis campaigns={campaigns} potentialSavings={potentialSavings} wasterCount={wasterCount} />}
        </div>
      </div>
    </>
  );
}

// Spend Breakdown Component
function SpendBreakdown({ campaigns, totalSpend }: { campaigns: any[]; totalSpend: number }) {
  const sortedBySpend = [...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0));
  const topSpenders = sortedBySpend.slice(0, 5);

  // Group by status
  const enabledSpend = campaigns.filter(c => c.status === 'ENABLED').reduce((s, c) => s + (c.spend || 0), 0);
  const pausedSpend = campaigns.filter(c => c.status === 'PAUSED').reduce((s, c) => s + (c.spend || 0), 0);

  // Group by type
  const byType: Record<string, number> = {};
  campaigns.forEach(c => {
    const type = c.type || 'UNKNOWN';
    byType[type] = (byType[type] || 0) + (c.spend || 0);
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-accent/10 rounded-xl p-4">
        <p className="text-sm text-text3">Total Spend</p>
        <p className="text-3xl font-bold text-accent">{formatNumber(totalSpend)}</p>
        <p className="text-xs text-text3 mt-1">Across {campaigns.length} campaigns</p>
      </div>

      {/* By Status */}
      <div>
        <h4 className="text-sm font-medium text-text mb-3">By Status</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center p-3 bg-surface2 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm text-text">Enabled</span>
            </div>
            <span className="font-medium text-text">{formatNumber(enabledSpend)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-surface2 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-text3" />
              <span className="text-sm text-text">Paused</span>
            </div>
            <span className="font-medium text-text">{formatNumber(pausedSpend)}</span>
          </div>
        </div>
      </div>

      {/* By Type */}
      <div>
        <h4 className="text-sm font-medium text-text mb-3">By Campaign Type</h4>
        <div className="space-y-2">
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, spend]) => (
            <div key={type} className="flex justify-between items-center p-3 bg-surface2 rounded-lg">
              <span className="text-sm text-text">{type.replace('_', ' ')}</span>
              <div className="text-right">
                <span className="font-medium text-text">{formatNumber(spend)}</span>
                <span className="text-xs text-text3 ml-2">
                  ({((spend / totalSpend) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Spenders */}
      <div>
        <h4 className="text-sm font-medium text-text mb-3">Top Spenders</h4>
        <div className="space-y-2">
          {topSpenders.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 p-3 bg-surface2 rounded-lg">
              <span className="text-sm font-medium text-text3 w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text truncate">{c.name}</p>
                <p className="text-xs text-text3">{c.conversions || 0} conversions</p>
              </div>
              <span className="font-medium text-text">{formatNumber(c.spend || 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Conversion Analysis Component
function ConversionAnalysis({ campaigns, totalConversions }: { campaigns: any[]; totalConversions: number }) {
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0);
  const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

  const sortedByConv = [...campaigns].filter(c => c.conversions > 0).sort((a, b) => (b.conversions || 0) - (a.conversions || 0));
  const topConverters = sortedByConv.slice(0, 5);

  // Campaigns with zero conversions
  const zeroConv = campaigns.filter(c => (c.conversions || 0) === 0 && (c.spend || 0) > 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-success/10 rounded-xl p-4">
        <p className="text-sm text-text3">Total Conversions</p>
        <p className="text-3xl font-bold text-success">{totalConversions.toLocaleString()}</p>
        <p className="text-xs text-text3 mt-1">Avg CPA: {formatNumber(avgCPA)}</p>
      </div>

      {/* Conversion Funnel */}
      <div>
        <h4 className="text-sm font-medium text-text mb-3">Funnel Overview</h4>
        <div className="space-y-2">
          {[
            { label: 'Campaigns', value: campaigns.length, icon: '📊' },
            { label: 'With Clicks', value: campaigns.filter(c => (c.clicks || 0) > 0).length, icon: '👆' },
            { label: 'With Conversions', value: campaigns.filter(c => (c.conversions || 0) > 0).length, icon: '✅' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface2 rounded-lg">
              <span>{item.icon}</span>
              <span className="flex-1 text-sm text-text">{item.label}</span>
              <span className="font-medium text-text">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Converters */}
      <div>
        <h4 className="text-sm font-medium text-text mb-3">Top Converting Campaigns</h4>
        <div className="space-y-2">
          {topConverters.map((c, i) => {
            const cpa = c.conversions > 0 ? (c.spend || 0) / c.conversions : 0;
            return (
              <div key={c.id} className="flex items-center gap-3 p-3 bg-surface2 rounded-lg">
                <span className="text-sm font-medium text-text3 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{c.name}</p>
                  <p className="text-xs text-text3">CPA: {formatNumber(cpa)}</p>
                </div>
                <span className="font-medium text-success">{c.conversions}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zero Conversion Warning */}
      {zeroConv.length > 0 && (
        <div className="bg-warning/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span>⚠️</span>
            <h4 className="text-sm font-medium text-warning">Spending Without Conversions</h4>
          </div>
          <p className="text-sm text-text2">
            {zeroConv.length} campaign{zeroConv.length > 1 ? 's' : ''} spent{' '}
            <strong>{formatNumber(zeroConv.reduce((s, c) => s + (c.spend || 0), 0))}</strong> without any conversions.
          </p>
        </div>
      )}
    </div>
  );
}

// Portfolio Health Component
function PortfolioHealth({ campaigns, avgScore }: { campaigns: any[]; avgScore: number }) {
  const excellent = campaigns.filter(c => (c.aiScore ?? 0) >= 70).length;
  const good = campaigns.filter(c => (c.aiScore ?? 0) >= 40 && (c.aiScore ?? 0) < 70).length;
  const poor = campaigns.filter(c => (c.aiScore ?? 0) < 40).length;

  const sortedByScore = [...campaigns].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
  const worstCampaigns = sortedByScore.slice(-3).reverse();

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={`rounded-xl p-4 ${avgScore >= 70 ? 'bg-success/10' : avgScore >= 40 ? 'bg-warning/10' : 'bg-danger/10'}`}>
        <p className="text-sm text-text3">Portfolio Score</p>
        <p className={`text-3xl font-bold ${avgScore >= 70 ? 'text-success' : avgScore >= 40 ? 'text-warning' : 'text-danger'}`}>
          {avgScore}
        </p>
        <p className="text-xs text-text3 mt-1">
          {avgScore >= 70 ? 'Excellent health' : avgScore >= 40 ? 'Needs attention' : 'Critical issues'}
        </p>
      </div>

      {/* Distribution */}
      <div>
        <h4 className="text-sm font-medium text-text mb-3">Score Distribution</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-surface2 rounded-lg">
            <span className="text-lg">🟢</span>
            <span className="flex-1 text-sm text-text">Excellent (70+)</span>
            <span className="font-medium text-success">{excellent}</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-surface2 rounded-lg">
            <span className="text-lg">🟡</span>
            <span className="flex-1 text-sm text-text">Good (40-69)</span>
            <span className="font-medium text-warning">{good}</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-surface2 rounded-lg">
            <span className="text-lg">🔴</span>
            <span className="flex-1 text-sm text-text">Poor (&lt;40)</span>
            <span className="font-medium text-danger">{poor}</span>
          </div>
        </div>
      </div>

      {/* Visual Bar */}
      <div>
        <h4 className="text-sm font-medium text-text mb-3">Visual Breakdown</h4>
        <div className="h-4 rounded-full overflow-hidden flex">
          {excellent > 0 && (
            <div
              className="bg-success h-full"
              style={{ width: `${(excellent / campaigns.length) * 100}%` }}
            />
          )}
          {good > 0 && (
            <div
              className="bg-warning h-full"
              style={{ width: `${(good / campaigns.length) * 100}%` }}
            />
          )}
          {poor > 0 && (
            <div
              className="bg-danger h-full"
              style={{ width: `${(poor / campaigns.length) * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Needs Attention */}
      {poor > 0 && (
        <div>
          <h4 className="text-sm font-medium text-text mb-3">Needs Immediate Attention</h4>
          <div className="space-y-2">
            {worstCampaigns.map((c) => (
              <div key={c.id} className="p-3 bg-danger/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text truncate">{c.name}</p>
                  <span className="px-2 py-0.5 bg-danger/20 text-danger text-xs font-medium rounded-full">
                    {c.aiScore ?? 0}
                  </span>
                </div>
                <p className="text-xs text-text3 mt-1">
                  Spent {formatNumber(c.spend || 0)} · {c.conversions || 0} conversions
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Waste Analysis Component
function WasteAnalysis({ campaigns, potentialSavings, wasterCount }: { campaigns: any[]; potentialSavings: number; wasterCount: number }) {
  const wasters = campaigns.filter(c => (c.aiScore ?? 100) < 40);
  const totalWastedSpend = wasters.reduce((s, c) => s + (c.spend || 0), 0);

  // Categorize waste
  const noConversions = campaigns.filter(c => (c.conversions || 0) === 0 && (c.spend || 0) > 100);
  const highCPA = campaigns.filter(c => {
    const cpa = c.conversions > 0 ? (c.spend || 0) / c.conversions : 0;
    return cpa > 100 && c.conversions > 0;
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-danger/10 rounded-xl p-4">
        <p className="text-sm text-text3">Potential Savings</p>
        <p className="text-3xl font-bold text-danger">{formatNumber(potentialSavings)}/mo</p>
        <p className="text-xs text-text3 mt-1">{wasterCount} underperforming campaigns</p>
      </div>

      {/* Waste Categories */}
      <div>
        <h4 className="text-sm font-medium text-text mb-3">Waste Categories</h4>
        <div className="space-y-2">
          <div className="p-3 bg-surface2 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🚫</span>
                <span className="text-sm text-text">Zero Conversions</span>
              </div>
              <span className="text-sm font-medium text-danger">{noConversions.length}</span>
            </div>
            {noConversions.length > 0 && (
              <p className="text-xs text-text3 mt-1">
                Spending {formatNumber(noConversions.reduce((s, c) => s + (c.spend || 0), 0))} without results
              </p>
            )}
          </div>
          <div className="p-3 bg-surface2 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>💸</span>
                <span className="text-sm text-text">High CPA (&gt;$100)</span>
              </div>
              <span className="text-sm font-medium text-warning">{highCPA.length}</span>
            </div>
          </div>
          <div className="p-3 bg-surface2 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>📉</span>
                <span className="text-sm text-text">Low AI Score (&lt;40)</span>
              </div>
              <span className="text-sm font-medium text-danger">{wasterCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Wasters */}
      {wasters.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-text mb-3">Biggest Wasters</h4>
          <div className="space-y-2">
            {wasters.slice(0, 5).map((c) => (
              <div key={c.id} className="p-3 bg-danger/5 border border-danger/20 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-text truncate flex-1">{c.name}</p>
                  <span className="text-sm font-medium text-danger">{formatNumber(c.spend || 0)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text3">
                  <span>Score: {c.aiScore ?? 0}</span>
                  <span>·</span>
                  <span>{c.conversions || 0} conv</span>
                  <span>·</span>
                  <span>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="bg-accent/10 rounded-xl p-4">
        <h4 className="text-sm font-medium text-accent mb-2">Recommended Action</h4>
        <p className="text-sm text-text2">
          Pause the {wasterCount} underperforming campaigns to save approximately {formatNumber(potentialSavings)} per month.
        </p>
      </div>
    </div>
  );
}
