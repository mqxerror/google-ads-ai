'use client';

import { useState, useEffect } from 'react';

interface DashboardWidget {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large';
}

interface DashboardCustomizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (widgets: DashboardWidget[]) => void;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'performance-summary', name: 'Performance Summary', description: 'Key metrics overview', enabled: true, order: 0, size: 'large' },
  { id: 'spend-trend', name: 'Spend Trend', description: 'Daily spend over time', enabled: true, order: 1, size: 'medium' },
  { id: 'conversions-chart', name: 'Conversions Chart', description: 'Conversion trends', enabled: true, order: 2, size: 'medium' },
  { id: 'top-campaigns', name: 'Top Campaigns', description: 'Best performing campaigns', enabled: true, order: 3, size: 'medium' },
  { id: 'alerts', name: 'Alerts & Notifications', description: 'Recent alerts', enabled: true, order: 4, size: 'small' },
  { id: 'ai-insights', name: 'AI Insights', description: 'AI-powered recommendations', enabled: true, order: 5, size: 'medium' },
  { id: 'budget-status', name: 'Budget Status', description: 'Budget utilization', enabled: false, order: 6, size: 'small' },
  { id: 'competitor-analysis', name: 'Competitor Analysis', description: 'Market position insights', enabled: false, order: 7, size: 'medium' },
  { id: 'keyword-performance', name: 'Keyword Performance', description: 'Top keywords', enabled: false, order: 8, size: 'medium' },
  { id: 'geo-performance', name: 'Geographic Performance', description: 'Performance by location', enabled: false, order: 9, size: 'large' },
];

const STORAGE_KEY = 'google-ads-dashboard-widgets';

export default function DashboardCustomizationPanel({ isOpen, onClose, onSave }: DashboardCustomizationPanelProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  useEffect(() => {
    // Load saved configuration
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new widgets
        const merged = DEFAULT_WIDGETS.map(defaultWidget => {
          const savedWidget = parsed.find((w: DashboardWidget) => w.id === defaultWidget.id);
          return savedWidget || defaultWidget;
        });
        setWidgets(merged);
      } catch {
        setWidgets(DEFAULT_WIDGETS);
      }
    }
  }, []);

  const handleToggle = (widgetId: string) => {
    setWidgets(prev =>
      prev.map(w =>
        w.id === widgetId ? { ...w, enabled: !w.enabled } : w
      )
    );
  };

  const handleSizeChange = (widgetId: string, size: DashboardWidget['size']) => {
    setWidgets(prev =>
      prev.map(w =>
        w.id === widgetId ? { ...w, size } : w
      )
    );
  };

  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetId) return;

    setWidgets(prev => {
      const newWidgets = [...prev];
      const draggedIndex = newWidgets.findIndex(w => w.id === draggedWidget);
      const targetIndex = newWidgets.findIndex(w => w.id === targetId);

      const [removed] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(targetIndex, 0, removed);

      return newWidgets.map((w, i) => ({ ...w, order: i }));
    });
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    onSave?.(widgets);
    onClose();
  };

  const handleReset = () => {
    setWidgets(DEFAULT_WIDGETS);
  };

  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order);
  const disabledWidgets = widgets.filter(w => !w.enabled);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Customize Dashboard</h2>
            <p className="text-sm text-gray-500">
              Drag to reorder, toggle to show/hide widgets
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Enabled Widgets */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Active Widgets ({enabledWidgets.length})
            </h3>
            <div className="space-y-2">
              {enabledWidgets.map(widget => (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => handleDragStart(widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-move transition-colors ${
                    draggedWidget === widget.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-gray-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{widget.name}</p>
                    <p className="text-sm text-gray-500">{widget.description}</p>
                  </div>
                  <select
                    value={widget.size}
                    onChange={(e) => handleSizeChange(widget.id, e.target.value as DashboardWidget['size'])}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                  <button
                    onClick={() => handleToggle(widget.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                    title="Hide widget"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  </button>
                </div>
              ))}
              {enabledWidgets.length === 0 && (
                <p className="text-center py-4 text-gray-500">
                  No widgets enabled. Enable some widgets below.
                </p>
              )}
            </div>
          </div>

          {/* Disabled Widgets */}
          {disabledWidgets.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Available Widgets ({disabledWidgets.length})
              </h3>
              <div className="space-y-2">
                {disabledWidgets.map(widget => (
                  <div
                    key={widget.id}
                    className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-600 truncate">{widget.name}</p>
                      <p className="text-sm text-gray-400">{widget.description}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(widget.id)}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100"
                    >
                      Enable
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
          <button
            onClick={handleReset}
            className="text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Reset to Default
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
