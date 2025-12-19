'use client';

export interface DiffItem {
  field: string;
  label: string;
  currentValue: string | number | null;
  newValue: string | number | null;
  type: 'add' | 'remove' | 'modify' | 'unchanged';
}

interface DiffViewProps {
  items: DiffItem[];
  compact?: boolean;
}

export default function DiffView({ items, compact = false }: DiffViewProps) {
  const changedItems = items.filter(item => item.type !== 'unchanged');

  if (changedItems.length === 0) {
    return (
      <div className="text-center py-4 text-[13px] text-[var(--text3)]">
        No changes to preview
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1">
        {changedItems.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-[13px] py-1">
            <span className="text-[var(--text2)]">{item.label}</span>
            <DiffValue item={item} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[var(--divider)]">
      {/* Header */}
      <div className="grid grid-cols-3 gap-0 bg-[var(--surface2)] border-b border-[var(--divider)]">
        <div className="px-3 py-2 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">
          Property
        </div>
        <div className="px-3 py-2 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide text-center border-x border-[var(--divider)]">
          Current
        </div>
        <div className="px-3 py-2 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide text-center">
          After
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--divider)]">
        {changedItems.map((item, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-3 gap-0 ${
              item.type === 'add'
                ? 'bg-[var(--success)]/5'
                : item.type === 'remove'
                  ? 'bg-[var(--danger)]/5'
                  : 'bg-[var(--surface)]'
            }`}
          >
            {/* Field name */}
            <div className="px-3 py-2.5 flex items-center">
              <span className={`text-[13px] font-medium ${
                item.type === 'add'
                  ? 'text-[var(--success)]'
                  : item.type === 'remove'
                    ? 'text-[var(--danger)]'
                    : 'text-[var(--text)]'
              }`}>
                {item.type === 'add' && '+ '}
                {item.type === 'remove' && '− '}
                {item.label}
              </span>
            </div>

            {/* Current value */}
            <div className="px-3 py-2.5 text-center border-x border-[var(--divider)]">
              {item.currentValue !== null ? (
                <span className={`text-[13px] ${
                  item.type === 'modify' || item.type === 'remove'
                    ? 'text-[var(--danger)] line-through'
                    : 'text-[var(--text2)]'
                }`}>
                  {item.currentValue}
                </span>
              ) : (
                <span className="text-[13px] text-[var(--text3)] italic">—</span>
              )}
            </div>

            {/* New value */}
            <div className="px-3 py-2.5 text-center">
              {item.newValue !== null ? (
                <span className={`text-[13px] font-medium ${
                  item.type === 'add' || item.type === 'modify'
                    ? 'text-[var(--success)]'
                    : 'text-[var(--text)]'
                }`}>
                  {item.newValue}
                </span>
              ) : (
                <span className="text-[13px] text-[var(--text3)] italic">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="px-3 py-2 bg-[var(--surface2)] border-t border-[var(--divider)] flex items-center justify-between">
        <span className="text-[11px] text-[var(--text3)]">
          {changedItems.length} change{changedItems.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-3 text-[11px]">
          {changedItems.filter(i => i.type === 'add').length > 0 && (
            <span className="text-[var(--success)]">
              +{changedItems.filter(i => i.type === 'add').length} added
            </span>
          )}
          {changedItems.filter(i => i.type === 'modify').length > 0 && (
            <span className="text-[var(--warning)]">
              {changedItems.filter(i => i.type === 'modify').length} modified
            </span>
          )}
          {changedItems.filter(i => i.type === 'remove').length > 0 && (
            <span className="text-[var(--danger)]">
              −{changedItems.filter(i => i.type === 'remove').length} removed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffValue({ item }: { item: DiffItem }) {
  if (item.type === 'add') {
    return (
      <span className="text-[var(--success)] font-medium">
        + {item.newValue}
      </span>
    );
  }

  if (item.type === 'remove') {
    return (
      <span className="text-[var(--danger)] font-medium line-through">
        {item.currentValue}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--text3)] line-through">{item.currentValue}</span>
      <svg className="w-3 h-3 text-[var(--text3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
      <span className="font-medium text-[var(--text)]">{item.newValue}</span>
    </div>
  );
}
