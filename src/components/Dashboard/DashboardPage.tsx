'use client';

import { useCampaignsData } from '@/contexts/CampaignsDataContext';
import { useDashboard, WidgetSize } from '@/contexts/DashboardContext';
import { useAccount } from '@/contexts/AccountContext';
import WidgetCustomizer from './WidgetCustomizer';
import NarrativeStrip from './NarrativeStrip';
import DashboardPresets from './DashboardPresets';
import { WIDGET_COMPONENTS } from './widgets';

export default function DashboardPage() {
  const { currentAccount } = useAccount();
  const { campaigns, isLoading, error, dateRange, setDateRange } = useCampaignsData();
  const { widgets, isCustomizing } = useDashboard();

  // Sort widgets by order and filter visible ones
  const visibleWidgets = widgets
    .filter(w => w.visible)
    .sort((a, b) => a.order - b.order);

  // Get grid column class based on widget size
  const getSizeClass = (size: WidgetSize): string => {
    switch (size) {
      case 'small':
        return 'md:col-span-1';
      case 'medium':
        return 'md:col-span-1 lg:col-span-1';
      case 'large':
        return 'md:col-span-2';
      case 'full':
        return 'md:col-span-2';
      default:
        return 'md:col-span-1';
    }
  };

  // Handle date range change
  const handleDateRangeChange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
  };

  // Calculate current date range in days
  const getCurrentDays = () => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            {currentAccount ? (
              <>Overview for <span className="font-medium">{currentAccount.googleAccountId}</span></>
            ) : (
              'Select an account to view performance data'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardPresets />
          <select
            value={getCurrentDays()}
            onChange={(e) => handleDateRangeChange(Number(e.target.value))}
            className="px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <WidgetCustomizer />
        </div>
      </div>

      {/* AI Narrative Strip */}
      {currentAccount && campaigns.length > 0 && (
        <NarrativeStrip />
      )}

      {/* No Account Selected */}
      {!currentAccount && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No Account Selected</h3>
          <p className="mt-2 text-slate-500">
            Please select a Google Ads account from the sidebar to view your dashboard.
          </p>
        </div>
      )}

      {/* Error State */}
      {currentAccount && error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-rose-900">Error Loading Data</h3>
              <p className="text-rose-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {currentAccount && isLoading && !campaigns.length && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="mt-4 text-slate-500">Loading dashboard data...</p>
        </div>
      )}

      {/* Widget Customizer Panel */}
      {isCustomizing && (
        <div className="mb-6">
          <WidgetCustomizer />
        </div>
      )}

      {/* Dashboard Widgets */}
      {currentAccount && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleWidgets.map(widget => {
            const WidgetComponent = WIDGET_COMPONENTS[widget.type];
            if (!WidgetComponent) return null;

            return (
              <div key={widget.id} className={getSizeClass(widget.size)}>
                <WidgetComponent />
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State - No Campaigns */}
      {currentAccount && !isLoading && !error && campaigns.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No Campaigns Found</h3>
          <p className="mt-2 text-slate-500">
            This account doesn&apos;t have any campaigns in the selected date range.
          </p>
        </div>
      )}
    </div>
  );
}
