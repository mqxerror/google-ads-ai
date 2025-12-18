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
  proOnly?: boolean;
};

// Apple-style column model: Campaign, Type, Spend, Conv, CPA, Health, Primary Issue
export const columns: ColumnDef[] = [
  { key: 'name', label: 'Campaign', align: 'left' },
  { key: 'type', label: 'Type', align: 'left', width: 'w-24' },
  { key: 'spend', label: 'Spend', align: 'right', width: 'w-24' },
  { key: 'conversions', label: 'Conv', align: 'right', width: 'w-20' },
  { key: 'cpa', label: 'CPA', align: 'right', width: 'w-20' },
  { key: 'aiScore', label: 'Health', align: 'right', width: 'w-28' },
];

export default function GridHeader({ sortConfig, onSort, allSelected, onSelectAll }: GridHeaderProps) {
  const { isProMode } = useMode();

  const visibleColumns = columns.filter(col => !col.proOnly || isProMode);

  return (
    <thead>
      <tr className="apple-table-header">
        {/* Checkbox column */}
        <th className="w-12 px-4 py-3">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="h-4 w-4 rounded border-[var(--divider)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0"
          />
        </th>

        {/* Data columns */}
        {visibleColumns.map((col) => (
          <th
            key={col.key}
            scope="col"
            aria-sort={sortConfig.column === col.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={`px-4 py-3 ${col.width || ''} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
          >
            <button
              onClick={() => onSort(col.key)}
              className="group inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors"
            >
              {col.label}
              <span className="flex flex-col">
                {sortConfig.column === col.key ? (
                  sortConfig.direction === 'asc' ? (
                    <svg className="h-3 w-3 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" />
                    </svg>
                  )
                ) : (
                  <svg className="h-3 w-3 text-[var(--text3)] group-hover:text-[var(--text2)]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                )}
              </span>
            </button>
          </th>
        ))}

        {/* Primary Issue column - no sorting */}
        <th scope="col" className="px-4 py-3 text-left min-w-[200px]">
          Issue
        </th>
      </tr>
    </thead>
  );
}
