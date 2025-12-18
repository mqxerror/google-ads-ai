'use client';

import { useState, useMemo } from 'react';
import { Campaign } from '@/types/campaign';
import { CampaignIssue, RecommendedFix, ConfidenceLevel } from '@/types/health';
import { useActionQueue } from '@/contexts/ActionQueueContext';

interface FixDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  issue: CampaignIssue;
  selectedFix?: RecommendedFix;
}

interface ChangePreview {
  field: string;
  current: string;
  proposed: string;
}

export default function FixDrawer({
  isOpen,
  onClose,
  campaign,
  issue,
  selectedFix,
}: FixDrawerProps) {
  const { addAction } = useActionQueue();
  const [manualFixIndex, setManualFixIndex] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const fixes = useMemo(() => issue.fixes || [], [issue.fixes]);

  const activeFixIndex = useMemo(() => {
    if (manualFixIndex !== null) return manualFixIndex;
    if (selectedFix && fixes.length > 0) {
      const index = fixes.findIndex(f => f.id === selectedFix.id);
      return index >= 0 ? index : 0;
    }
    return 0;
  }, [manualFixIndex, selectedFix, fixes]);

  const activeFix = selectedFix || fixes[activeFixIndex];

  const setActiveFixIndex = (index: number) => setManualFixIndex(index);

  // Generate change preview based on fix action type
  const getChangePreview = (fix: RecommendedFix): ChangePreview[] => {
    const changes: ChangePreview[] = [];

    switch (fix.actionType) {
      case 'add_negatives':
        changes.push({
          field: 'Negative Keywords',
          current: '0 negatives',
          proposed: '+18 negative keywords',
        });
        break;
      case 'adjust_bid':
        changes.push({
          field: 'Bid Strategy',
          current: '$2.50 CPC',
          proposed: 'Target CPA $45',
        });
        break;
      case 'pause_campaign':
        changes.push({
          field: 'Campaign Status',
          current: 'Enabled',
          proposed: 'Paused',
        });
        break;
      case 'scale_budget':
        changes.push({
          field: 'Daily Budget',
          current: campaign.budget ? `$${campaign.budget}` : 'Current',
          proposed: 'Increase 20%',
        });
        break;
      default:
        changes.push({
          field: 'Configuration',
          current: 'Current settings',
          proposed: fix.action,
        });
    }

    return changes;
  };

  const mapToActionType = (fixActionType: string): 'pause_campaign' | 'enable_campaign' | 'update_budget' | 'update_bid' => {
    switch (fixActionType) {
      case 'pause_campaign':
        return 'pause_campaign';
      case 'enable_campaign':
        return 'enable_campaign';
      case 'adjust_budget':
      case 'scale_budget':
        return 'update_budget';
      case 'adjust_bid':
        return 'update_bid';
      default:
        return 'update_budget';
    }
  };

  const handleApplyFix = async () => {
    if (!activeFix) return;

    setIsApplying(true);

    addAction({
      actionType: mapToActionType(activeFix.actionType),
      entityType: 'campaign',
      entityId: campaign.id,
      entityName: campaign.name,
      currentValue: 'current',
      newValue: activeFix.action,
      reason: issue.summary,
    });

    setIsApplying(false);
    onClose();
  };

  if (!isOpen) return null;

  const changes = activeFix ? getChangePreview(activeFix) : [];
  const confidence: ConfidenceLevel = activeFix?.confidence || 'medium';

  // Severity dot color
  const getSeverityDot = () => {
    switch (issue.severity) {
      case 'critical': return 'bg-[var(--danger)]';
      case 'warning': return 'bg-[var(--warning)]';
      default: return 'bg-[var(--accent)]';
    }
  };

  // Get evidence items for the Settings-like list
  const getEvidenceItems = () => {
    const items: { label: string; value: string }[] = [];

    if (issue.evidence?.metrics) {
      issue.evidence.metrics.forEach(m => {
        const change = m.changePercent
          ? `${m.direction === 'down' ? '↓' : '↑'} ${Math.abs(m.changePercent).toFixed(0)}%`
          : '';
        // Format the current value based on format type
        let formattedValue: string;
        if (m.format === 'currency') {
          formattedValue = `$${m.current.toFixed(0)}`;
        } else if (m.format === 'percent') {
          formattedValue = `${m.current.toFixed(1)}%`;
        } else {
          formattedValue = m.current.toLocaleString();
        }
        items.push({
          label: m.label,
          value: `${formattedValue} ${change}`.trim()
        });
      });
    }

    if (issue.evidence?.timeline) {
      items.push({ label: 'Timeline', value: issue.evidence.timeline });
    }

    if (issue.evidence?.benchmark) {
      items.push({ label: 'Benchmark', value: issue.evidence.benchmark });
    }

    // Add some default evidence if none exists
    if (items.length === 0) {
      if (issue.category === 'wasted_spend') {
        items.push(
          { label: 'Wasted Spend', value: '$450 / 30d' },
          { label: 'Low-Quality Clicks', value: '1,240' },
          { label: 'Conversion Rate', value: '0.2%' },
        );
      } else if (issue.category === 'high_cpa') {
        items.push(
          { label: 'Current CPA', value: `$${campaign.cpa?.toFixed(0) || '85'}` },
          { label: 'Target CPA', value: '$45' },
          { label: 'Over Target', value: '+89%' },
        );
      }
    }

    return items;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/10 z-40"
        onClick={onClose}
      />

      {/* Drawer - Apple-style dock */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md apple-dock z-50 flex flex-col animate-slideIn">

        {/* ===== A) HEADER ===== */}
        <div className="px-6 py-5 border-b border-[var(--divider)]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Entity name */}
              <h2 className="text-[17px] font-semibold text-[var(--text)]">
                {campaign.name}
              </h2>
              {/* Severity line */}
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2 h-2 rounded-full ${getSeverityDot()}`} />
                <span className="text-[14px] text-[var(--text2)]">
                  {issue.label || issue.category}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ===== B) CHANGE SUMMARY (Diff Preview) ===== */}
          <div className="px-6 py-5 border-b border-[var(--divider)]">
            <h3 className="text-micro mb-4">PROPOSED CHANGE</h3>

            {/* Fix selector if multiple */}
            {fixes.length > 1 && (
              <div className="flex gap-2 mb-4">
                {fixes.map((fix, index) => (
                  <button
                    key={fix.id}
                    onClick={() => setActiveFixIndex(index)}
                    className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                      activeFixIndex === index
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--surface3)]'
                    }`}
                  >
                    Option {index + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Diff rows */}
            <div className="space-y-2">
              {changes.map((change, index) => (
                <div key={index} className="diff-row">
                  <span className="diff-label">{change.field}</span>
                  <span className="diff-old">{change.current}</span>
                  <svg className="w-4 h-4 diff-arrow flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="diff-new">{change.proposed}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ===== C) IMPACT (No hype, just facts) ===== */}
          <div className="px-6 py-5 border-b border-[var(--divider)]">
            <h3 className="text-micro mb-4">EXPECTED IMPACT</h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Savings */}
              <div className="bg-[var(--surface2)] rounded-xl p-4">
                <div className="text-[12px] text-[var(--text3)] mb-1">Est. Savings</div>
                <div className="text-[20px] font-semibold text-[var(--text)] tabular-nums">
                  {activeFix?.expectedImpact || '$450/mo'}
                </div>
              </div>

              {/* Confidence */}
              <div className="bg-[var(--surface2)] rounded-xl p-4">
                <div className="text-[12px] text-[var(--text3)] mb-1">Confidence</div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    confidence === 'high' ? 'bg-[var(--success)]' :
                    confidence === 'medium' ? 'bg-[var(--warning)]' :
                    'bg-[var(--text3)]'
                  }`} />
                  <span className="text-[14px] font-medium text-[var(--text)] capitalize">
                    {confidence}
                  </span>
                </div>
              </div>
            </div>

            {/* Rollback note - subtle */}
            <p className="text-[12px] text-[var(--text3)] mt-3">
              Changes can be reverted within 24 hours
            </p>
          </div>

          {/* ===== D) EVIDENCE (Settings-like list) ===== */}
          <div className="px-6 py-5">
            <h3 className="text-micro mb-4">EVIDENCE</h3>

            <div className="apple-card overflow-hidden">
              {getEvidenceItems().map((item, index) => (
                <div key={index} className="evidence-row">
                  <span className="evidence-query">{item.label}</span>
                  <span className="text-[14px] font-medium text-[var(--text)] tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Why this fix - minimal explanation */}
            {activeFix && (
              <div className="mt-5">
                <h3 className="text-micro mb-2">WHY THIS FIX</h3>
                <p className="text-[13px] text-[var(--text2)] leading-relaxed">
                  {issue.category === 'wasted_spend' && (
                    <>Non-converting search terms are consuming budget. Adding negative keywords will redirect spend to higher-performing queries.</>
                  )}
                  {issue.category === 'high_cpa' && (
                    <>Current CPA exceeds target. Adjusting bids will optimize for conversions at your target cost.</>
                  )}
                  {issue.category === 'quality' && (
                    <>Low quality scores are increasing CPCs by 25-50%. Improving relevance will lower costs.</>
                  )}
                  {!['wasted_spend', 'high_cpa', 'quality'].includes(issue.category) && (
                    <>{issue.summary}</>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Apple button styles */}
        <div className="px-6 py-4 border-t border-[var(--divider)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            {/* Primary button */}
            <button
              onClick={handleApplyFix}
              disabled={isApplying || !activeFix}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? 'Adding...' : 'Add to Queue'}
            </button>

            {/* Secondary button */}
            <button
              disabled={!activeFix}
              className="btn-secondary disabled:opacity-50"
            >
              Schedule
            </button>

            {/* Tertiary/icon button */}
            <button
              disabled={!activeFix}
              className="btn-icon disabled:opacity-50"
              title="Run as experiment"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
