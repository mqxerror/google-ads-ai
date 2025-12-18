'use client';

import { useState } from 'react';

export interface MetricOption {
  id: string;
  label: string;
  category: 'performance' | 'cost' | 'engagement' | 'conversion';
  description?: string;
}

interface MetricSelectorProps {
  availableMetrics: MetricOption[];
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
}

const METRIC_CATEGORIES = {
  performance: { label: 'Performance', color: 'blue' },
  cost: { label: 'Cost', color: 'green' },
  engagement: { label: 'Engagement', color: 'purple' },
  conversion: { label: 'Conversion', color: 'orange' },
};

export default function MetricSelector({
  availableMetrics,
  selectedMetrics,
  onMetricsChange,
}: MetricSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMetrics = availableMetrics.filter((metric) =>
    metric.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const metricsByCategory = filteredMetrics.reduce(
    (acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric);
      return acc;
    },
    {} as Record<string, MetricOption[]>
  );

  const toggleMetric = (metricId: string) => {
    if (selectedMetrics.includes(metricId)) {
      onMetricsChange(selectedMetrics.filter((id) => id !== metricId));
    } else {
      onMetricsChange([...selectedMetrics, metricId]);
    }
  };

  const toggleAll = () => {
    if (selectedMetrics.length === availableMetrics.length) {
      onMetricsChange([]);
    } else {
      onMetricsChange(availableMetrics.map((m) => m.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Select Metrics ({selectedMetrics.length})
        </h3>
        <button
          onClick={toggleAll}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {selectedMetrics.length === availableMetrics.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search metrics..."
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Metrics by Category */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(metricsByCategory).map(([category, metrics]) => {
          const categoryInfo = METRIC_CATEGORIES[category as keyof typeof METRIC_CATEGORIES];

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full bg-${categoryInfo.color}-500`}
                  style={{
                    backgroundColor:
                      categoryInfo.color === 'blue'
                        ? '#3b82f6'
                        : categoryInfo.color === 'green'
                          ? '#10b981'
                          : categoryInfo.color === 'purple'
                            ? '#8b5cf6'
                            : '#f59e0b',
                  }}
                />
                <h4 className="text-sm font-medium text-gray-700">
                  {categoryInfo.label}
                </h4>
              </div>

              <div className="space-y-1 ml-4">
                {metrics.map((metric) => (
                  <label
                    key={metric.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric.id)}
                      onChange={() => toggleMetric(metric.id)}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {metric.label}
                      </div>
                      {metric.description && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {metric.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Metrics Pills */}
      {selectedMetrics.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-500 mb-2">
            Selected Metrics:
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedMetrics.map((metricId) => {
              const metric = availableMetrics.find((m) => m.id === metricId);
              if (!metric) return null;

              return (
                <span
                  key={metricId}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                >
                  {metric.label}
                  <button
                    onClick={() => toggleMetric(metricId)}
                    className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
