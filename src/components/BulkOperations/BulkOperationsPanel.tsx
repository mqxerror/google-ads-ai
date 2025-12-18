'use client';

import { useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';

interface SelectedEntity {
  id: string;
  name: string;
  type: 'campaign' | 'ad_group' | 'keyword';
  adGroupId?: string;
}

interface BulkOperationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEntities: SelectedEntity[];
  onClearSelection: () => void;
}

type BulkAction = 'pause' | 'enable' | 'update_budget';

interface OperationResult {
  entityId: string;
  entityName: string;
  success: boolean;
  error?: string;
}

export default function BulkOperationsPanel({
  isOpen,
  onClose,
  selectedEntities,
  onClearSelection,
}: BulkOperationsPanelProps) {
  const { currentAccount } = useAccount();
  const [selectedAction, setSelectedAction] = useState<BulkAction | null>(null);
  const [budgetValue, setBudgetValue] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<OperationResult[] | null>(null);

  const executeOperation = async () => {
    if (!selectedAction || !currentAccount) return;

    setIsExecuting(true);
    setResults(null);

    try {
      const operations = selectedEntities.map(entity => ({
        entityType: entity.type,
        entityId: entity.id,
        entityName: entity.name,
        action: selectedAction,
        value: selectedAction === 'update_budget' ? parseFloat(budgetValue) : undefined,
        adGroupId: entity.adGroupId,
      }));

      const response = await fetch('/api/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount.id,
          operations,
        }),
      });

      const data = await response.json();

      if (data.results) {
        setResults(data.results);
      }
    } catch (error) {
      console.error('Bulk operation error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClose = () => {
    setSelectedAction(null);
    setBudgetValue('');
    setResults(null);
    onClose();
  };

  if (!isOpen) return null;

  const successCount = results?.filter(r => r.success).length || 0;
  const failCount = results?.filter(r => !r.success).length || 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={handleClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk Operations</h2>
            <p className="text-sm text-gray-500">
              {selectedEntities.length} item{selectedEntities.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Selected Items Preview */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Items</h3>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {selectedEntities.slice(0, 10).map(entity => (
                <div key={entity.id} className="flex items-center gap-2 px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    entity.type === 'campaign' ? 'bg-blue-100 text-blue-700' :
                    entity.type === 'ad_group' ? 'bg-green-100 text-green-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {entity.type.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{entity.name}</span>
                </div>
              ))}
              {selectedEntities.length > 10 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  ... and {selectedEntities.length - 10} more
                </div>
              )}
            </div>
          </div>

          {/* Action Selection */}
          {!results && (
            <>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Select Action</h3>
                <div className="grid gap-2">
                  <button
                    onClick={() => setSelectedAction('pause')}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedAction === 'pause'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`rounded-lg p-2 ${
                      selectedAction === 'pause' ? 'bg-orange-100' : 'bg-gray-100'
                    }`}>
                      <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Pause All</div>
                      <div className="text-sm text-gray-500">Pause all selected items</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedAction('enable')}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedAction === 'enable'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`rounded-lg p-2 ${
                      selectedAction === 'enable' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Enable All</div>
                      <div className="text-sm text-gray-500">Enable all selected items</div>
                    </div>
                  </button>

                  {selectedEntities.every(e => e.type === 'campaign') && (
                    <button
                      onClick={() => setSelectedAction('update_budget')}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedAction === 'update_budget'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`rounded-lg p-2 ${
                        selectedAction === 'update_budget' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Update Budget</div>
                        <div className="text-sm text-gray-500">Set same budget for all campaigns</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Budget Input */}
              {selectedAction === 'update_budget' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Daily Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={budgetValue}
                      onChange={e => setBudgetValue(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <button
                onClick={executeOperation}
                disabled={!selectedAction || isExecuting || (selectedAction === 'update_budget' && !budgetValue)}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isExecuting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Executing...
                  </span>
                ) : (
                  `Execute on ${selectedEntities.length} item${selectedEntities.length !== 1 ? 's' : ''}`
                )}
              </button>
            </>
          )}

          {/* Results */}
          {results && (
            <div>
              <div className={`mb-4 rounded-lg p-4 ${
                failCount === 0 ? 'bg-green-50' : failCount === results.length ? 'bg-red-50' : 'bg-yellow-50'
              }`}>
                <div className="flex items-center gap-2">
                  {failCount === 0 ? (
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <span className={`font-medium ${
                    failCount === 0 ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {successCount} succeeded, {failCount} failed
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-medium text-gray-700 mb-2">Results</h3>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {results.map(result => (
                  <div key={result.entityId} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-gray-700 truncate">{result.entityName}</span>
                    {result.success ? (
                      <span className="text-green-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-red-600 text-xs">{result.error || 'Failed'}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    setResults(null);
                    setSelectedAction(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  New Operation
                </button>
                <button
                  onClick={() => {
                    handleClose();
                    onClearSelection();
                  }}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
