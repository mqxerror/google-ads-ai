'use client';

import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';

interface DailyMetrics {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpa: number;
}

type DateRange = '7d' | '14d' | '30d' | '90d';
type ChartMetric = 'spend' | 'clicks' | 'conversions' | 'ctr';

export default function ReportsPageContent() {
  const { currentAccount } = useAccount();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('spend');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DailyMetrics[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!currentAccount?.id) return;

    const fetchMetrics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const days = parseInt(dateRange.replace('d', ''));
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);

        const response = await fetch(
          `/api/google-ads/reports?accountId=${currentAccount.id}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch report data');
        }

        const data = await response.json();
        setMetrics(data.metrics || []);
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load report data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [currentAccount?.id, dateRange]);

  const handleExportCSV = () => {
    if (metrics.length === 0) return;

    const headers = ['Date', 'Spend', 'Clicks', 'Impressions', 'Conversions', 'CTR', 'CPA'];
    const rows = metrics.map(m => [
      m.date,
      m.spend.toFixed(2),
      m.clicks.toString(),
      m.impressions.toString(),
      m.conversions.toFixed(1),
      (m.ctr * 100).toFixed(2) + '%',
      m.cpa > 0 ? '$' + m.cpa.toFixed(2) : '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `google-ads-report-${currentAccount?.accountName || 'export'}-${dateRange}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Please allow popups to export PDF');
      }

      const totals = metrics.reduce(
        (acc, m) => ({
          spend: acc.spend + m.spend,
          clicks: acc.clicks + m.clicks,
          impressions: acc.impressions + m.impressions,
          conversions: acc.conversions + m.conversions,
        }),
        { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
      );

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Ads Report - ${currentAccount?.accountName || 'Account'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; }
            h1 { color: #1a73e8; margin-bottom: 8px; }
            .subtitle { color: #666; margin-bottom: 24px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
            .summary-card { background: #f8f9fa; padding: 16px; border-radius: 8px; }
            .summary-card label { font-size: 12px; color: #666; text-transform: uppercase; }
            .summary-card .value { font-size: 24px; font-weight: 600; color: #202124; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
            th { background: #f8f9fa; font-weight: 600; font-size: 12px; text-transform: uppercase; }
            td { font-size: 14px; }
            .text-right { text-align: right; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>Google Ads Performance Report</h1>
          <p class="subtitle">${currentAccount?.accountName || 'Account'} | ${dateRange} | Generated ${new Date().toLocaleDateString()}</p>

          <div class="summary">
            <div class="summary-card">
              <label>Total Spend</label>
              <div class="value">$${totals.spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="summary-card">
              <label>Total Clicks</label>
              <div class="value">${totals.clicks.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <label>Total Impressions</label>
              <div class="value">${totals.impressions.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <label>Total Conversions</label>
              <div class="value">${totals.conversions.toFixed(1)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th class="text-right">Spend</th>
                <th class="text-right">Clicks</th>
                <th class="text-right">Impressions</th>
                <th class="text-right">Conversions</th>
                <th class="text-right">CTR</th>
                <th class="text-right">CPA</th>
              </tr>
            </thead>
            <tbody>
              ${metrics.map(m => `
                <tr>
                  <td>${m.date}</td>
                  <td class="text-right">$${m.spend.toFixed(2)}</td>
                  <td class="text-right">${m.clicks.toLocaleString()}</td>
                  <td class="text-right">${m.impressions.toLocaleString()}</td>
                  <td class="text-right">${m.conversions.toFixed(1)}</td>
                  <td class="text-right">${(m.ctr * 100).toFixed(2)}%</td>
                  <td class="text-right">${m.cpa > 0 ? '$' + m.cpa.toFixed(2) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const totals = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      clicks: acc.clicks + m.clicks,
      impressions: acc.impressions + m.impressions,
      conversions: acc.conversions + m.conversions,
    }),
    { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
  );

  const chartData = metrics.map(m => {
    switch (chartMetric) {
      case 'spend': return m.spend;
      case 'clicks': return m.clicks;
      case 'conversions': return m.conversions;
      case 'ctr': return m.ctr * 100;
      default: return m.spend;
    }
  });
  const maxValue = Math.max(...chartData, 1);

  const formatChartValue = (value: number) => {
    switch (chartMetric) {
      case 'spend': return `$${value.toFixed(0)}`;
      case 'ctr': return `${value.toFixed(1)}%`;
      default: return value.toFixed(0);
    }
  };

  if (!currentAccount) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No account selected</h3>
          <p className="mt-1 text-sm text-gray-500">Select a Google Ads account to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Reports</h1>
          <p className="mt-1 text-sm text-gray-500">{currentAccount.accountName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex rounded-lg border border-gray-300 p-1">
            {(['7d', '14d', '30d', '90d'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          {/* Export Buttons */}
          <button
            onClick={handleExportCSV}
            disabled={metrics.length === 0 || isLoading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={metrics.length === 0 || isLoading || isExporting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {isExporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-5">
              <div className="text-xs font-medium uppercase text-blue-600">Total Spend</div>
              <div className="mt-2 text-3xl font-bold text-blue-900">
                ${totals.spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-xl bg-green-50 p-5">
              <div className="text-xs font-medium uppercase text-green-600">Total Clicks</div>
              <div className="mt-2 text-3xl font-bold text-green-900">
                {totals.clicks.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-purple-50 p-5">
              <div className="text-xs font-medium uppercase text-purple-600">Total Impressions</div>
              <div className="mt-2 text-3xl font-bold text-purple-900">
                {totals.impressions.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-orange-50 p-5">
              <div className="text-xs font-medium uppercase text-orange-600">Conversions</div>
              <div className="mt-2 text-3xl font-bold text-orange-900">
                {totals.conversions.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Performance Trend</h2>
              <div className="flex rounded-lg border border-gray-300 p-1">
                {(['spend', 'clicks', 'conversions', 'ctr'] as ChartMetric[]).map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setChartMetric(metric)}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      chartMetric === metric
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {metric === 'ctr' ? 'CTR' : metric.charAt(0).toUpperCase() + metric.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Simple Bar Chart */}
            <div className="h-64 flex items-end gap-1">
              {metrics.map((m, i) => {
                const value = chartData[i];
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                return (
                  <div
                    key={m.date}
                    className="group relative flex-1 flex flex-col items-center"
                  >
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                      <div className="rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap">
                        {m.date}: {formatChartValue(value)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              {metrics.length > 0 && (
                <>
                  <span>{metrics[0]?.date}</span>
                  <span>{metrics[metrics.length - 1]?.date}</span>
                </>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Daily Breakdown</h2>
              <p className="text-sm text-gray-500">{metrics.length} days of data</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-600">Spend</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-600">Clicks</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-600">Impressions</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-600">Conv.</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-600">CTR</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-600">CPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {metrics.map((m) => (
                    <tr key={m.date} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900">{m.date}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 text-right">${m.spend.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 text-right">{m.clicks.toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 text-right">{m.impressions.toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 text-right">{m.conversions.toFixed(1)}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 text-right">{(m.ctr * 100).toFixed(2)}%</td>
                      <td className="px-6 py-3 text-sm text-gray-900 text-right">
                        {m.cpa > 0 ? `$${m.cpa.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
