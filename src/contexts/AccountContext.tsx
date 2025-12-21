'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface GoogleAdsAccount {
  id: string;
  googleAccountId: string;
  accountName: string;
  status: 'connected' | 'disconnected' | 'error';
  isManager: boolean;
  parentManagerId: string | null;
  lastSyncAt: string | null;
  createdAt?: string;
}

interface AccountContextType {
  accounts: GoogleAdsAccount[];
  currentAccount: GoogleAdsAccount | null;
  setCurrentAccount: (account: GoogleAdsAccount | null) => void;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refreshAccounts: () => Promise<void>;
  syncGoogleAdsAccounts: () => Promise<void>;
  clearAndResyncAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

const SELECTED_ACCOUNT_KEY = 'selected-account-id';

// Helper to find first selectable (non-manager) account
function findFirstClientAccount(accounts: GoogleAdsAccount[]): GoogleAdsAccount | null {
  return accounts.find(a => !a.isManager) || null;
}

// Helper to get saved account ID from localStorage
function getSavedAccountId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(SELECTED_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

// Helper to save account ID to localStorage
function saveAccountId(accountId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (accountId) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, accountId);
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [currentAccount, setCurrentAccountState] = useState<GoogleAdsAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  // Wrapper for setCurrentAccount that also persists to localStorage
  const setCurrentAccount = useCallback((account: GoogleAdsAccount | null) => {
    setCurrentAccountState(account);
    saveAccountId(account?.id || null);
  }, []);

  const refreshAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/accounts');
      if (!response.ok) {
        if (response.status === 401) {
          // Not logged in, don't show error
          setAccounts([]);
          setIsAuthenticated(false);
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      setIsAuthenticated(true);
      const data = await response.json();
      const fetchedAccounts = data.accounts || [];
      setAccounts(fetchedAccounts);

      // Try to restore saved account from localStorage, or select first client account
      if (!currentAccount && fetchedAccounts.length > 0) {
        const savedAccountId = getSavedAccountId();
        const savedAccount = savedAccountId
          ? fetchedAccounts.find((a: GoogleAdsAccount) => a.id === savedAccountId)
          : null;

        if (savedAccount) {
          setCurrentAccountState(savedAccount);
        } else {
          const firstClient = findFirstClientAccount(fetchedAccounts);
          if (firstClient) {
            setCurrentAccount(firstClient);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount]);

  // Sync Google Ads accounts from the API
  const syncGoogleAdsAccounts = useCallback(async () => {
    try {
      setIsSyncing(true);
      setError(null);
      const response = await fetch('/api/google-ads/accounts');
      const data = await response.json();

      if (!response.ok) {
        // Handle typed error response
        const errorMessage = data.action
          ? `${data.error}. ${data.action}`
          : data.error || 'Failed to sync accounts';
        const correlationId = data.correlationId ? ` (ref: ${data.correlationId})` : '';
        throw new Error(`${errorMessage}${correlationId}`);
      }

      // Update local state with synced accounts
      if (data.accounts?.length > 0) {
        setAccounts(data.accounts);
        // Set first client account as current if none selected (skip manager accounts)
        if (!currentAccount) {
          const firstClient = findFirstClientAccount(data.accounts);
          if (firstClient) {
            setCurrentAccount(firstClient);
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('[AccountContext] Error syncing Google Ads accounts:', errorMsg);
    } finally {
      setIsSyncing(false);
    }
  }, [currentAccount]);

  // Clear all accounts and re-sync from Google Ads API
  const clearAndResyncAccounts = useCallback(async () => {
    try {
      setIsSyncing(true);
      setError(null);
      setCurrentAccount(null);
      setAccounts([]);

      // Delete all existing accounts
      await fetch('/api/accounts', { method: 'DELETE' });

      // Re-sync from Google Ads API
      const response = await fetch('/api/google-ads/accounts');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync accounts');
      }
      const data = await response.json();

      // Update local state with synced accounts
      if (data.accounts?.length > 0) {
        setAccounts(data.accounts);
        // Set first client account as current (skip manager accounts)
        const firstClient = findFirstClientAccount(data.accounts);
        if (firstClient) {
          setCurrentAccount(firstClient);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error re-syncing Google Ads accounts:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshAccounts();
  }, []);

  // Auto-sync Google Ads accounts if user has no accounts yet
  useEffect(() => {
    if (!isLoading && accounts.length === 0 && !isSyncing && isAuthenticated) {
      // Try to sync accounts from Google Ads API
      syncGoogleAdsAccounts();
    }
  }, [isLoading, accounts.length, isSyncing, isAuthenticated, syncGoogleAdsAccounts]);

  return (
    <AccountContext.Provider
      value={{
        accounts,
        currentAccount,
        setCurrentAccount,
        isLoading,
        isSyncing,
        error,
        refreshAccounts,
        syncGoogleAdsAccounts,
        clearAndResyncAccounts,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}
