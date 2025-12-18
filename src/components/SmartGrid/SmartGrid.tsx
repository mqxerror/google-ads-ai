'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Campaign, SortConfig, FilterConfig } from '@/types/campaign';
import { useAccount } from '@/contexts/AccountContext';
import { useDrillDown } from '@/contexts/DrillDownContext';
import { useDetailPanel } from '@/contexts/DetailPanelContext';
import { useActionQueue } from '@/contexts/ActionQueueContext';
import { useGuardrails } from '@/contexts/GuardrailsContext';
import { DetailPanel } from '@/components/DetailPanel';
import GuardrailWarningDialog from '@/components/GuardrailWarningDialog';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import GridHeader from './GridHeader';
import GridRow from './GridRow';
import GridSkeleton from './GridSkeleton';
import EmptyState from './EmptyState';
import FilterDrawer from './FilterDrawer';
import ActiveFilterChips from './ActiveFilterChips';
import ViewsDropdown from './ViewsDropdown';
import Breadcrumbs from './Breadcrumbs';
import { AIDock } from '@/components/AIDock';
import { FixPanel } from '@/components/FixPanel';
import AdGroupsGrid from './AdGroupsGrid';
import AdGroupContentTabs from './AdGroupContentTabs';
import BulkActionsBar from './BulkActionsBar';
import MobileCardView from './MobileCardView';
import VirtualizedGrid, { useVirtualization } from './VirtualizedGrid';
import { Recommendation } from '@/lib/recommendations';
import { checkActionGuardrails, checkBulkActionsGuardrails, GuardrailResult, ActionWithAIScore } from '@/lib/guardrails';
import { CampaignIssue } from '@/types/health';
import DateRangePicker, { DateRange, getDefaultDateRange } from '@/components/DateRangePicker';
import { CampaignEditor } from '@/components/CampaignEditor';
import { BudgetManager } from '@/components/BudgetManager';

// Type for pending action before guardrail check - reuse the exported type from guardrails
type PendingActionData = ActionWithAIScore;

// Grid settings persistence
const GRID_SETTINGS_KEY = 'smartgrid-settings';

interface GridSettings {
  sortConfig: SortConfig;
  filters: FilterConfig;
  activeView: string;
  dateRange: DateRange;
  searchQuery: string;
  showFilters: boolean;
}

function saveGridSettings(accountId: string, settings: GridSettings): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${GRID_SETTINGS_KEY}-${accountId}`;
    sessionStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

function loadGridSettings(accountId: string): GridSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `${GRID_SETTINGS_KEY}-${accountId}`;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export default function SmartGrid() {
  const { currentAccount, isSyncing } = useAccount();
  const { currentLevel, drillIntoCampaign, resetToRoot } = useDrillDown();
  const { isOpen, entity, entityType, openPanel, closePanel } = useDetailPanel();
  const { addAction, actions: queuedActions } = useActionQueue();
  const { settings: guardrailSettings } = useGuardrails();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'spend', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterConfig>({});
  const [showFilters, setShowFilters] = useState(false);
  const [activeView, setActiveView] = useState('all');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [isCampaignEditorOpen, setIsCampaignEditorOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isBudgetManagerOpen, setIsBudgetManagerOpen] = useState(false);
  const [budgetCampaign, setBudgetCampaign] = useState<Campaign | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAIDockOpen, setIsAIDockOpen] = useState(false);
  const [dockCampaign, setDockCampaign] = useState<Campaign | null>(null);
  const [dockIssue, setDockIssue] = useState<CampaignIssue | null>(null);

  // Fix Panel state - docked panel for reviewing fixes
  const [isFixPanelOpen, setIsFixPanelOpen] = useState(false);
  const [fixPanelCampaign, setFixPanelCampaign] = useState<Campaign | null>(null);
  const [fixPanelIssue, setFixPanelIssue] = useState<CampaignIssue | null>(null);

  // Track which account settings have been restored for
  const restoredForAccountRef = useRef<string | null>(null);

  // Restore settings from storage when account changes
  useEffect(() => {
    if (!currentAccount?.id) return;
    if (restoredForAccountRef.current === currentAccount.id) return;

    const saved = loadGridSettings(currentAccount.id);
    if (saved) {
      setSortConfig(saved.sortConfig);
      setFilters(saved.filters);
      setActiveView(saved.activeView);
      setDateRange(saved.dateRange);
      setSearchQuery(saved.searchQuery);
      setShowFilters(saved.showFilters);
    }
    restoredForAccountRef.current = currentAccount.id;
  }, [currentAccount?.id]);

  // Save settings whenever they change
  useEffect(() => {
    if (!currentAccount?.id || restoredForAccountRef.current !== currentAccount.id) return;

    saveGridSettings(currentAccount.id, {
      sortConfig,
      filters,
      activeView,
      dateRange,
      searchQuery,
      showFilters,
    });
  }, [currentAccount?.id, sortConfig, filters, activeView, dateRange, searchQuery, showFilters]);

  // Guardrail state
  const [guardrailDialogOpen, setGuardrailDialogOpen] = useState(false);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailResult | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActionData[]>([]);
  const [actionDescription, setActionDescription] = useState('');

  // Guardrail check helper - checks action(s) and either adds to queue or shows warning dialog
  const checkAndAddActions = useCallback((
    actions: PendingActionData[],
    description: string
  ) => {
    const context = {
      campaigns,
      pendingActions: queuedActions,
      settings: guardrailSettings,
    };

    // Check guardrails
    const result = actions.length === 1
      ? checkActionGuardrails(actions[0], context)
      : checkBulkActionsGuardrails(actions, context);

    // Add account ID to each action
    const actionsWithAccount = actions.map(action => ({
      ...action,
      accountId: currentAccount?.id,
    }));

    // If guardrails are disabled or action is allowed with no warnings, add directly
    if (!guardrailSettings.enabled || (result.allowed && result.warnings.length === 0)) {
      actionsWithAccount.forEach(action => addAction(action));
      return;
    }

    // If action is blocked or has warnings, show dialog
    if (!result.allowed || result.warnings.length > 0) {
      setGuardrailResult(result);
      setPendingActions(actionsWithAccount);
      setActionDescription(description);
      setGuardrailDialogOpen(true);
      return;
    }

    // Otherwise, add actions directly
    actionsWithAccount.forEach(action => addAction(action));
  }, [campaigns, queuedActions, guardrailSettings, addAction, currentAccount?.id]);

  // Handle guardrail dialog confirmation
  const handleGuardrailConfirm = useCallback(() => {
    pendingActions.forEach(action => addAction(action));
    setGuardrailDialogOpen(false);
    setPendingActions([]);
    setGuardrailResult(null);
    setActionDescription('');
  }, [pendingActions, addAction]);

  // Handle guardrail dialog cancel
  const handleGuardrailCancel = useCallback(() => {
    setGuardrailDialogOpen(false);
    setPendingActions([]);
    setGuardrailResult(null);
    setActionDescription('');
  }, []);

  // Reset drill-down when account changes
  useEffect(() => {
    resetToRoot();
  }, [currentAccount?.id, resetToRoot]);

  // Fetch campaigns when account or date range changes
  useEffect(() => {
    if (!currentAccount?.id) {
      setCampaigns([]);
      setIsLoading(false);
      return;
    }

    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams({
          accountId: currentAccount.id,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
        const response = await fetch(`/api/google-ads/campaigns?${params}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch campaigns');
        }

        const data = await response.json();
        setCampaigns(data.campaigns || []);
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
        setCampaigns([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [currentAccount?.id, dateRange.startDate, dateRange.endDate]);

  // Apply filters and search
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      // Search filter - match against name (case-insensitive)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        if (!campaign.name.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (filters.status?.length && !filters.status.includes(campaign.status)) {
        return false;
      }
      if (filters.type?.length && !filters.type.includes(campaign.type)) {
        return false;
      }
      if (filters.spendMin !== undefined && campaign.spend < filters.spendMin) {
        return false;
      }
      if (filters.spendMax !== undefined && campaign.spend > filters.spendMax) {
        return false;
      }
      if (filters.aiScoreMin !== undefined && campaign.aiScore < filters.aiScoreMin) {
        return false;
      }
      if (filters.aiScoreMax !== undefined && campaign.aiScore > filters.aiScoreMax) {
        return false;
      }
      if (filters.conversionsMax !== undefined && campaign.conversions > filters.conversionsMax) {
        return false;
      }
      // Additional filters
      if (filters.conversionsMin !== undefined && campaign.conversions < filters.conversionsMin) {
        return false;
      }
      if (filters.clicksMin !== undefined && campaign.clicks < filters.clicksMin) {
        return false;
      }
      if (filters.clicksMax !== undefined && campaign.clicks > filters.clicksMax) {
        return false;
      }
      if (filters.ctrMin !== undefined && campaign.ctr < filters.ctrMin) {
        return false;
      }
      if (filters.ctrMax !== undefined && campaign.ctr > filters.ctrMax) {
        return false;
      }
      if (filters.cpaMin !== undefined && campaign.cpa < filters.cpaMin) {
        return false;
      }
      if (filters.cpaMax !== undefined && campaign.cpa > filters.cpaMax) {
        return false;
      }
      return true;
    });
  }, [campaigns, filters, searchQuery]);

  // Apply sorting
  const sortedCampaigns = useMemo(() => {
    const sorted = [...filteredCampaigns].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
    return sorted;
  }, [filteredCampaigns, sortConfig]);

  // Determine if virtualization should be enabled (for 50+ campaigns)
  const shouldVirtualize = useVirtualization(sortedCampaigns.length);

  const handleSort = (column: keyof Campaign) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedCampaigns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCampaigns.map((c) => c.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleViewChange = (viewId: string, viewFilters?: FilterConfig, viewSorting?: SortConfig) => {
    setActiveView(viewId);
    // If filters and sorting are provided (from saved view), use them
    if (viewFilters !== undefined) {
      setFilters(viewFilters);
    }
    if (viewSorting !== undefined) {
      setSortConfig(viewSorting);
    }
  };

  const handleCampaignClick = (campaign: Campaign) => {
    drillIntoCampaign(campaign);
  };

  const handleCampaignDetailClick = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    openPanel(campaign, 'campaign');
  };

  // Bulk action handlers - now stage to action queue with guardrail checks
  const handleBulkPause = async () => {
    if (selectedIds.size === 0) return;

    const selectedCampaigns = campaigns.filter(c => selectedIds.has(c.id) && c.status === 'ENABLED');
    if (selectedCampaigns.length === 0) return;

    const actions: PendingActionData[] = selectedCampaigns.map(campaign => ({
      actionType: 'pause_campaign' as const,
      entityType: 'campaign' as const,
      entityId: campaign.id,
      entityName: campaign.name,
      currentValue: 'ENABLED',
      newValue: 'PAUSED',
      aiScore: campaign.aiScore,
    }));

    checkAndAddActions(
      actions,
      `Pause ${selectedCampaigns.length} campaign${selectedCampaigns.length > 1 ? 's' : ''}`
    );
    setSelectedIds(new Set());
  };

  const handleBulkEnable = async () => {
    if (selectedIds.size === 0) return;

    const selectedCampaigns = campaigns.filter(c => selectedIds.has(c.id) && c.status === 'PAUSED');
    if (selectedCampaigns.length === 0) return;

    const actions: PendingActionData[] = selectedCampaigns.map(campaign => ({
      actionType: 'enable_campaign' as const,
      entityType: 'campaign' as const,
      entityId: campaign.id,
      entityName: campaign.name,
      currentValue: 'PAUSED',
      newValue: 'ENABLED',
      aiScore: campaign.aiScore,
    }));

    checkAndAddActions(
      actions,
      `Enable ${selectedCampaigns.length} campaign${selectedCampaigns.length > 1 ? 's' : ''}`
    );
    setSelectedIds(new Set());
  };

  const handleBulkRemove = async () => {
    // Remove is destructive - we don't support it through the queue
    // Keep the confirmation dialog as a guardrail
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Are you sure you want to remove ${selectedIds.size} campaign(s)? This action cannot be undone.`);
    if (!confirmed) return;

    setIsBulkProcessing(true);
    try {
      // Update local state optimistically
      setCampaigns(prev => prev.map(c =>
        selectedIds.has(c.id) ? { ...c, status: 'REMOVED' as const } : c
      ));
      setSelectedIds(new Set());
      // TODO: Call API to actually remove campaigns
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Inline edit handler - stage status changes to queue with guardrail check
  const handleUpdateCampaign = (id: string, updates: Partial<Campaign>) => {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    // If status is being changed, add to action queue with guardrail check
    if (updates.status && updates.status !== campaign.status) {
      const actionType = updates.status === 'PAUSED' ? 'pause_campaign' : 'enable_campaign';
      const action: PendingActionData = {
        actionType,
        entityType: 'campaign',
        entityId: campaign.id,
        entityName: campaign.name,
        currentValue: campaign.status,
        newValue: updates.status,
        aiScore: campaign.aiScore,
      };

      checkAndAddActions(
        [action],
        `${updates.status === 'PAUSED' ? 'Pause' : 'Enable'} "${campaign.name}"`
      );
      return; // Don't update local state until action is executed
    }

    // For non-status updates (like name), update local state immediately
    setCampaigns(prev => prev.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  // Recommendation action handler - stage to action queue with guardrail check
  const handleRecommendationAction = (recommendation: Recommendation, campaign: Campaign) => {
    // Handle different action types
    switch (recommendation.actionType) {
      case 'pause': {
        const action: PendingActionData = {
          actionType: 'pause_campaign',
          entityType: 'campaign',
          entityId: campaign.id,
          entityName: campaign.name,
          currentValue: campaign.status,
          newValue: 'PAUSED',
          aiScore: campaign.aiScore,
          reason: recommendation.issue,
        };
        checkAndAddActions([action], `Pause "${campaign.name}"`);
        break;
      }
      case 'enable': {
        const action: PendingActionData = {
          actionType: 'enable_campaign',
          entityType: 'campaign',
          entityId: campaign.id,
          entityName: campaign.name,
          currentValue: campaign.status,
          newValue: 'ENABLED',
          aiScore: campaign.aiScore,
          reason: recommendation.issue,
        };
        checkAndAddActions([action], `Enable "${campaign.name}"`);
        break;
      }
      case 'adjust_bid':
        // Open budget manager for bid adjustments
        setBudgetCampaign(campaign);
        setIsBudgetManagerOpen(true);
        break;
      case 'review':
      case 'improve_quality':
      case 'add_keywords':
        // Open the detail panel for more complex actions
        openPanel(campaign, 'campaign');
        break;
    }
  };

  const activeFiltersCount = Object.values(filters).filter((v) =>
    v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  // Helper to remove individual filters
  const handleRemoveFilter = (key: keyof FilterConfig, value?: string) => {
    const newFilters = { ...filters };
    if (key === 'status' && value && Array.isArray(newFilters.status)) {
      newFilters.status = newFilters.status.filter(s => s !== value);
      if (newFilters.status.length === 0) delete newFilters.status;
    } else if (key === 'type' && value && Array.isArray(newFilters.type)) {
      newFilters.type = newFilters.type.filter(t => t !== value);
      if (newFilters.type.length === 0) delete newFilters.type;
    } else if (key === 'spendMin' || key === 'spendMax') {
      delete newFilters.spendMin;
      delete newFilters.spendMax;
    } else if (key === 'aiScoreMin' || key === 'aiScoreMax') {
      delete newFilters.aiScoreMin;
      delete newFilters.aiScoreMax;
    } else if (key === 'conversionsMin' || key === 'conversionsMax') {
      delete newFilters.conversionsMin;
      delete newFilters.conversionsMax;
    }
    setFilters(newFilters);
  };

  // Calculate view counts
  const viewCounts = useMemo(() => {
    const enabledCampaigns = campaigns.filter(c => c.status === 'ENABLED');
    return {
      all: campaigns.length,
      needs_attention: enabledCampaigns.filter(c => (c.aiScore || c.health?.score || 100) < 50).length,
      wasted_spend: enabledCampaigns.filter(c => c.spend > 100 && c.conversions === 0).length,
      scaling: enabledCampaigns.filter(c => (c.aiScore || c.health?.score || 0) >= 75).length,
      top_performers: enabledCampaigns.filter(c => c.conversions >= 10).length,
      tracking: enabledCampaigns.filter(c => c.health?.issues?.some(i => i.category === 'tracking')).length,
    };
  }, [campaigns]);

  const summaryStats = useMemo(() => {
    const filtered = sortedCampaigns;
    return {
      totalSpend: filtered.reduce((sum, c) => sum + c.spend, 0),
      totalConversions: filtered.reduce((sum, c) => sum + c.conversions, 0),
    };
  }, [sortedCampaigns]);

  // Calculate wasted spend (campaigns with spend > $100 and no conversions)
  const wastedSpendStats = useMemo(() => {
    const wastedCampaigns = campaigns.filter(c => c.spend > 100 && c.conversions === 0 && c.status === 'ENABLED');
    return {
      totalWasted: wastedCampaigns.reduce((sum, c) => sum + c.spend, 0),
      count: wastedCampaigns.length,
      campaignIds: wastedCampaigns.map(c => c.id),
    };
  }, [campaigns]);

  // Handler for bulk pausing all wasted spend campaigns - stage to queue with guardrails
  const handlePauseAllWasted = () => {
    if (wastedSpendStats.count === 0) return;

    const wastedCampaigns = campaigns.filter(c =>
      c.spend > 100 && c.conversions === 0 && c.status === 'ENABLED'
    );

    const actions: PendingActionData[] = wastedCampaigns.map(campaign => ({
      actionType: 'pause_campaign' as const,
      entityType: 'campaign' as const,
      entityId: campaign.id,
      entityName: campaign.name,
      currentValue: 'ENABLED',
      newValue: 'PAUSED',
      aiScore: campaign.aiScore,
      reason: 'Wasted spend: high spend with no conversions',
    }));

    checkAndAddActions(
      actions,
      `Pause all ${wastedCampaigns.length} wasted spend campaign${wastedCampaigns.length > 1 ? 's' : ''}`
    );
  };

  // Determine if this is initial load (no cached data)
  const isInitialLoad = (isLoading || isSyncing) && campaigns.length === 0;

  // Render different grids based on current level
  const renderGrid = () => {
    if (!currentAccount) {
      return (
        <div className="px-4 py-16 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Syncing Accounts...</h3>
            <p className="max-w-sm text-sm text-gray-500">
              We&apos;re fetching your Google Ads accounts. This may take a moment.
            </p>
          </div>
        </div>
      );
    }

    switch (currentLevel) {
      case 'adGroups':
        return <AdGroupsGrid />;
      case 'keywords':
        return <AdGroupContentTabs />;
      default:
        // Campaigns grid
        // Show skeleton only on initial load with no data
        if (isInitialLoad) {
          return <GridSkeleton />;
        }
        if (sortedCampaigns.length === 0) {
          return <EmptyState />;
        }
        return (
          <div className="relative">
            {/* Loading overlay for refetch - shows over existing data */}
            {(isLoading || isSyncing) && campaigns.length > 0 && (
              <LoadingOverlay message="Refreshing data..." opacity={70} />
            )}
            {/* Mobile Card View - visible on small screens */}
            <MobileCardView
              campaigns={sortedCampaigns}
              selectedIds={selectedIds}
              onSelect={handleSelectRow}
              onClick={handleCampaignClick}
              onViewDetails={(campaign) => openPanel(campaign, 'campaign')}
              onManageBudget={(campaign) => {
                setBudgetCampaign(campaign);
                setIsBudgetManagerOpen(true);
              }}
              onRecommendationAction={handleRecommendationAction}
            />
            {/* Desktop Table View - hidden on small screens */}
            <div className="hidden lg:block overflow-x-auto">
              {shouldVirtualize ? (
                <VirtualizedGrid
                  campaigns={sortedCampaigns}
                  selectedIds={selectedIds}
                  sortConfig={sortConfig}
                  onSelect={handleSelectRow}
                  onSelectAll={handleSelectAll}
                  onSort={handleSort}
                  onClick={handleCampaignClick}
                  onViewDetails={handleCampaignDetailClick}
                  onManageBudget={(campaign, e) => {
                    e.stopPropagation();
                    setBudgetCampaign(campaign);
                    setIsBudgetManagerOpen(true);
                  }}
                  onUpdateCampaign={handleUpdateCampaign}
                  onIssueClick={(campaign, issue) => {
                    // Open the docked FixPanel instead of overlay
                    setFixPanelCampaign(campaign);
                    setFixPanelIssue(issue);
                    setIsFixPanelOpen(true);
                  }}
                />
              ) : (
                <table className="w-full min-w-[900px]">
                  <GridHeader
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    allSelected={selectedIds.size === sortedCampaigns.length && sortedCampaigns.length > 0}
                    onSelectAll={handleSelectAll}
                  />
                  <tbody>
                    {sortedCampaigns.map((campaign) => (
                      <GridRow
                        key={campaign.id}
                        campaign={campaign}
                        isSelected={selectedIds.has(campaign.id)}
                        onSelect={() => handleSelectRow(campaign.id)}
                        onClick={() => handleCampaignClick(campaign)}
                        onViewDetails={(e) => handleCampaignDetailClick(campaign, e)}
                        onManageBudget={(e) => {
                          e.stopPropagation();
                          setBudgetCampaign(campaign);
                          setIsBudgetManagerOpen(true);
                        }}
                        onUpdateCampaign={handleUpdateCampaign}
                        onIssueClick={(campaign, issue) => {
                          // Open the docked FixPanel instead of overlay
                          setFixPanelCampaign(campaign);
                          setFixPanelIssue(issue);
                          setIsFixPanelOpen(true);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-full">
      {/* Main content area - table */}
      <div className={`apple-card shadow-md flex-1 min-w-0 transition-all duration-300 ${isFixPanelOpen ? 'mr-0' : ''}`}>
      {/* Apple-style Control Bar - 44px height */}
      <div className="h-11 flex items-center gap-4 px-4 border-b border-[var(--divider)]">
        {/* Left: Title */}
        <h1 className="text-[15px] font-semibold text-[var(--text)]">
          {currentLevel === 'campaigns' && 'Campaigns'}
          {currentLevel === 'adGroups' && 'Ad Groups'}
          {currentLevel === 'keywords' && 'Keywords'}
        </h1>

        {/* Center: Search - filled style, no border */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={`Search ${currentLevel}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 rounded-lg bg-[var(--surface2)] border-none py-0 pl-9 pr-8 text-[13px] text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text3)] hover:text-[var(--text2)]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          {currentLevel === 'campaigns' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-tertiary ${activeFiltersCount > 0 ? 'text-[var(--accent)]' : ''}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {activeFiltersCount > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white flex items-center justify-center">{activeFiltersCount}</span>
              )}
            </button>
          )}
          {currentLevel === 'campaigns' && currentAccount && (
            <button
              onClick={() => {
                setEditingCampaign(null);
                setIsCampaignEditorOpen(true);
              }}
              className="btn-secondary h-8 px-3 text-[13px]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          )}
          {currentLevel === 'campaigns' && campaigns.length > 0 && (
            <button
              onClick={() => {
                setDockCampaign(null);
                setIsAIDockOpen(true);
              }}
              className="btn-primary h-8 px-3 text-[13px]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Breadcrumbs - show when drilled down */}
      <Breadcrumbs />

      {/* Filter Drawer - slides in from right */}
      <FilterDrawer
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Views Dropdown - only for campaigns */}
      {currentLevel === 'campaigns' && (
        <ViewsDropdown
          activeView={activeView}
          onViewChange={handleViewChange}
          counts={viewCounts}
        />
      )}

      {/* Active Filter Chips - shown when filters applied */}
      {currentLevel === 'campaigns' && activeFiltersCount > 0 && (
        <ActiveFilterChips
          filters={filters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => setFilters({})}
        />
      )}

      {/* Wasted Spend Header - show when in wasted view */}
      {activeView === 'wasted' && currentLevel === 'campaigns' && wastedSpendStats.totalWasted > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-800">
                  ${wastedSpendStats.totalWasted.toLocaleString('en-US', { minimumFractionDigits: 2 })} Potential Wasted Spend
                </h3>
                <p className="text-sm text-red-600">
                  {wastedSpendStats.count} campaign{wastedSpendStats.count !== 1 ? 's' : ''} with spend {'>'} $100 and no conversions
                </p>
              </div>
            </div>
            <button
              onClick={handlePauseAllWasted}
              disabled={isBulkProcessing}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isBulkProcessing ? 'Pausing...' : 'Pause All Wasted'}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {renderGrid()}

      {/* Footer - Apple style */}
      {currentLevel === 'campaigns' && sortedCampaigns.length > 0 && (
        <div className="flex items-center justify-between border-t border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-[13px]">
          <div className="flex items-center gap-4 text-[var(--text2)]">
            <span className="font-medium">{sortedCampaigns.length} campaign{sortedCampaigns.length !== 1 ? 's' : ''}</span>
            {selectedIds.size > 0 && (
              <span className="font-semibold text-[var(--accent)]">
                ({selectedIds.size} selected)
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-[var(--text2)]">
            <span>Spend: <strong className="text-[var(--text)] tabular-nums">${summaryStats.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
            <span>Conv: <strong className="text-[var(--text)] tabular-nums">{summaryStats.totalConversions.toFixed(0)}</strong></span>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar - appears when items selected */}
      {currentLevel === 'campaigns' && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          entityType="campaigns"
          onPause={handleBulkPause}
          onEnable={handleBulkEnable}
          onRemove={handleBulkRemove}
          onClearSelection={handleClearSelection}
          isProcessing={isBulkProcessing}
          selectedItems={campaigns.filter(c => selectedIds.has(c.id))}
        />
      )}

      {/* Detail Panel */}
      <DetailPanel
        isOpen={isOpen}
        onClose={closePanel}
        entity={entity}
        entityType={entityType}
      />

      {/* Guardrail Warning Dialog */}
      {guardrailResult && (
        <GuardrailWarningDialog
          isOpen={guardrailDialogOpen}
          result={guardrailResult}
          onConfirm={handleGuardrailConfirm}
          onCancel={handleGuardrailCancel}
          actionDescription={actionDescription}
        />
      )}


      {/* Campaign Editor */}
      <CampaignEditor
        isOpen={isCampaignEditorOpen}
        onClose={() => {
          setIsCampaignEditorOpen(false);
          setEditingCampaign(null);
        }}
        campaign={editingCampaign}
      />

      {/* Budget Manager */}
      <BudgetManager
        isOpen={isBudgetManagerOpen}
        onClose={() => {
          setIsBudgetManagerOpen(false);
          setBudgetCampaign(null);
        }}
        campaign={budgetCampaign}
      />

      {/* AI Dock - unified AI interface */}
      <AIDock
        isOpen={isAIDockOpen}
        onClose={() => {
          setIsAIDockOpen(false);
          setDockCampaign(null);
          setDockIssue(null);
        }}
        campaign={dockCampaign}
        issue={dockIssue}
        selectedCampaigns={selectedIds.size > 1 ? campaigns.filter(c => selectedIds.has(c.id)) : undefined}
      />
      </div>

      {/* Docked Fix Panel - sits alongside table */}
      {isFixPanelOpen && fixPanelCampaign && fixPanelIssue && (
        <FixPanel
          isOpen={isFixPanelOpen}
          onClose={() => {
            setIsFixPanelOpen(false);
            setFixPanelCampaign(null);
            setFixPanelIssue(null);
          }}
          campaign={fixPanelCampaign}
          issue={fixPanelIssue}
        />
      )}
    </div>
  );
}
