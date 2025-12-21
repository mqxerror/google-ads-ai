'use client';

import { useState, useMemo, useEffect } from 'react';
import { Campaign } from '@/types/campaign';
import { CampaignIssue, RecommendedFix } from '@/types/health';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import { useAIDock, DockTrigger } from '@/contexts/AIDockContext';
import { QueuedAction } from '@/types/action-queue';

type AddActionInput = Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'riskLevel'> & { aiScore?: number };

interface AIDockProps {
  // Legacy props for backward compatibility
  isOpen?: boolean;
  onClose?: () => void;
  campaign?: Campaign | null;
  issue?: CampaignIssue | null;
  selectedCampaigns?: Campaign[];
  initialTab?: TabId;
}

type TabId = 'explain' | 'fix' | 'plan';

// Helper to determine initial tab based on trigger
function getInitialTabFromTrigger(trigger: DockTrigger): TabId {
  switch (trigger) {
    case 'issue_click':
    case 'wasted_spend':
      return 'fix';
    case 'opportunity':
      return 'plan';
    default:
      return 'explain';
  }
}

export default function AIDock({
  isOpen: legacyIsOpen,
  onClose: legacyOnClose,
  campaign: legacyCampaign,
  issue: legacyIssue,
  selectedCampaigns,
  initialTab
}: AIDockProps) {
  const {
    isOpen: contextIsOpen,
    context,
    closeDock,
    setMode
  } = useAIDock();
  const { addAction } = useActionQueue();

  // Use context if available, fall back to legacy props
  const isOpen = legacyIsOpen ?? contextIsOpen;
  const campaign = legacyCampaign ?? context?.campaign ?? null;
  const issue = legacyIssue ?? context?.issue ?? null;
  const onClose = legacyOnClose ?? closeDock;
  const trigger = context?.trigger ?? 'manual';

  // Determine default tab based on trigger or initialTab
  const defaultTab = useMemo(() => {
    if (initialTab) return initialTab;
    if (context?.trigger) return getInitialTabFromTrigger(context.trigger);
    return issue ? 'fix' : 'explain';
  }, [initialTab, issue, context?.trigger]);

  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  // Reset tab when context changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, context]);

  // Handle close - set mode to mini instead of hidden to show mini dock
  const handleClose = () => {
    setMode('mini');
    onClose();
  };

  if (!isOpen) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'explain', label: 'Explain' },
    { id: 'fix', label: 'Fix' },
    { id: 'plan', label: 'Plan' },
  ];

  const isBatchMode = selectedCampaigns && selectedCampaigns.length > 1;
  const targetCampaigns = isBatchMode ? selectedCampaigns : campaign ? [campaign] : [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/10" onClick={handleClose} />

      {/* Dock Panel - Apple style */}
      <div className="fixed right-0 top-0 z-50 h-full w-[420px] apple-dock flex flex-col animate-slideIn">
        {/* Header */}
        <div className="ai-dock-header px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text)]">AI Assistant</h2>
                <p className="text-[12px] text-[var(--text3)]">
                  {isBatchMode
                    ? `${selectedCampaigns.length} campaigns selected`
                    : campaign?.name || 'Select a campaign'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="btn-icon"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Bar - Apple segmented control style */}
        <div className="flex border-b border-[var(--divider)] px-5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-[13px] font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'explain' && (
            <ExplainTab campaign={campaign} />
          )}
          {activeTab === 'fix' && (
            <FixTab
              campaign={campaign}
              issue={issue}
              selectedCampaigns={selectedCampaigns}
              addAction={addAction}
            />
          )}
          {activeTab === 'plan' && (
            <PlanTab campaigns={targetCampaigns} />
          )}
        </div>
      </div>
    </>
  );
}

// Explain Tab - Apple style
function ExplainTab({ campaign }: { campaign: Campaign | null }) {
  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="w-12 h-12 rounded-full bg-[var(--surface2)] flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-[14px] text-[var(--text2)]">Select a campaign to see AI analysis</p>
      </div>
    );
  }

  const health = campaign.health;
  const issues = health?.issues || [];
  const healthScore = health?.score || campaign.aiScore;

  // Determine health status
  const getHealthStatus = (score: number) => {
    if (score >= 75) return { label: 'Healthy', dotClass: 'bg-[var(--success)]' };
    if (score >= 50) return { label: 'Attention', dotClass: 'bg-[var(--warning)]' };
    return { label: 'Critical', dotClass: 'bg-[var(--danger)]' };
  };

  const { label: healthLabel, dotClass } = getHealthStatus(healthScore);

  return (
    <div className="p-5 space-y-5">
      {/* Health Overview - Apple card style */}
      <div className="apple-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[var(--text2)]">Health Score</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dotClass}`} />
            <span className="text-[13px] text-[var(--text2)]">{healthLabel}</span>
            <span className="text-[20px] font-semibold text-[var(--text)] tabular-nums">{healthScore}</span>
          </div>
        </div>
      </div>

      {/* Issues List */}
      {issues.length > 0 && (
        <div>
          <h3 className="text-micro mb-3">DETECTED ISSUES</h3>
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div
                key={issue.id || index}
                className="apple-card p-4"
              >
                <div className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    issue.severity === 'critical' ? 'bg-[var(--danger)]' :
                    issue.severity === 'warning' ? 'bg-[var(--warning)]' :
                    'bg-[var(--accent)]'
                  }`} />
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-[var(--text)]">{issue.label || issue.category}</p>
                    <p className="text-[13px] text-[var(--text2)] mt-1">{issue.summary}</p>
                    {issue.fixes?.[0]?.expectedImpact && (
                      <p className="text-[12px] font-medium text-[var(--success)] mt-2">
                        Potential: {issue.fixes[0].expectedImpact}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Issues */}
      {issues.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto bg-[var(--surface2)] rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[14px] text-[var(--text)]">No issues detected</p>
          <p className="text-[13px] text-[var(--text3)] mt-1">Campaign is performing well</p>
        </div>
      )}
    </div>
  );
}

// Fix Tab - Apple style with 4-block layout
function FixTab({
  campaign,
  issue,
  selectedCampaigns,
  addAction,
}: {
  campaign: Campaign | null;
  issue?: CampaignIssue | null;
  selectedCampaigns?: Campaign[];
  addAction: (action: AddActionInput) => void;
}) {
  const [selectedFix, setSelectedFix] = useState<RecommendedFix | null>(null);

  const isBatchMode = selectedCampaigns && selectedCampaigns.length > 1;
  const targetIssue = issue || campaign?.health?.topIssue || campaign?.health?.issues?.[0];
  const fixes = targetIssue?.fixes || [];

  const handleApplyFix = (fix: RecommendedFix) => {
    if (isBatchMode && selectedCampaigns) {
      selectedCampaigns.forEach(c => {
        addAction({
          actionType: fix.actionType || 'adjust_budget',
          entityType: 'campaign',
          entityId: c.id,
          entityName: c.name,
          currentValue: 'current',
          newValue: fix.action,
          reason: fix.description,
        });
      });
    } else if (campaign) {
      addAction({
        actionType: fix.actionType || 'adjust_budget',
        entityType: 'campaign',
        entityId: campaign.id,
        entityName: campaign.name,
        currentValue: 'current',
        newValue: fix.action,
        reason: fix.description,
      });
    }
    setSelectedFix(fix);
  };

  if (!campaign && !isBatchMode) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="w-12 h-12 rounded-full bg-[var(--surface2)] flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-[14px] text-[var(--text2)]">Select a campaign to see fixes</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* A) Issue Header */}
      {targetIssue && (
        <div className="flex items-start gap-3">
          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
            targetIssue.severity === 'critical' ? 'bg-[var(--danger)]' :
            targetIssue.severity === 'warning' ? 'bg-[var(--warning)]' :
            'bg-[var(--accent)]'
          }`} />
          <div>
            <p className="text-[14px] font-medium text-[var(--text)]">{targetIssue.label || targetIssue.category}</p>
            <p className="text-[13px] text-[var(--text2)] mt-1">{targetIssue.summary}</p>
          </div>
        </div>
      )}

      {/* B) Available Fixes */}
      {fixes.length > 0 ? (
        <div>
          <h3 className="text-micro mb-3">RECOMMENDED FIXES</h3>
          <div className="space-y-2">
            {fixes.map((fix, index) => (
              <button
                key={index}
                onClick={() => handleApplyFix(fix)}
                className={`w-full text-left p-4 apple-card transition-all ${
                  selectedFix === fix
                    ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-light)]'
                    : 'hover:bg-[var(--surface2)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selectedFix === fix ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface2)] text-[var(--accent)]'
                  }`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-[var(--text)]">{fix.action}</p>
                    <p className="text-[13px] text-[var(--text2)] mt-1">{fix.description}</p>
                    {fix.expectedImpact && (
                      <p className="text-[12px] font-medium text-[var(--success)] mt-2">{fix.expectedImpact}</p>
                    )}
                  </div>
                  {selectedFix === fix && (
                    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-[14px] text-[var(--text2)]">No fixes available for this issue</p>
        </div>
      )}

      {/* Applied Confirmation */}
      {selectedFix && (
        <div className="apple-card p-4 bg-[var(--accent-light)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--success)] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-medium text-[var(--text)]">Added to Action Queue</p>
              <p className="text-[12px] text-[var(--text2)]">Review in Ops to apply changes</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Plan Tab - Apple style
function PlanTab({ campaigns }: { campaigns: Campaign[] }) {
  const actionPlan = campaigns.flatMap(campaign => {
    const issues = campaign.health?.issues || [];
    return issues.map(issue => ({
      campaign: campaign.name,
      campaignId: campaign.id,
      priority: issue.severity === 'critical' ? 1 : issue.severity === 'warning' ? 2 : 3,
      issue: issue.label || issue.category,
      impact: issue.fixes?.[0]?.expectedImpact || 'Unknown impact',
      severity: issue.severity,
    }));
  }).sort((a, b) => a.priority - b.priority).slice(0, 10);

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="w-12 h-12 rounded-full bg-[var(--surface2)] flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <p className="text-[14px] text-[var(--text2)]">Select campaigns to generate an action plan</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="apple-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-medium text-[var(--text)]">Prioritized Action Plan</p>
            <p className="text-[12px] text-[var(--text2)]">{actionPlan.length} actions across {campaigns.length} campaigns</p>
          </div>
        </div>
      </div>

      {/* Action Items - Settings-like list */}
      {actionPlan.length > 0 ? (
        <div className="apple-card overflow-hidden">
          {actionPlan.map((item, index) => (
            <div
              key={`${item.campaignId}-${index}`}
              className="evidence-row"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                  item.priority === 1 ? 'bg-[var(--danger)] text-white' :
                  item.priority === 2 ? 'bg-[var(--warning)] text-white' :
                  'bg-[var(--surface2)] text-[var(--text2)]'
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text)] truncate">{item.campaign}</p>
                  <p className="text-[12px] text-[var(--text2)] truncate">{item.issue}</p>
                </div>
              </div>
              <span className="text-[12px] font-medium text-[var(--success)] tabular-nums">{item.impact}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto bg-[var(--surface2)] rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[14px] text-[var(--text)]">All caught up!</p>
          <p className="text-[13px] text-[var(--text3)] mt-1">No pending actions</p>
        </div>
      )}
    </div>
  );
}
