'use client';

import { useState, useRef, useEffect } from 'react';

export type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  preset: DateRangePreset;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presetOptions: { id: DateRangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'last90days', label: 'Last 90 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
];

function getPresetDates(preset: DateRangePreset): { startDate: string; endDate: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
    }
    case 'last7days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'last30days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'last90days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    default:
      return { startDate: formatDate(today), endDate: formatDate(today) };
  }
}

function getPresetLabel(preset: DateRangePreset): string {
  return presetOptions.find(p => p.id === preset)?.label || 'Select Date Range';
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value.preset === 'custom');
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }

    const dates = getPresetDates(preset);
    onChange({ ...dates, preset });
    setShowCustom(false);
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      // Ensure start is before end
      const start = new Date(customStart);
      const end = new Date(customEnd);
      if (start > end) {
        onChange({ startDate: customEnd, endDate: customStart, preset: 'custom' });
      } else {
        onChange({ startDate: customStart, endDate: customEnd, preset: 'custom' });
      }
      setIsOpen(false);
    }
  };

  const displayLabel = value.preset === 'custom'
    ? `${formatDisplayDate(value.startDate)} - ${formatDisplayDate(value.endDate)}`
    : getPresetLabel(value.preset);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
      >
        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="max-w-[200px] truncate">{displayLabel}</span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Preset Options */}
          <div className="border-b border-gray-200 p-2">
            <div className="grid grid-cols-2 gap-1">
              {presetOptions.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`rounded px-3 py-2 text-left text-sm transition-colors ${
                    value.preset === preset.id && preset.id !== 'custom'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Range */}
          {showCustom && (
            <div className="p-3">
              <div className="mb-3 text-xs font-medium text-gray-500 uppercase">Custom Date Range</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleCustomApply}
                  disabled={!customStart || !customEnd}
                  className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export utility function to create initial date range
export function getDefaultDateRange(): DateRange {
  const dates = getPresetDates('last30days');
  return { ...dates, preset: 'last30days' };
}
