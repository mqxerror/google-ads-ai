'use client';

import { Campaign } from '@/types/campaign';
import { MetricOption } from './MetricSelector';

interface ReportPreviewProps {
  campaigns: Campaign[];
  selectedMetrics: string[];
  availableMetrics: MetricOption[];
  dimension: string;
  dateRange: { start: string; end: string };
}

export default function ReportPreview({
  campaigns,
  selectedMetrics,
  availableMetrics,
  dimension,
  dateRange,
}: ReportPreviewProps) {
  if (selectedMetrics.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No metrics selected
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Select metrics to preview your report
          </p>
        </div>
      </div>
    );
  }

  const getMetricValue = (campaign: Campaign, metricId: string): string | number => {
    switch (metricId) {
      case 'spend':
        return `$${campaign.spend.toLocaleString()}`;
      case 'conversions':
        return campaign.conversions.toLocaleString();
      case 'clicks':
        return campaign.clicks.toLocaleString();
      case 'impressions':
        return campaign.impressions.toLocaleString();
      case 'ctr':
        return `${campaign.ctr.toFixed(2)}%`;
      case 'cpa':
        return `$${campaign.cpa.toFixed(2)}`;
      case 'roas':
        return `${campaign.roas.toFixed(2)}x`;
      case 'ai_score':
        return campaign.aiScore;
      default:
        return '-';
    }
  };

  const getColumnLabel = (metricId: string): string => {
    const metric = availableMetrics.find((m) => m.id === metricId);
    return metric?.label || metricId;
  };

  return (
    <div className="space-y-4">
      {/* Report Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-600 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1 text-sm">
            <div className="font-medium text-blue-900">Report Preview</div>
            <div className="text-blue-700 mt-1">
              Dimension: <span className="font-mono">{dimension}</span> • Date Range:{' '}
              <span className="font-mono">
                {dateRange.start} to {dateRange.end}
              </span>{' '}
              • Rows: <span className="font-mono">{campaigns.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Preview */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                  {dimension === 'campaign' ? 'Campaign' : dimension}
                </th>
                {selectedMetrics.map((metricId) => (
                  <th
                    key={metricId}
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {getColumnLabel(metricId)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.slice(0, 10).map((campaign, index) => (
                <tr
                  key={campaign.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">
                        {index + 1}.
                      </span>
                      {campaign.name}
                    </div>
                  </td>
                  {selectedMetrics.map((metricId) => (
                    <td
                      key={metricId}
                      className="px-4 py-3 text-sm text-right font-mono text-gray-900 whitespace-nowrap"
                    >
                      {getMetricValue(campaign, metricId)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {campaigns.length > 10 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-sm text-gray-500 text-center">
            Showing 10 of {campaigns.length} rows (full report will include all rows)
          </div>
        )}

        {campaigns.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No data to display
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-600">
          Ready to export {campaigns.length} rows with {selectedMetrics.length} metrics
        </div>
      </div>
    </div>
  );
}
