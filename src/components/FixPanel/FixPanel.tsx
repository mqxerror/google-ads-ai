'use client';

import { useState, useMemo } from 'react';
import { Campaign } from '@/types/campaign';
import { CampaignIssue, RecommendedFix, ConfidenceLevel } from '@/types/health';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import { DiffView, SafeApplyModal, ApplyMode } from '@/components/OpsCenter';
import type { DiffItem } from '@/components/OpsCenter';

interface FixPanelProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  issue: CampaignIssue;
  selectedFix?: RecommendedFix;
}

interface EvidenceItem {
  id: string;
  query: string;
  clicks: number;
  cost: number;
  conversions: number;
  matchType: 'Exact' | 'Phrase' | 'Broad';
  included: boolean;
}

// Generate mock evidence for demo
function generateMockEvidence(issue: CampaignIssue): EvidenceItem[] {
  if (issue.category === 'wasted_spend') {
    return [
      { id: '1', query: 'free software download', clicks: 342, cost: 85.50, conversions: 0, matchType: 'Phrase', included: true },
      { id: '2', query: 'cheap alternative', clicks: 287, cost: 71.75, conversions: 0, matchType: 'Phrase', included: true },
      { id: '3', query: 'open source tool', clicks: 198, cost: 49.50, conversions: 0, matchType: 'Exact', included: true },
      { id: '4', query: 'free trial no credit card', clicks: 156, cost: 39.00, conversions: 0, matchType: 'Phrase', included: true },
      { id: '5', query: 'competitor vs product', clicks: 134, cost: 33.50, conversions: 1, matchType: 'Exact', included: false },
      { id: '6', query: 'budget option', clicks: 98, cost: 24.50, conversions: 0, matchType: 'Broad', included: true },
    ];
  }
  return [
    { id: '1', query: 'generic search term', clicks: 200, cost: 50.00, conversions: 1, matchType: 'Broad', included: true },
    { id: '2', query: 'broad match keyword', clicks: 150, cost: 37.50, conversions: 0, matchType: 'Broad', included: true },
  ];
}

export default function FixPanel({
  isOpen,
  onClose,
  campaign,
  issue,
  selectedFix,
}: FixPanelProps) {
  const { addAction } = useActionQueue();
  const [isApplying, setIsApplying] = useState(false);
  const [enableRollback, setEnableRollback] = useState(true);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>(() => generateMockEvidence(issue));
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showDiffView, setShowDiffView] = useState(false);

  const fixes = useMemo(() => issue.fixes || [], [issue.fixes]);
  const activeFix = selectedFix || fixes[0];
  const confidence: ConfidenceLevel = activeFix?.confidence || 'high';

  // Calculate stats from evidence
  const includedCount = evidenceItems.filter(e => e.included).length;
  const totalCost = evidenceItems.filter(e => e.included).reduce((sum, e) => sum + e.cost, 0);
  const estimatedSavingsLow = Math.round(totalCost * 0.7);
  const estimatedSavingsHigh = Math.round(totalCost * 1.1);

  // Generate diff items for the DiffView
  const diffItems: DiffItem[] = useMemo(() => {
    const items: DiffItem[] = [];

    // Add negatives being added
    if (issue.category === 'wasted_spend') {
      items.push({
        field: 'negative_keywords',
        label: 'Negative Keywords',
        currentValue: 0,
        newValue: includedCount,
        type: 'modify',
      });

      // Add individual keywords as additions
      evidenceItems.filter(e => e.included).forEach((item) => {
        items.push({
          field: `neg_${item.id}`,
          label: `"${item.query}" (${item.matchType})`,
          currentValue: null,
          newValue: `Block (${item.matchType})`,
          type: 'add',
        });
      });
    }

    // Add budget changes if applicable
    if (activeFix?.actionType === 'adjust_budget' || activeFix?.actionType === 'scale_budget') {
      items.push({
        field: 'daily_budget',
        label: 'Daily Budget',
        currentValue: `$${campaign.budget?.toFixed(2) || '0.00'}`,
        newValue: activeFix.action,
        type: 'modify',
      });
    }

    // Add status changes
    if (activeFix?.actionType === 'pause_campaign') {
      items.push({
        field: 'status',
        label: 'Campaign Status',
        currentValue: 'Enabled',
        newValue: 'Paused',
        type: 'modify',
      });
    }

    return items;
  }, [issue.category, evidenceItems, activeFix, campaign.budget, includedCount]);

  const toggleEvidence = (id: string) => {
    setEvidenceItems(items =>
      items.map(item =>
        item.id === id ? { ...item, included: !item.included } : item
      )
    );
  };

  const updateMatchType = (id: string, matchType: 'Exact' | 'Phrase' | 'Broad') => {
    setEvidenceItems(items =>
      items.map(item =>
        item.id === id ? { ...item, matchType } : item
      )
    );
  };

  const mapToActionType = (fixActionType: string): 'pause_campaign' | 'enable_campaign' | 'update_budget' | 'update_bid' => {
    switch (fixActionType) {
      case 'pause_campaign': return 'pause_campaign';
      case 'enable_campaign': return 'enable_campaign';
      case 'adjust_budget':
      case 'scale_budget': return 'update_budget';
      default: return 'update_bid';
    }
  };

  const handleApplyFix = async () => {
    // Open the safe apply modal instead of applying directly
    setShowApplyModal(true);
  };

  const handleApplyWithMode = (mode: ApplyMode) => {
    if (!activeFix) return;
    setIsApplying(true);

    // Add the action with the selected mode
    addAction({
      actionType: mapToActionType(activeFix.actionType),
      entityType: 'campaign',
      entityId: campaign.id,
      entityName: campaign.name,
      currentValue: 'current',
      newValue: activeFix.action,
      reason: issue.summary,
      // Include mode info for later processing
      metadata: { applyMode: mode, enableRollback },
    });

    setIsApplying(false);
    setShowApplyModal(false);
    onClose();
  };

  if (!isOpen) return null;

  // Get severity styling
  const getSeverityStyle = () => {
    switch (issue.severity) {
      case 'critical': return { dot: 'bg-[var(--danger)]', label: 'Critical' };
      case 'warning': return { dot: 'bg-[var(--warning)]', label: 'Warning' };
      default: return { dot: 'bg-[var(--accent)]', label: 'Info' };
    }
  };
  const severity = getSeverityStyle();

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-[var(--divider)] bg-[var(--surface)] flex flex-col h-full">
      {/* ===== STICKY HEADER ===== */}
      <div className="px-5 py-4 border-b border-[var(--divider)] bg-[var(--surface)] sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              Review Fix
            </h2>
            {/* Campaign name - secondary */}
            <p className="text-[13px] text-[var(--text2)] mt-0.5 truncate">
              {campaign.name}
            </p>
          </div>
          {/* Confidence badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${
              confidence === 'high'
                ? 'bg-[var(--success)]/10 text-[var(--success)]'
                : confidence === 'medium'
                  ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                  : 'bg-[var(--text3)]/10 text-[var(--text3)]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                confidence === 'high' ? 'bg-[var(--success)]' :
                confidence === 'medium' ? 'bg-[var(--warning)]' : 'bg-[var(--text3)]'
              }`} />
              {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
            </span>
            {/* Close button */}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--surface2)] text-[var(--text2)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <div className="flex-1 overflow-y-auto">
        {/* Section 1: Summary */}
        <div className="px-5 py-4 border-b border-[var(--divider)]">
          <div className="flex items-start gap-3">
            <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severity.dot}`} />
            <div>
              <h3 className="text-[14px] font-medium text-[var(--text)]">
                {issue.label || issue.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h3>
              <p className="text-[13px] text-[var(--text2)] mt-1 leading-relaxed">
                {issue.summary || 'Non-converting search terms are consuming budget without generating results.'}
              </p>
              <p className="text-[12px] text-[var(--text3)] mt-2">
                Based on last 30 days
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Proposed Change (Diff) */}
        <div className="px-5 py-4 border-b border-[var(--divider)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">
              Proposed Change
            </h4>
            <button
              onClick={() => setShowDiffView(!showDiffView)}
              className="text-[11px] text-[var(--accent)] hover:underline"
            >
              {showDiffView ? 'Hide details' : 'Show diff view'}
            </button>
          </div>

          {/* Compact summary or full DiffView */}
          {showDiffView ? (
            <DiffView items={diffItems} />
          ) : (
            <div className="bg-[var(--surface2)] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--text2)]">Negative keywords</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[var(--text3)] line-through">0</span>
                  <svg className="w-4 h-4 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="text-[14px] font-semibold text-[var(--text)] tabular-nums">{includedCount}</span>
                </div>
              </div>
              {/* Scope selector */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--divider)]">
                <span className="text-[12px] text-[var(--text3)]">Apply at:</span>
                <div className="flex gap-1">
                  <button className="px-2 py-1 text-[12px] font-medium bg-[var(--accent)] text-white rounded-md">
                    Campaign
                  </button>
                  <button className="px-2 py-1 text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--surface3)] rounded-md transition-colors">
                    Ad group
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Impact */}
        <div className="px-5 py-4 border-b border-[var(--divider)]">
          <h4 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-3">
            Expected Impact
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--surface2)] rounded-xl p-3">
              <div className="text-[11px] text-[var(--text3)] mb-1">Est. Savings</div>
              <div className="text-[15px] font-semibold text-[var(--text)] tabular-nums">
                ${estimatedSavingsLow}–${estimatedSavingsHigh}
              </div>
              <div className="text-[11px] text-[var(--text3)]">per month</div>
            </div>
            <div className="bg-[var(--surface2)] rounded-xl p-3">
              <div className="text-[11px] text-[var(--text3)] mb-1">Risk</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                <span className="text-[14px] font-medium text-[var(--text)]">Low</span>
              </div>
            </div>
            <div className="bg-[var(--surface2)] rounded-xl p-3">
              <div className="text-[11px] text-[var(--text3)] mb-1">Confidence</div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  confidence === 'high' ? 'bg-[var(--success)]' :
                  confidence === 'medium' ? 'bg-[var(--warning)]' : 'bg-[var(--text3)]'
                }`} />
                <span className="text-[14px] font-medium text-[var(--text)] capitalize">{confidence}</span>
              </div>
            </div>
          </div>
          <button className="text-[12px] text-[var(--accent)] hover:underline mt-2">
            How is this calculated?
          </button>
        </div>

        {/* Section 4: Evidence (Interactive) */}
        <div className="px-5 py-4 border-b border-[var(--divider)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">
              Evidence
            </h4>
            <span className="text-[11px] text-[var(--text3)]">
              {includedCount} of {evidenceItems.length} selected
            </span>
          </div>

          {/* Evidence table header */}
          <div className="grid grid-cols-[1fr,60px,70px,40px,80px] gap-2 px-3 py-2 text-[11px] font-medium text-[var(--text3)] uppercase tracking-wide">
            <span>Query</span>
            <span className="text-right">Clicks</span>
            <span className="text-right">Cost</span>
            <span className="text-right">Conv</span>
            <span className="text-right">Match</span>
          </div>

          {/* Evidence rows */}
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {evidenceItems.map((item) => (
              <div
                key={item.id}
                className={`grid grid-cols-[1fr,60px,70px,40px,80px] gap-2 items-center px-3 py-2 rounded-lg transition-colors ${
                  item.included
                    ? 'bg-[var(--surface2)]'
                    : 'bg-transparent opacity-50'
                }`}
              >
                {/* Query with toggle */}
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={() => toggleEvidence(item.id)}
                    className="w-4 h-4 rounded border-[var(--divider)] text-[var(--accent)] flex-shrink-0"
                  />
                  <span className="text-[13px] text-[var(--text)] truncate">
                    {item.query}
                  </span>
                </div>
                {/* Clicks */}
                <span className="text-[13px] text-[var(--text2)] tabular-nums text-right">
                  {item.clicks.toLocaleString()}
                </span>
                {/* Cost */}
                <span className="text-[13px] text-[var(--text2)] tabular-nums text-right">
                  ${item.cost.toFixed(0)}
                </span>
                {/* Conversions */}
                <span className={`text-[13px] tabular-nums text-right ${
                  item.conversions === 0 ? 'text-[var(--danger)]' : 'text-[var(--text)]'
                }`}>
                  {item.conversions}
                </span>
                {/* Match type selector */}
                <select
                  value={item.matchType}
                  onChange={(e) => updateMatchType(item.id, e.target.value as 'Exact' | 'Phrase' | 'Broad')}
                  disabled={!item.included}
                  className="text-[11px] bg-transparent border-none text-[var(--text2)] text-right cursor-pointer focus:outline-none disabled:opacity-50"
                >
                  <option value="Exact">Exact</option>
                  <option value="Phrase">Phrase</option>
                  <option value="Broad">Broad</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Rollback */}
        <div className="px-5 py-4">
          <h4 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-3">
            Rollback
          </h4>
          <div className="flex items-center justify-between bg-[var(--surface2)] rounded-xl p-4">
            <div>
              <p className="text-[13px] text-[var(--text)]">Auto-rollback available</p>
              <p className="text-[12px] text-[var(--text3)]">Revert changes within 24 hours if needed</p>
            </div>
            <button
              onClick={() => setEnableRollback(!enableRollback)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                enableRollback ? 'bg-[var(--accent)]' : 'bg-[var(--surface3)]'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                enableRollback ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== STICKY BOTTOM ACTION BAR ===== */}
      <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface)] sticky bottom-0">
        {/* Summary line */}
        <div className="text-[12px] text-[var(--text3)] mb-3 text-center">
          {includedCount} negatives • est. ${estimatedSavingsLow}–${estimatedSavingsHigh}/mo
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApplyFix}
            disabled={isApplying || includedCount === 0}
            className="flex-1 h-10 px-4 bg-[var(--accent)] text-white text-[14px] font-medium rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isApplying ? 'Adding...' : 'Review & Apply'}
          </button>
          <button
            onClick={() => handleApplyWithMode('direct')}
            disabled={isApplying || includedCount === 0}
            className="h-10 px-4 bg-[var(--surface2)] text-[var(--text)] text-[14px] font-medium rounded-xl hover:bg-[var(--surface3)] transition-colors disabled:opacity-50"
          >
            Quick Add
          </button>
        </div>
      </div>

      {/* Safe Apply Modal */}
      <SafeApplyModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        onConfirm={(mode) => handleApplyWithMode(mode)}
        campaign={campaign}
        issue={issue}
        fix={activeFix}
        changes={diffItems.map(d => ({
          field: d.field,
          currentValue: d.currentValue ?? '',
          newValue: d.newValue ?? '',
          type: d.type as 'add' | 'remove' | 'modify',
        }))}
      />
    </div>
  );
}
