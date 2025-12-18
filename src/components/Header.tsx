'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import ModeToggle from './ModeToggle';
import UserMenu from './UserMenu';
import GuardrailsSettingsPanel from './GuardrailsSettingsPanel';
import ActivityLogPanel from './ActivityLogPanel';
import { ReportingDashboard } from '@/components/Reporting';
import { AutomatedRulesPanel } from '@/components/AutomatedRules';
import { MCCDashboard } from '@/components/MCCDashboard';
import { NotificationsPanel } from '@/components/Notifications';
import { AIAssistantPanel } from '@/components/AIAssistant';
import { ABTestingPanel } from '@/components/ABTesting';
import { useGuardrails } from '@/contexts/GuardrailsContext';
import { useAccount } from '@/contexts/AccountContext';
import { useUndoRedo } from '@/contexts/UndoRedoContext';
import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import UndoRedoButtons from './UndoRedo/UndoRedoButtons';
import { DataFreshnessBadge } from './DataFreshness';
import { OpsCenter } from './OpsCenter';
import { useActionQueue } from '@/contexts/ActionQueueContext';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { data: session } = useSession();
  const { settings } = useGuardrails();
  const { currentAccount } = useAccount();
  const { lastSyncedAt, syncStatus, dataCompleteness, refetch } = useCampaignsData();
  const { pendingCount } = useActionQueue();
  const [isOpsCenterOpen, setIsOpsCenterOpen] = useState(false);
  const [isGuardrailsOpen, setIsGuardrailsOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isReportingOpen, setIsReportingOpen] = useState(false);
  const [isAutomatedRulesOpen, setIsAutomatedRulesOpen] = useState(false);
  const [isMCCDashboardOpen, setIsMCCDashboardOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isABTestingOpen, setIsABTestingOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?unreadOnly=true');
      if (response.ok) {
        const data = await response.json();
        setUnreadNotifications(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  }, []);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    if (session?.user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000); // Every minute
      return () => clearInterval(interval);
    }
  }, [session?.user, fetchUnreadCount]);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
            GA
          </div>
          <span className="hidden lg:inline text-sm font-semibold text-gray-900">
            Google Ads Manager
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-gray-200" />

        {/* Account Selector */}
        <button
          onClick={() => setIsMCCDashboardOpen(true)}
          className="hidden sm:flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          title="Switch Account"
        >
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="max-w-[120px] truncate">{currentAccount?.accountName || 'All Accounts'}</span>
          <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-gray-200" />

        {/* Undo/Redo - compact */}
        <div className="hidden sm:flex items-center">
          <UndoRedoButtons size="sm" />
        </div>
      </div>

      {/* Center: Search trigger + Data Freshness */}
      <div className="hidden md:flex items-center gap-3">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:border-gray-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden lg:inline">Search...</span>
          <kbd className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">⌘K</kbd>
        </button>

        {/* Data Freshness Badge */}
        {currentAccount && (
          <DataFreshnessBadge
            lastSyncedAt={lastSyncedAt}
            syncStatus={syncStatus}
            dataCompleteness={dataCompleteness}
            onRefresh={refetch}
          />
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Ops Center - primary action with queue count */}
        <button
          onClick={() => setIsOpsCenterOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          title="Ops Center"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="hidden sm:inline">Ops</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </button>

        {/* AI Assistant */}
        <button
          onClick={() => setIsAIAssistantOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          title="AI Assistant"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="hidden sm:inline">AI</span>
        </button>

        {/* Tools dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            title="Tools"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            <span className="hidden sm:inline">Tools</span>
          </button>

          {isMoreMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => { setIsReportingOpen(true); setIsMoreMenuOpen(false); }}
                  disabled={!currentAccount}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Reports
                </button>
                <button
                  onClick={() => { setIsAutomatedRulesOpen(true); setIsMoreMenuOpen(false); }}
                  disabled={!currentAccount}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Automated Rules
                </button>
                <button
                  onClick={() => { setIsABTestingOpen(true); setIsMoreMenuOpen(false); }}
                  disabled={!currentAccount}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  A/B Testing
                </button>
                <div className="my-1 border-t border-gray-200" />
                <button
                  onClick={() => { setIsGuardrailsOpen(true); setIsMoreMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Guardrails
                  {settings.enabled && <span className="ml-auto h-2 w-2 rounded-full bg-green-500" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200" />

        {/* Notifications */}
        <button
          onClick={() => setIsNotificationsOpen(true)}
          className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          title="Notifications"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>

        {/* Mode toggle */}
        <div className="hidden sm:block">
          <ModeToggle />
        </div>

        {/* User Menu */}
        {session?.user && (
          <UserMenu user={session.user} />
        )}
      </div>

      {/* Guardrails Settings Panel */}
      <GuardrailsSettingsPanel
        isOpen={isGuardrailsOpen}
        onClose={() => setIsGuardrailsOpen(false)}
      />

      {/* Activity Log Panel */}
      <ActivityLogPanel
        isOpen={isActivityLogOpen}
        onClose={() => setIsActivityLogOpen(false)}
        accountId={currentAccount?.id}
      />

      {/* Reporting Dashboard */}
      <ReportingDashboard
        isOpen={isReportingOpen}
        onClose={() => setIsReportingOpen(false)}
      />

      {/* Automated Rules Panel */}
      <AutomatedRulesPanel
        isOpen={isAutomatedRulesOpen}
        onClose={() => setIsAutomatedRulesOpen(false)}
      />

      {/* MCC Dashboard */}
      <MCCDashboard
        isOpen={isMCCDashboardOpen}
        onClose={() => setIsMCCDashboardOpen(false)}
      />

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false);
          fetchUnreadCount(); // Refresh count when closing
        }}
      />

      {/* AI Assistant Panel */}
      <AIAssistantPanel
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
      />

      {/* A/B Testing Panel */}
      <ABTestingPanel
        isOpen={isABTestingOpen}
        onClose={() => setIsABTestingOpen(false)}
      />

      {/* Ops Center */}
      <OpsCenter
        isOpen={isOpsCenterOpen}
        onClose={() => setIsOpsCenterOpen(false)}
      />
    </header>
  );
}
