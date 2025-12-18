'use client';

export default function EmptyState() {
  return (
    <div className="px-4 py-16 text-center">
      <div className="flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">No Campaigns Found</h3>
        <p className="mb-4 max-w-sm text-sm text-gray-500">
          No campaigns match your current filters. Try adjusting your filters or connect a Google Ads account to see your campaigns.
        </p>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Clear Filters
        </button>
      </div>
    </div>
  );
}
