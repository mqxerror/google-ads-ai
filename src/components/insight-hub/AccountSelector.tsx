'use client';

import { GoogleAdsAccount } from '@/hooks/useInsightChat';

interface AccountSelectorProps {
  accounts: GoogleAdsAccount[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
  isLoading?: boolean;
}

export function AccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
  isLoading = false,
}: AccountSelectorProps) {
  if (accounts.length === 0) {
    return null;
  }

  // Don't show selector if only one account
  if (accounts.length === 1) {
    return (
      <div className="text-xs text-gray-500 px-2 py-1">
        {accounts[0].descriptiveName || `Account ${accounts[0].customerId}`}
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={selectedAccountId || ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={isLoading}
        className={`
          appearance-none
          bg-white border border-gray-200 rounded-lg
          px-3 py-1.5 pr-8
          text-xs font-medium text-gray-700
          cursor-pointer
          hover:border-gray-300 hover:bg-gray-50
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-wait
          transition-all
        `}
      >
        {accounts.map((account) => (
          <option key={account.customerId} value={account.customerId}>
            {account.descriptiveName || `Account ${account.customerId}`}
          </option>
        ))}
      </select>
      {/* Custom dropdown arrow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
        {isLoading ? (
          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
    </div>
  );
}
