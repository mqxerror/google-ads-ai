'use client';

import { useState, useRef, useEffect } from 'react';
import { Campaign, AdGroup, Keyword } from '@/types/campaign';

interface BulkActionsBarProps {
  selectedCount: number;
  entityType: 'campaigns' | 'adGroups' | 'keywords';
  onPause: () => void;
  onEnable: () => void;
  onRemove: () => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
  selectedItems?: (Campaign | AdGroup | Keyword)[];
}

export default function BulkActionsBar({
  selectedCount,
  entityType,
  onPause,
  onEnable,
  onRemove,
  onClearSelection,
  isProcessing = false,
  selectedItems = [],
}: BulkActionsBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Export selected items to CSV
  const handleExportCSV = () => {
    if (selectedItems.length === 0) return;

    let headers: string[];
    let rows: string[][];

    if (entityType === 'campaigns') {
      headers = ['ID', 'Name', 'Status', 'Type', 'Spend', 'Clicks', 'Impressions', 'Conversions', 'CTR', 'CPA', 'ROAS', 'AI Score'];
      rows = (selectedItems as Campaign[]).map(c => [
        c.id,
        c.name,
        c.status,
        c.type,
        c.spend.toFixed(2),
        c.clicks.toString(),
        c.impressions.toString(),
        c.conversions.toString(),
        c.ctr.toFixed(2),
        c.cpa.toFixed(2),
        c.roas.toFixed(2),
        c.aiScore.toString(),
      ]);
    } else if (entityType === 'adGroups') {
      headers = ['ID', 'Name', 'Status', 'Spend', 'Clicks', 'Conversions', 'CPA'];
      rows = (selectedItems as AdGroup[]).map(a => [
        a.id,
        a.name,
        a.status,
        a.spend.toFixed(2),
        a.clicks.toString(),
        a.conversions.toString(),
        a.cpa.toFixed(2),
      ]);
    } else {
      headers = ['ID', 'Keyword', 'Match Type', 'Status', 'Quality Score', 'Spend', 'Clicks', 'Conversions', 'CPA'];
      rows = (selectedItems as Keyword[]).map(k => [
        k.id,
        k.text,
        k.matchType,
        k.status,
        k.qualityScore.toString(),
        k.spend.toFixed(2),
        k.clicks.toString(),
        k.conversions.toString(),
        k.cpa.toFixed(2),
      ]);
    }

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${entityType}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDropdown(false);
  };

  // Copy selected items to clipboard as JSON
  const handleCopyToClipboard = () => {
    if (selectedItems.length === 0) return;
    const json = JSON.stringify(selectedItems, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      alert(`Copied ${selectedItems.length} ${entityType} to clipboard`);
    });
    setShowDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (selectedCount === 0) {
    return null;
  }

  const entityLabel = entityType === 'campaigns'
    ? 'campaign'
    : entityType === 'adGroups'
    ? 'ad group'
    : 'keyword';

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <span className="text-sm font-semibold text-blue-600">{selectedCount}</span>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {entityLabel}{selectedCount > 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPause}
            disabled={isProcessing}
            className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pause
          </button>

          <button
            onClick={onEnable}
            disabled={isProcessing}
            className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Enable
          </button>

          {/* More Actions Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={isProcessing}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              More
              <svg className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={handleExportCSV}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export to CSV
                </button>
                <button
                  onClick={handleCopyToClipboard}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy to Clipboard
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={() => {
                    onRemove();
                    setShowDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* Clear Selection */}
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </div>
        )}
      </div>
    </div>
  );
}
