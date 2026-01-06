'use client';

import { useState } from 'react';

export type DateRangePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
  preset: DateRangePreset;
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  disabled?: boolean;
}

const PRESETS: { value: DateRangePreset; label: string; getDates: () => { startDate: string; endDate: string } }[] = [
  {
    value: 'today',
    label: 'Today',
    getDates: () => {
      const today = new Date().toISOString().split('T')[0];
      return { startDate: today, endDate: today };
    },
  },
  {
    value: 'yesterday',
    label: 'Yesterday',
    getDates: () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      return { startDate: yesterday, endDate: yesterday };
    },
  },
  {
    value: 'last_7_days',
    label: 'Last 7 Days',
    getDates: () => {
      const end = new Date();
      const start = new Date(Date.now() - 7 * 86400000);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    },
  },
  {
    value: 'last_30_days',
    label: 'Last 30 Days',
    getDates: () => {
      const end = new Date();
      const start = new Date(Date.now() - 30 * 86400000);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    },
  },
  {
    value: 'this_month',
    label: 'This Month',
    getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      };
    },
  },
  {
    value: 'last_month',
    label: 'Last Month',
    getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    },
  },
];

export function getDefaultDateRange(): DateRange {
  const preset = PRESETS.find(p => p.value === 'last_30_days')!;
  const dates = preset.getDates();
  return {
    ...dates,
    preset: 'last_30_days',
    label: preset.label,
  };
}

export function DateRangePicker({ value, onChange, disabled }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    const dates = preset.getDates();
    onChange({
      ...dates,
      preset: preset.value,
      label: preset.label,
    });
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-1.5
          bg-white border border-gray-200 rounded-lg
          text-xs font-medium text-gray-700
          hover:border-gray-300 hover:bg-gray-50
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all
        `}
      >
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{value.label}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset)}
                className={`
                  w-full px-3 py-2 text-left text-xs
                  hover:bg-gray-50 transition-colors
                  ${value.preset === preset.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                `}
              >
                {preset.label}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1 px-3 py-2">
              <div className="text-[10px] text-gray-400">
                {value.startDate} to {value.endDate}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
