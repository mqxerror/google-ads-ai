'use client';

import { useState, useMemo } from 'react';
import { Campaign } from '@/types/campaign';
import MetricSelector, { MetricOption } from './MetricSelector';
import ReportPreview from './ReportPreview';

interface ReportBuilderProps {
  campaigns: Campaign[];
}

const AVAILABLE_METRICS: MetricOption[] = [
  { id: 'spend', label: 'Spend', category: 'cost', description: 'Total advertising spend' },
  {
    id: 'cpa',
    label: 'Cost Per Acquisition',
    category: 'cost',
    description: 'Average cost per conversion',
  },
  { id: 'clicks', label: 'Clicks', category: 'engagement', description: 'Total number of clicks' },
  {
    id: 'impressions',
    label: 'Impressions',
    category: 'engagement',
    description: 'Total number of impressions',
  },
  {
    id: 'ctr',
    label: 'Click-Through Rate',
    category: 'engagement',
    description: 'Percentage of impressions that resulted in clicks',
  },
  {
    id: 'conversions',
    label: 'Conversions',
    category: 'conversion',
    description: 'Total number of conversions',
  },
  {
    id: 'roas',
    label: 'Return on Ad Spend',
    category: 'performance',
    description: 'Revenue generated per dollar spent',
  },
  {
    id: 'ai_score',
    label: 'AI Score',
    category: 'performance',
    description: 'AI-generated performance score',
  },
];

const DIMENSIONS = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'type', label: 'Campaign Type' },
  { id: 'status', label: 'Campaign Status' },
  { id: 'date', label: 'Date' },
];

const DATE_PRESETS = [
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'last_90_days', label: 'Last 90 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'custom', label: 'Custom range' },
];

export default function ReportBuilder({ campaigns }: ReportBuilderProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'spend',
    'clicks',
    'conversions',
    'cpa',
  ]);
  const [dimension, setDimension] = useState('campaign');
  const [datePreset, setDatePreset] = useState('last_30_days');
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: '',
  });
  const [showPreview, setShowPreview] = useState(false);
  const [reportName, setReportName] = useState('');

  const dateRange = useMemo(() => {
    const today = new Date();
    let start: Date;
    let end = today;

    switch (datePreset) {
      case 'last_7_days':
        start = new Date(today);
        start.setDate(start.getDate() - 7);
        break;
      case 'last_30_days':
        start = new Date(today);
        start.setDate(start.getDate() - 30);
        break;
      case 'last_90_days':
        start = new Date(today);
        start.setDate(start.getDate() - 90);
        break;
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'custom':
        return {
          start: customDateRange.start || today.toISOString().split('T')[0],
          end: customDateRange.end || today.toISOString().split('T')[0],
        };
      default:
        start = new Date(today);
        start.setDate(start.getDate() - 30);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, [datePreset, customDateRange]);

  const handleExportCSV = () => {
    // Create CSV content
    const headers = [
      dimension === 'campaign' ? 'Campaign' : dimension,
      ...selectedMetrics.map(
        (id) => AVAILABLE_METRICS.find((m) => m.id === id)?.label || id
      ),
    ];

    const getMetricValue = (campaign: Campaign, metricId: string): string => {
      switch (metricId) {
        case 'spend':
          return campaign.spend.toString();
        case 'conversions':
          return campaign.conversions.toString();
        case 'clicks':
          return campaign.clicks.toString();
        case 'impressions':
          return campaign.impressions.toString();
        case 'ctr':
          return campaign.ctr.toString();
        case 'cpa':
          return campaign.cpa.toString();
        case 'roas':
          return campaign.roas.toString();
        case 'ai_score':
          return campaign.aiScore.toString();
        default:
          return '';
      }
    };

    const rows = campaigns.map((campaign) => [
      campaign.name,
      ...selectedMetrics.map((id) => getMetricValue(campaign, id)),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportName || 'google-ads-report'}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Custom Report Builder
              </h1>
              <p className="text-gray-600 mt-1">
                Create custom reports with selected metrics and dimensions
              </p>
            </div>
          </div>

          {/* Report Name */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Name
            </label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Enter report name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Metrics Selection */}
          <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-6">
            <MetricSelector
              availableMetrics={AVAILABLE_METRICS}
              selectedMetrics={selectedMetrics}
              onMetricsChange={setSelectedMetrics}
            />
          </div>

          {/* Dimensions and Date Range */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dimension Selection */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Dimension
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {DIMENSIONS.map((dim) => (
                  <button
                    key={dim.id}
                    onClick={() => setDimension(dim.id)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                      dimension === dim.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{dim.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Date Range
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setDatePreset(preset.id)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                      datePreset === preset.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {datePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) =>
                        setCustomDateRange((prev) => ({ ...prev, start: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) =>
                        setCustomDateRange((prev) => ({ ...prev, end: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                Selected range: {dateRange.start} to {dateRange.end}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={selectedMetrics.length === 0}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {showPreview ? 'Hide Preview' : 'Preview Report'}
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={selectedMetrics.length === 0}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <ReportPreview
              campaigns={campaigns}
              selectedMetrics={selectedMetrics}
              availableMetrics={AVAILABLE_METRICS}
              dimension={dimension}
              dateRange={dateRange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
