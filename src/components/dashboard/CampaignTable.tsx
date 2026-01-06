'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Campaign } from '@/types/campaign';
import { useCampaignsStore } from '@/stores/campaigns-store';
import { useCampaignSelection } from '@/hooks/useCampaigns';
import { useShallow } from 'zustand/react/shallow';
import CampaignDrawer from './CampaignDrawer';
import ConfirmModal from '@/components/ConfirmModal';

const STORAGE_KEY_FILTERS = 'quickads_campaign_filters';

interface CampaignTableProps {
  onScoreClick?: (campaign: Campaign) => void;
}

export default function CampaignTable({ onScoreClick }: CampaignTableProps) {
  // Filters - start with defaults, load from localStorage after mount to avoid hydration mismatch
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ENABLED' | 'PAUSED'>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate filters from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FILTERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.searchQuery) setSearchQuery(parsed.searchQuery);
        if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
      }
    } catch (e) {
      console.error('Failed to load filters:', e);
    }
    setIsHydrated(true);
  }, []);

  // Persist filters to localStorage when they change (only after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify({ searchQuery, statusFilter }));
    } catch (e) {
      console.error('Failed to save filters:', e);
    }
  }, [searchQuery, statusFilter, isHydrated]);

  // Inline editing
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingBudgetValue, setEditingBudgetValue] = useState('');
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [savingBudgetId, setSavingBudgetId] = useState<string | null>(null);

  // Campaign drawer
  const [drawerCampaign, setDrawerCampaign] = useState<Campaign | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Bulk budget editing
  const [showBulkBudget, setShowBulkBudget] = useState(false);
  const [bulkBudgetValue, setBulkBudgetValue] = useState('');
  const [bulkBudgetMode, setBulkBudgetMode] = useState<'set' | 'increase' | 'decrease'>('set');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  // Selection for bulk actions
  const { selectedIds, selectedCount, toggleSelection, selectAll, clearSelection, isSelected } = useCampaignSelection();

  // Store
  const campaigns = useCampaignsStore(useShallow((state) => state.campaigns));
  const loading = useCampaignsStore((state) => state.loading);
  const toggleCampaignStatus = useCampaignsStore((state) => state.toggleCampaignStatus);
  const updateCampaignBudget = useCampaignsStore((state) => state.updateCampaignBudget);
  const pauseMultiple = useCampaignsStore((state) => state.pauseMultipleCampaigns);
  const enableMultiple = useCampaignsStore((state) => state.enableMultipleCampaigns);
  const drillIntoCampaign = useCampaignsStore((state) => state.drillIntoCampaign);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      return true;
    });
  }, [campaigns, searchQuery, statusFilter]);

  // Inline budget editing handlers
  const startEditingBudget = (campaign: Campaign) => {
    setEditingBudgetId(campaign.id);
    setEditingBudgetValue((campaign.dailyBudget ?? 0).toString());
  };

  const saveBudget = async (campaignId: string) => {
    const newBudget = parseFloat(editingBudgetValue);
    if (!isNaN(newBudget) && newBudget >= 0) {
      setBudgetError(null);
      setSavingBudgetId(campaignId);
      try {
        const success = await updateCampaignBudget(campaignId, newBudget);
        if (!success) {
          setBudgetError('Failed to update budget. Check console for details.');
          // Clear error after 5 seconds
          setTimeout(() => setBudgetError(null), 5000);
        }
      } catch (error) {
        console.error('Budget update error:', error);
        setBudgetError('Failed to update budget.');
        setTimeout(() => setBudgetError(null), 5000);
      } finally {
        setSavingBudgetId(null);
      }
    }
    setEditingBudgetId(null);
  };

  // Bulk actions - with confirmation for pause
  const handleBulkPause = useCallback(() => {
    const count = selectedIds.length;
    const selectedCampaigns = campaigns.filter(c => selectedIds.includes(c.id));
    const totalSpend = selectedCampaigns.reduce((sum, c) => sum + (c.dailyBudget ?? 0), 0);

    setConfirmModal({
      isOpen: true,
      title: `Pause ${count} Campaign${count > 1 ? 's' : ''}?`,
      message: `This will pause ${count} campaign${count > 1 ? 's' : ''} with a combined daily budget of $${totalSpend.toLocaleString()}. They will stop showing ads immediately.`,
      confirmText: 'Pause Campaigns',
      variant: 'warning',
      onConfirm: () => {
        pauseMultiple(selectedIds);
        clearSelection();
        closeConfirmModal();
      },
    });
  }, [pauseMultiple, selectedIds, clearSelection, campaigns]);

  const handleBulkEnable = useCallback(() => {
    enableMultiple(selectedIds);
    clearSelection();
  }, [enableMultiple, selectedIds, clearSelection]);

  // Single campaign pause with confirmation
  const handleSinglePause = useCallback((campaign: Campaign) => {
    if (campaign.status === 'ENABLED') {
      setConfirmModal({
        isOpen: true,
        title: 'Pause Campaign?',
        message: `This will pause "${campaign.name}" with a daily budget of $${(campaign.dailyBudget ?? 0).toLocaleString()}. It will stop showing ads immediately.`,
        confirmText: 'Pause Campaign',
        variant: 'warning',
        onConfirm: () => {
          toggleCampaignStatus(campaign.id);
          closeConfirmModal();
        },
      });
    } else {
      // Enable without confirmation
      toggleCampaignStatus(campaign.id);
    }
  }, [toggleCampaignStatus]);

  // Bulk budget update
  const handleBulkBudgetApply = async () => {
    const value = parseFloat(bulkBudgetValue);
    if (isNaN(value) || value < 0) return;

    const selectedCampaigns = filteredCampaigns.filter(c => selectedIds.includes(c.id));

    for (const campaign of selectedCampaigns) {
      let newBudget = value;
      if (bulkBudgetMode === 'increase') {
        newBudget = (campaign.dailyBudget ?? 0) + value;
      } else if (bulkBudgetMode === 'decrease') {
        newBudget = Math.max(0, (campaign.dailyBudget ?? 0) - value);
      }
      await updateCampaignBudget(campaign.id, newBudget);
    }

    setShowBulkBudget(false);
    setBulkBudgetValue('');
    clearSelection();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      // P = Pause selected or first enabled campaign
      if (key === 'p' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (selectedIds.length > 0) {
          handleBulkPause();
        } else {
          // Pause first enabled campaign
          const firstEnabled = filteredCampaigns.find(c => c.status === 'ENABLED');
          if (firstEnabled) {
            toggleCampaignStatus(firstEnabled.id);
          }
        }
      }

      // B = Edit budget of first selected campaign
      if (key === 'b' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const targetCampaign = selectedIds.length > 0
          ? filteredCampaigns.find(c => c.id === selectedIds[0])
          : filteredCampaigns[0];
        if (targetCampaign) {
          startEditingBudget(targetCampaign);
        }
      }

      // Escape = Clear selection or cancel editing
      if (key === 'escape') {
        if (editingBudgetId) {
          setEditingBudgetId(null);
        } else if (selectedIds.length > 0) {
          clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, filteredCampaigns, handleBulkPause, toggleCampaignStatus, editingBudgetId, clearSelection]);

  // Score badge color
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-success text-white';
    if (score >= 40) return 'bg-warning text-white';
    return 'bg-danger text-white';
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Campaign', 'Type', 'Status', 'Budget/Day', 'Spend', 'Clicks', 'Impressions', 'Conversions', 'CTR', 'CPA', 'ROAS', 'AI Score'];
    const rows = filteredCampaigns.map(c => [
      c.name,
      c.type,
      c.status,
      c.dailyBudget ?? 0,
      c.spend ?? 0,
      c.clicks ?? 0,
      c.impressions ?? 0,
      c.conversions ?? 0,
      (c.ctr ?? 0).toFixed(2),
      (c.cpa ?? 0).toFixed(2),
      (c.roas ?? 0).toFixed(2),
      c.aiScore ?? 0,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaigns-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-surface2 rounded w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-surface2 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Error banner */}
      {budgetError && (
        <div className="p-3 bg-danger/10 border-b border-danger/30 flex items-center gap-3">
          <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-danger">{budgetError}</span>
          <button onClick={() => setBudgetError(null)} className="ml-auto text-danger hover:text-danger/70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-divider flex items-center gap-4">
        <h2 className="font-semibold text-text">Campaigns</h2>
        <span className="text-sm text-text3">{filteredCampaigns.length} of {campaigns.length}</span>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-surface2 rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent w-48"
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${showFilters ? 'bg-accent text-white' : 'bg-surface2 text-text2 hover:bg-divider'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </button>

        {/* Export CSV */}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-2 bg-surface2 hover:bg-divider text-text2 rounded-lg text-sm transition-colors"
          title="Export to CSV"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="p-4 bg-surface2/50 border-b border-divider flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-1.5 bg-surface rounded-lg text-sm text-text border border-divider focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="ALL">All Status</option>
            <option value="ENABLED">Enabled</option>
            <option value="PAUSED">Paused</option>
          </select>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedCount > 0 && (
        <div className="p-3 bg-accent/10 border-b border-accent/20 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-text">{selectedCount} selected</span>
          <button onClick={handleBulkPause} className="px-3 py-1.5 bg-danger text-white text-sm rounded-lg hover:bg-danger/80">
            Pause All
          </button>
          <button onClick={handleBulkEnable} className="px-3 py-1.5 bg-success text-white text-sm rounded-lg hover:bg-success/80">
            Enable All
          </button>
          <button
            onClick={() => setShowBulkBudget(!showBulkBudget)}
            className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/80"
          >
            Edit Budget
          </button>
          <button onClick={clearSelection} className="px-3 py-1.5 text-text3 text-sm hover:text-text">
            Clear
          </button>

          {/* Bulk budget editor */}
          {showBulkBudget && (
            <div className="w-full mt-2 p-3 bg-surface rounded-lg border border-divider flex items-center gap-3 flex-wrap">
              <select
                value={bulkBudgetMode}
                onChange={(e) => setBulkBudgetMode(e.target.value as 'set' | 'increase' | 'decrease')}
                className="px-3 py-1.5 bg-surface2 rounded-lg text-sm text-text border-none focus:ring-2 focus:ring-accent"
              >
                <option value="set">Set to</option>
                <option value="increase">Increase by</option>
                <option value="decrease">Decrease by</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="text-text3">$</span>
                <input
                  type="number"
                  value={bulkBudgetValue}
                  onChange={(e) => setBulkBudgetValue(e.target.value)}
                  placeholder="0"
                  className="w-24 px-2 py-1.5 bg-surface2 rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                  onKeyDown={(e) => e.key === 'Enter' && handleBulkBudgetApply()}
                />
              </div>
              <button
                onClick={handleBulkBudgetApply}
                className="px-4 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/80"
              >
                Apply to {selectedCount} campaigns
              </button>
              <button
                onClick={() => setShowBulkBudget(false)}
                className="px-3 py-1.5 text-text3 text-sm hover:text-text"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="divide-y divide-divider">
        {/* Header row */}
        <div className="px-4 py-3 flex items-center gap-4 text-xs text-text3 uppercase tracking-wide bg-surface2/30">
          <input
            type="checkbox"
            checked={selectedCount === filteredCampaigns.length && filteredCampaigns.length > 0}
            onChange={(e) => e.target.checked ? selectAll(filteredCampaigns.map(c => c.id)) : clearSelection()}
            className="w-4 h-4 rounded border-divider"
          />
          <div className="flex-1">Campaign</div>
          <div className="w-24 text-right">Budget/day</div>
          <div className="w-20 text-right">Spent</div>
          <div className="w-16 text-right">Conv</div>
          <div className="w-16 text-right">CTR</div>
          <div className="w-14 text-center">Score</div>
          <div className="w-32"></div>
        </div>

        {/* Campaign rows */}
        {filteredCampaigns.map((campaign) => {
          const spend = campaign.spend ?? 0;
          const ctr = campaign.ctr ?? 0;
          const score = campaign.aiScore ?? 0;

          return (
            <div key={campaign.id} className="px-4 py-3 flex items-center gap-4 hover:bg-surface2/30 transition-colors">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected(campaign.id)}
                onChange={() => toggleSelection(campaign.id)}
                className="w-4 h-4 rounded border-divider"
              />

              {/* Campaign name & type */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${campaign.status === 'ENABLED' ? 'bg-success' : 'bg-text3'}`} />
                  <button
                    onClick={() => { setDrawerCampaign(campaign); setShowDrawer(true); }}
                    className="font-medium text-text truncate hover:text-accent hover:underline transition-colors text-left"
                  >
                    {campaign.name}
                  </button>
                </div>
                <span className="text-xs text-text3">{campaign.type}</span>
              </div>

              {/* Budget - Inline editable */}
              <div className="w-24 text-right">
                {savingBudgetId === campaign.id ? (
                  <div className="flex items-center justify-end gap-2">
                    <svg className="w-4 h-4 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm text-text3">Saving...</span>
                  </div>
                ) : editingBudgetId === campaign.id ? (
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-text3">$</span>
                    <input
                      type="number"
                      value={editingBudgetValue}
                      onChange={(e) => setEditingBudgetValue(e.target.value)}
                      onBlur={() => saveBudget(campaign.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveBudget(campaign.id);
                        if (e.key === 'Escape') setEditingBudgetId(null);
                      }}
                      className="w-16 px-1 py-0.5 bg-surface2 rounded text-sm text-text text-right focus:outline-none focus:ring-2 focus:ring-accent"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => startEditingBudget(campaign)}
                    className="text-sm text-text tabular-nums hover:text-accent transition-colors"
                    title="Click to edit"
                  >
                    ${(campaign.dailyBudget ?? 0).toLocaleString()}
                  </button>
                )}
              </div>

              {/* Spend */}
              <div className="w-20 text-right text-sm text-text tabular-nums">
                ${spend.toLocaleString()}
              </div>

              {/* Conversions */}
              <div className="w-16 text-right text-sm text-text tabular-nums">
                {campaign.conversions ?? 0}
              </div>

              {/* CTR */}
              <div className="w-16 text-right text-sm text-text tabular-nums">
                {ctr.toFixed(2)}%
              </div>

              {/* AI Score badge */}
              <button
                onClick={() => onScoreClick?.(campaign)}
                className={`w-10 h-7 rounded-lg text-sm font-medium ${getScoreColor(score)} hover:opacity-80 transition-opacity`}
              >
                {score}
              </button>

              {/* Actions */}
              <div className="w-32 flex justify-end gap-2">
                <button
                  onClick={() => drillIntoCampaign(campaign)}
                  className="px-2 py-1 text-xs bg-accent/10 text-accent rounded-lg hover:bg-accent hover:text-white transition-colors"
                  title="View ad groups"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleSinglePause(campaign)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    campaign.status === 'ENABLED'
                      ? 'bg-surface2 text-text2 hover:bg-danger hover:text-white'
                      : 'bg-success/20 text-success hover:bg-success hover:text-white'
                  }`}
                >
                  {campaign.status === 'ENABLED' ? 'Pause' : 'Enable'}
                </button>
              </div>
            </div>
          );
        })}

        {filteredCampaigns.length === 0 && (
          <div className="p-8 text-center text-text3">
            No campaigns found
          </div>
        )}
      </div>

      {/* Campaign Detail Drawer */}
      <CampaignDrawer
        campaign={drawerCampaign}
        isOpen={showDrawer}
        onClose={() => { setShowDrawer(false); setDrawerCampaign(null); }}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.variant}
      />
    </div>
  );
}
