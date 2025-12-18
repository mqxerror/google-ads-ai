'use client';

import { useDashboard, WidgetSize } from '@/contexts/DashboardContext';

const SIZE_OPTIONS: { value: WidgetSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'full', label: 'Full Width' },
];

export default function WidgetCustomizer() {
  const { widgets, toggleWidget, setWidgetSize, resetToDefault, isCustomizing, setIsCustomizing } = useDashboard();

  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  if (!isCustomizing) {
    return (
      <button
        onClick={() => setIsCustomizing(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Customize
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Customize Dashboard</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefault}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Reset to Default
          </button>
          <button
            onClick={() => setIsCustomizing(false)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {sortedWidgets.map(widget => (
          <div
            key={widget.id}
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              widget.visible
                ? 'border-slate-200 bg-white'
                : 'border-slate-100 bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Toggle */}
              <button
                onClick={() => toggleWidget(widget.id)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  widget.visible ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                aria-label={`Toggle ${widget.title} widget`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    widget.visible ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>

              {/* Widget Name */}
              <span className={`font-medium ${widget.visible ? 'text-slate-900' : 'text-slate-500'}`}>
                {widget.title}
              </span>
            </div>

            {/* Size Selector */}
            {widget.visible && (
              <select
                value={widget.size}
                onChange={(e) => setWidgetSize(widget.id, e.target.value as WidgetSize)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600"
              >
                {SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Toggle widgets on/off and adjust their size. Changes are saved automatically.
      </p>
    </div>
  );
}
