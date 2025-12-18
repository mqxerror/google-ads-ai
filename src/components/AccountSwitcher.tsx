'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useAccount, GoogleAdsAccount } from '@/contexts/AccountContext';

function StatusDot({ status }: { status: GoogleAdsAccount['status'] }) {
  const colors = {
    connected: 'bg-green-500',
    disconnected: 'bg-gray-400',
    error: 'bg-red-500',
  };

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status]}`}
      title={status}
    />
  );
}

function ManagerBadge() {
  return (
    <span className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
      MCC
    </span>
  );
}

interface GroupedAccounts {
  standalone: GoogleAdsAccount[];
  managers: {
    manager: GoogleAdsAccount;
    clients: GoogleAdsAccount[];
  }[];
}

export default function AccountSwitcher() {
  const { accounts, currentAccount, setCurrentAccount, isLoading, isSyncing, clearAndResyncAccounts } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Group accounts by manager
  const groupedAccounts = useMemo<GroupedAccounts>(() => {
    const managers = accounts.filter(a => a.isManager);
    const clients = accounts.filter(a => !a.isManager);

    // Group clients by their parent manager
    const managerGroups = managers.map(manager => ({
      manager,
      clients: clients.filter(c => c.parentManagerId === manager.googleAccountId),
    }));

    // Find standalone accounts (not under any manager)
    const standaloneAccounts = clients.filter(c => !c.parentManagerId);

    return {
      standalone: standaloneAccounts,
      managers: managerGroups,
    };
  }, [accounts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAccount = (account: GoogleAdsAccount) => {
    // Don't allow selecting manager accounts directly (they have no campaigns)
    if (account.isManager) return;
    setCurrentAccount(account);
    setIsOpen(false);
  };

  const handleAddAccount = () => {
    setIsOpen(false);
    window.location.href = '/api/auth/signin/google';
  };

  const handleResync = async () => {
    setIsOpen(false);
    await clearAndResyncAccounts();
  };

  if (isLoading) {
    return (
      <div className="flex h-10 w-48 animate-pulse items-center rounded-lg bg-gray-200 px-3">
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  const clientAccounts = accounts.filter(a => !a.isManager);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full min-w-48 items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {currentAccount ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <StatusDot status={currentAccount.status} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900">
                {currentAccount.accountName}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span className="truncate">{currentAccount.googleAccountId}</span>
                {currentAccount.parentManagerId && (
                  <span className="text-purple-600">(MCC)</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-500">Select Account</span>
        )}
        <svg
          className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {clientAccounts.length > 0 ? (
            <>
              {/* Standalone accounts (not under MCC) */}
              {groupedAccounts.standalone.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Direct Accounts
                  </div>
                  {groupedAccounts.standalone.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleSelectAccount(account)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 ${
                        currentAccount?.id === account.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <StatusDot status={account.status} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {account.accountName}
                        </div>
                        <div className="truncate text-xs text-gray-500">
                          {account.googleAccountId}
                        </div>
                      </div>
                      {currentAccount?.id === account.id && (
                        <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Manager accounts with their clients */}
              {groupedAccounts.managers.map((group) => (
                <div key={group.manager.id}>
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-t border-gray-100">
                    <ManagerBadge />
                    <span className="truncate">{group.manager.accountName}</span>
                    <span className="text-gray-400">({group.clients.length})</span>
                  </div>
                  {group.clients.length > 0 ? (
                    group.clients.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => handleSelectAccount(account)}
                        className={`flex w-full items-center gap-2 pl-6 pr-3 py-2 text-left hover:bg-gray-50 ${
                          currentAccount?.id === account.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <StatusDot status={account.status} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-900">
                            {account.accountName}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {account.googleAccountId}
                          </div>
                        </div>
                        {currentAccount?.id === account.id && (
                          <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="pl-6 pr-3 py-2 text-xs text-gray-400 italic">
                      No client accounts
                    </div>
                  )}
                </div>
              ))}
              <div className="my-1 border-t border-gray-200" />
            </>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No accounts connected
            </div>
          )}
          <button
            onClick={handleAddAccount}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-blue-600 hover:bg-blue-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">Add Account</span>
          </button>
          <button
            onClick={handleResync}
            disabled={isSyncing}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm font-medium">{isSyncing ? 'Syncing...' : 'Re-sync Accounts'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
