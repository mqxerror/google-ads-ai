'use client';

import { Campaign, SortConfig } from '@/types/campaign';
import { useMode } from '@/contexts/ModeContext';

interface GridHeaderProps {
  sortConfig: SortConfig;
  onSort: (column: keyof Campaign) => void;
  allSelected: boolean;
  onSelectAll: () => void;
}

export type ColumnDef = {
  key: keyof Campaign;
  label: string;
  align?: 'left' | 'right';
  width?: string;
  proOnly?: boolean; // Only show in Pro mode
};

export const columns: ColumnDef[] = [
  { key: 'name', label: 'Campaign Name', align: 'left' },
  { key: 'status', label: 'Status', align: 'left', width: 'w-24' },
  { key: 'type', label: 'Type', align: 'left', width: 'w-28' },
  { key: 'spend', label: 'Spend', align: 'right', width: 'w-28' },
  { key: 'clicks', label: 'Clicks', align: 'right', width: 'w-24', proOnly: true },
  { key: 'conversions', label: 'Conv', align: 'right', width: 'w-20' },
  { key: 'ctr', label: 'CTR', align: 'right', width: 'w-20', proOnly: true },
  { key: 'cpa', label: 'CPA', align: 'right', width: 'w-24', proOnly: true },
  { key: 'aiScore', label: 'AI Score', align: 'right', width: 'w-24' },
];

export default function GridHeader({ sortConfig, onSort, allSelected, onSelectAll }: GridHeaderProps) {
  const { isProMode } = useMode();

  const visibleColumns = columns.filter(col => !col.proOnly || isProMode);
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50">
        <th className="w-12 px-4 py-3.5">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </th>
        {visibleColumns.map((col) => (
          <th
            key={col.key}
            scope="col"
            aria-sort={sortConfig.column === col.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 ${
              col.width || ''
            } ${col.align === 'right' ? 'text-right' : 'text-left'}`}
          >
            <button
              onClick={() => onSort(col.key)}
              className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
            >
              {col.label}
              <span className="flex flex-col">
                {sortConfig.column === col.key ? (
                  sortConfig.direction === 'asc' ? (
                    <svg className="h-3.5 w-3.5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" />
                    </svg>
                  )
                ) : (
                  <svg className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                )}
              </span>
            </button>
          </th>
        ))}
        <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 min-w-[200px]">
          Top Issue
        </th>
        <th scope="col" className="w-24 px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
          Actions
        </th>
      </tr>
    </thead>
  );
}
