'use client';

import { useState, useMemo } from 'react';
import { useAccount, GoogleAdsAccount } from '@/contexts/AccountContext';

interface MCCDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AccountStats {
  totalAccounts: number;
  managerAccounts: number;
  clientAccounts: number;
  connectedAccounts: number;
  disconnectedAccounts: number;
  errorAccounts: number;
}

interface ManagerWithClients {
  manager: GoogleAdsAccount;
  clients: GoogleAdsAccount[];
  stats: {
    connected: number;
    disconnected: number;
    error: number;
  };
}

export default function MCCDashboard({ isOpen, onClose }: MCCDashboardProps) {
  const { accounts, currentAccount, setCurrentAccount, isSyncing, clearAndResyncAccounts } = useAccount();
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate account statistics
  const stats = useMemo<AccountStats>(() => {
    return {
      totalAccounts: accounts.length,
      managerAccounts: accounts.filter(a => a.isManager).length,
      clientAccounts: accounts.filter(a => !a.isManager).length,
      connectedAccounts: accounts.filter(a => a.status === 'connected').length,
      disconnectedAccounts: accounts.filter(a => a.status === 'disconnected').length,
      errorAccounts: accounts.filter(a => a.status === 'error').length,
    };
  }, [accounts]);

  // Group accounts by manager
  const groupedAccounts = useMemo<{
    standalone: GoogleAdsAccount[];
    managers: ManagerWithClients[];
  }>(() => {
    const managers = accounts.filter(a => a.isManager);
    const clients = accounts.filter(a => !a.isManager);

    const managerGroups: ManagerWithClients[] = managers.map(manager => {
      const managerClients = clients.filter(c => c.parentManagerId === manager.googleAccountId);
      return {
        manager,
        clients: managerClients,
        stats: {
          connected: managerClients.filter(c => c.status === 'connected').length,
          disconnected: managerClients.filter(c => c.status === 'disconnected').length,
          error: managerClients.filter(c => c.status === 'error').length,
        },
      };
    });

    const standaloneAccounts = clients.filter(c => !c.parentManagerId);

    return {
      standalone: standaloneAccounts,
      managers: managerGroups,
    };
  }, [accounts]);

  // Filter accounts by search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return groupedAccounts;

    const query = searchQuery.toLowerCase();

    const filteredStandalone = groupedAccounts.standalone.filter(
      a => a.accountName.toLowerCase().includes(query) || a.googleAccountId.includes(query)
    );

    const filteredManagers = groupedAccounts.managers
      .map(group => ({
        ...group,
        clients: group.clients.filter(
          c => c.accountName.toLowerCase().includes(query) || c.googleAccountId.includes(query)
        ),
      }))
      .filter(group =>
        group.manager.accountName.toLowerCase().includes(query) ||
        group.manager.googleAccountId.includes(query) ||
        group.clients.length > 0
      );

    return {
      standalone: filteredStandalone,
      managers: filteredManagers,
    };
  }, [groupedAccounts, searchQuery]);

  const toggleManager = (managerId: string) => {
    const newExpanded = new Set(expandedManagers);
    if (newExpanded.has(managerId)) {
      newExpanded.delete(managerId);
    } else {
      newExpanded.add(managerId);
    }
    setExpandedManagers(newExpanded);
  };

  const handleSelectAccount = (account: GoogleAdsAccount) => {
    if (!account.isManager) {
      setCurrentAccount(account);
      onClose();
    }
  };

  const getStatusColor = (status: GoogleAdsAccount['status']) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-gray-400';
      case 'error': return 'bg-red-500';
    }
  };

  const getStatusBadge = (status: GoogleAdsAccount['status']) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-700';
      case 'disconnected': return 'bg-gray-100 text-gray-700';
      case 'error': return 'bg-red-100 text-red-700';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full max-w-4xl rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Account Manager</h2>
              <p className="mt-1 text-sm text-gray-500">Manage all your Google Ads accounts</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.totalAccounts}</div>
              <div className="text-sm text-gray-500">Total Accounts</div>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <div className="text-2xl font-bold text-purple-700">{stats.managerAccounts}</div>
              <div className="text-sm text-purple-600">Manager (MCC)</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="text-2xl font-bold text-green-700">{stats.connectedAccounts}</div>
              <div className="text-sm text-green-600">Connected</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-2xl font-bold text-blue-700">{stats.clientAccounts}</div>
              <div className="text-sm text-blue-600">Client Accounts</div>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="flex items-center gap-4 border-b border-gray-200 px-6 pb-4">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={clearAndResyncAccounts}
              disabled={isSyncing}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isSyncing ? 'Syncing...' : 'Sync Accounts'}
            </button>
          </div>

          {/* Account List */}
          <div className="max-h-[400px] overflow-y-auto p-6">
            {accounts.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No accounts connected</h3>
                <p className="mt-2 text-sm text-gray-500">Connect your Google Ads accounts to get started</p>
                <button
                  onClick={clearAndResyncAccounts}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Connect Accounts
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Standalone Accounts */}
                {filteredAccounts.standalone.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Direct Accounts ({filteredAccounts.standalone.length})
                    </h3>
                    <div className="space-y-2">
                      {filteredAccounts.standalone.map((account) => (
                        <button
                          key={account.id}
                          onClick={() => handleSelectAccount(account)}
                          className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                            currentAccount?.id === account.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${getStatusColor(account.status)}`} />
                            <div>
                              <div className="font-medium text-gray-900">{account.accountName}</div>
                              <div className="text-sm text-gray-500">{account.googleAccountId}</div>
                            </div>
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(account.status)}`}>
                            {account.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manager Accounts with Clients */}
                {filteredAccounts.managers.map((group) => (
                  <div key={group.manager.id} className="rounded-lg border border-gray-200 overflow-hidden">
                    {/* Manager Header */}
                    <button
                      onClick={() => toggleManager(group.manager.id)}
                      className="flex w-full items-center justify-between bg-purple-50 p-3 text-left hover:bg-purple-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center rounded bg-purple-200 px-2 py-0.5 text-xs font-semibold text-purple-800">
                          MCC
                        </span>
                        <div>
                          <div className="font-medium text-gray-900">{group.manager.accountName}</div>
                          <div className="text-sm text-gray-500">{group.manager.googleAccountId}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-600">{group.stats.connected} connected</span>
                          {group.stats.error > 0 && (
                            <span className="text-red-600">{group.stats.error} error</span>
                          )}
                        </div>
                        <span className="text-gray-400">
                          {group.clients.length} {group.clients.length === 1 ? 'client' : 'clients'}
                        </span>
                        <svg
                          className={`h-5 w-5 text-gray-400 transition-transform ${expandedManagers.has(group.manager.id) ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Client Accounts */}
                    {expandedManagers.has(group.manager.id) && (
                      <div className="divide-y divide-gray-100 bg-white">
                        {group.clients.length > 0 ? (
                          group.clients.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => handleSelectAccount(client)}
                              className={`flex w-full items-center justify-between p-3 pl-12 text-left transition-colors ${
                                currentAccount?.id === client.id
                                  ? 'bg-blue-50'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`h-2 w-2 rounded-full ${getStatusColor(client.status)}`} />
                                <div>
                                  <div className="font-medium text-gray-900">{client.accountName}</div>
                                  <div className="text-sm text-gray-500">{client.googleAccountId}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(client.status)}`}>
                                  {client.status}
                                </span>
                                {currentAccount?.id === client.id && (
                                  <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 pl-12 text-sm text-gray-500 italic">
                            No client accounts under this manager
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <p className="text-sm text-gray-500">
              {currentAccount ? (
                <>
                  Currently managing: <span className="font-medium text-gray-700">{currentAccount.accountName}</span>
                </>
              ) : (
                'Select an account to manage'
              )}
            </p>
            <button
              onClick={() => window.location.href = '/api/auth/signin/google'}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
