'use client';

import { useState } from 'react';
import type { CSVParseResult } from '@/lib/csv-utils';

interface CSVPreviewProps {
  data: CSVParseResult;
  maxRows?: number;
}

export default function CSVPreview({ data, maxRows = 10 }: CSVPreviewProps) {
  const [showAll, setShowAll] = useState(false);

  const displayRows = showAll ? data.rows : data.rows.slice(0, maxRows);
  const hasMore = data.rows.length > maxRows;

  if (data.rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500">No data to preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">
          CSV Preview ({data.rows.length} row{data.rows.length !== 1 ? 's' : ''})
        </h4>
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Show all rows
          </button>
        )}
        {showAll && (
          <button
            onClick={() => setShowAll(false)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Show less
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  #
                </th>
                {data.headers.map((header, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                    {rowIndex + 1}
                  </td>
                  {data.headers.map((header, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate"
                      title={row[header] || ''}
                    >
                      {row[header] || (
                        <span className="text-gray-400 italic">empty</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMore && !showAll && (
          <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Showing {maxRows} of {data.rows.length} rows
            </p>
          </div>
        )}
      </div>

      {data.errors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-3">
          <h5 className="text-sm font-medium text-red-800 mb-1">
            Parse Errors ({data.errors.length})
          </h5>
          <ul className="text-xs text-red-700 space-y-1">
            {data.errors.slice(0, 5).map((error, i) => (
              <li key={i}>{error}</li>
            ))}
            {data.errors.length > 5 && (
              <li className="text-red-600">
                ...and {data.errors.length - 5} more errors
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Summary Stats */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {data.headers.length}
            </div>
            <div className="text-xs text-gray-500">Columns</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {data.rows.length}
            </div>
            <div className="text-xs text-gray-500">Rows</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {data.errors.length}
            </div>
            <div className="text-xs text-gray-500">Errors</div>
          </div>
        </div>
      </div>
    </div>
  );
}
