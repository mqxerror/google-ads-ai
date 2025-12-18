'use client';

import { Skeleton, SkeletonTableRow } from '@/components/ui/Skeleton';

export interface GridSkeletonProps {
  /**
   * Number of rows to display in skeleton
   */
  rows?: number;
  /**
   * Number of columns per row
   */
  columns?: number;
  /**
   * Animation type for skeleton elements
   */
  animation?: 'pulse' | 'wave' | 'none';
  /**
   * Variant to display (table or card view)
   */
  variant?: 'table' | 'card';
}

/**
 * Enhanced skeleton component for grid loading states
 * Features pulse and shimmer animations for better UX
 */
export default function GridSkeleton({
  rows = 8,
  columns = 10,
  animation = 'wave',
  variant = 'table',
}: GridSkeletonProps = {}) {
  if (variant === 'card') {
    return <CardViewSkeleton rows={rows} animation={animation} />;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Toolbar skeleton */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-4">
        <Skeleton width={128} height={40} variant="rounded" animation={animation} />
        <Skeleton width={144} height={40} variant="rounded" animation={animation} />
        <Skeleton width={96} height={40} variant="rounded" animation={animation} />
        <div className="flex-1 max-w-md">
          <Skeleton width="100%" height={40} variant="rounded" animation={animation} />
        </div>
        <Skeleton width={112} height={40} variant="rounded" animation={animation} />
        <Skeleton width={96} height={40} variant="rounded" animation={animation} />
      </div>

      {/* View tabs skeleton */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width={96} height={32} variant="rounded" animation={animation} />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-10 px-4 py-3">
                <Skeleton width={16} height={16} variant="rectangular" animation={animation} />
              </th>
              {Array.from({ length: columns - 1 }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton
                    width={i === 0 ? 120 : i === 1 ? 80 : i === 2 ? 64 : 80}
                    height={16}
                    variant="text"
                    animation={animation}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <Skeleton width={16} height={16} variant="rectangular" animation={animation} />
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    <Skeleton width="75%" height={16} variant="text" animation={animation} />
                    <Skeleton width="90%" height={12} variant="text" animation={animation} className="opacity-60" />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Skeleton width={64} height={24} variant="rounded" animation={animation} />
                </td>
                <td className="px-4 py-4">
                  <Skeleton width={72} height={24} variant="rounded" animation={animation} />
                </td>
                {Array.from({ length: columns - 4 }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-4">
                    <div className="flex justify-end">
                      <Skeleton
                        width={colIndex % 2 === 0 ? 64 : 48}
                        height={16}
                        variant="text"
                        animation={animation}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <Skeleton width={112} height={32} variant="rounded" animation={animation} />
          <Skeleton width={80} height={16} variant="text" animation={animation} />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton width={128} height={16} variant="text" animation={animation} />
          <Skeleton width={96} height={16} variant="text" animation={animation} />
        </div>
      </div>
    </div>
  );
}

/**
 * Card view skeleton for mobile/responsive layouts
 */
function CardViewSkeleton({
  rows = 6,
  animation = 'wave',
}: {
  rows: number;
  animation: 'pulse' | 'wave' | 'none';
}) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          {/* Card header */}
          <div className="mb-3 flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton width="60%" height={20} variant="text" animation={animation} />
              <Skeleton width="40%" height={16} variant="text" animation={animation} />
            </div>
            <Skeleton width={16} height={16} variant="rectangular" animation={animation} />
          </div>

          {/* Card badges */}
          <div className="mb-3 flex gap-2">
            <Skeleton width={64} height={24} variant="rounded" animation={animation} />
            <Skeleton width={72} height={24} variant="rounded" animation={animation} />
          </div>

          {/* Card metrics */}
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Skeleton width="100%" height={12} variant="text" animation={animation} />
              <Skeleton width="80%" height={20} variant="text" animation={animation} />
            </div>
            <div className="space-y-1">
              <Skeleton width="100%" height={12} variant="text" animation={animation} />
              <Skeleton width="60%" height={20} variant="text" animation={animation} />
            </div>
            <div className="space-y-1">
              <Skeleton width="100%" height={12} variant="text" animation={animation} />
              <Skeleton width="70%" height={20} variant="text" animation={animation} />
            </div>
          </div>

          {/* Card actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <Skeleton width={80} height={32} variant="rounded" animation={animation} />
            <Skeleton width={80} height={32} variant="rounded" animation={animation} />
          </div>
        </div>
      ))}
    </div>
  );
}
