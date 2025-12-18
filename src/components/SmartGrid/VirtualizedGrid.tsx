'use client';

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { Campaign, SortConfig } from '@/types/campaign';
import GridRow from './GridRow';
import GridHeader from './GridHeader';
import { Recommendation } from '@/lib/recommendations';

export interface VirtualizedGridProps {
  /**
   * Array of campaigns to display
   */
  campaigns: Campaign[];
  /**
   * Set of selected campaign IDs
   */
  selectedIds: Set<string>;
  /**
   * Current sort configuration
   */
  sortConfig: SortConfig;
  /**
   * Handler for row selection
   */
  onSelect: (id: string) => void;
  /**
   * Handler for select all
   */
  onSelectAll: () => void;
  /**
   * Handler for sorting
   */
  onSort: (column: keyof Campaign) => void;
  /**
   * Handler for campaign click (drill-down)
   */
  onClick?: (campaign: Campaign) => void;
  /**
   * Handler for view details
   */
  onViewDetails?: (campaign: Campaign, e: React.MouseEvent) => void;
  /**
   * Handler for manage budget
   */
  onManageBudget?: (campaign: Campaign, e: React.MouseEvent) => void;
  /**
   * Handler for campaign updates
   */
  onUpdateCampaign?: (id: string, updates: Partial<Campaign>) => void;
  /**
   * Handler for recommendation actions
   */
  onRecommendationAction?: (recommendation: Recommendation, campaign: Campaign) => void;
  /**
   * Height of each row in pixels
   */
  rowHeight?: number;
  /**
   * Total height of the grid container
   */
  height?: number;
  /**
   * Number of extra rows to render outside viewport (overscan)
   */
  overscanCount?: number;
}

/**
 * Custom virtualized grid component for efficiently rendering large lists of campaigns
 * Uses custom virtualization logic to only render visible rows plus a buffer
 * Handles 1000+ campaigns smoothly with minimal performance impact
 */
export default function VirtualizedGrid({
  campaigns,
  selectedIds,
  sortConfig,
  onSelect,
  onSelectAll,
  onSort,
  onClick,
  onViewDetails,
  onManageBudget,
  onUpdateCampaign,
  onRecommendationAction,
  rowHeight = 73,
  height = 600,
  overscanCount = 5,
}: VirtualizedGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(height);

  // Auto-calculate container height based on available space
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const availableHeight = viewportHeight - rect.top - 100; // 100px buffer for footer
        setContainerHeight(Math.max(400, Math.min(availableHeight, 800)));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Calculate visible range
  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanCount);
    const endIdx = Math.min(
      campaigns.length - 1,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + overscanCount
    );
    const offset = startIdx * rowHeight;
    return { startIndex: startIdx, endIndex: endIdx, offsetY: offset };
  }, [scrollTop, containerHeight, rowHeight, campaigns.length, overscanCount]);

  // Get visible campaigns
  const visibleCampaigns = useMemo(() => {
    return campaigns.slice(startIndex, endIndex + 1);
  }, [campaigns, startIndex, endIndex]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Scroll to top when campaigns change (e.g., after filtering/sorting)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [campaigns]);

  // Calculate if all visible items are selected
  const allSelected = useMemo(() => {
    return campaigns.length > 0 && campaigns.every((c) => selectedIds.has(c.id));
  }, [campaigns, selectedIds]);

  // Total height of all rows
  const totalHeight = campaigns.length * rowHeight;

  return (
    <div className="overflow-hidden">
      {/* Fixed header */}
      <table className="w-full min-w-[900px]">
        <GridHeader
          sortConfig={sortConfig}
          onSort={onSort}
          allSelected={allSelected}
          onSelectAll={onSelectAll}
        />
      </table>

      {/* Scrollable content area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto border-t border-gray-200 scrollbar-thin"
        style={{
          height: `${containerHeight}px`,
          position: 'relative',
        }}
      >
        {/* Total height spacer */}
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {/* Visible rows container */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${offsetY}px)`,
            }}
          >
            <table className="w-full min-w-[900px]">
              <tbody className="divide-y divide-gray-200">
                {visibleCampaigns.map((campaign) => (
                  <GridRow
                    key={campaign.id}
                    campaign={campaign}
                    isSelected={selectedIds.has(campaign.id)}
                    onSelect={() => onSelect(campaign.id)}
                    onClick={onClick ? () => onClick(campaign) : undefined}
                    onViewDetails={
                      onViewDetails
                        ? (e: React.MouseEvent) => onViewDetails(campaign, e)
                        : undefined
                    }
                    onManageBudget={
                      onManageBudget
                        ? (e: React.MouseEvent) => onManageBudget(campaign, e)
                        : undefined
                    }
                    onUpdateCampaign={onUpdateCampaign}
                    onRecommendationAction={onRecommendationAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance metrics - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
          Rendering {visibleCampaigns.length} of {campaigns.length} rows (indices {startIndex}-{endIndex})
        </div>
      )}
    </div>
  );
}

/**
 * Hook to detect if virtualization should be enabled
 * Virtualization is beneficial for lists with 50+ items
 */
export function useVirtualization(itemCount: number, threshold = 50): boolean {
  return itemCount >= threshold;
}

/**
 * Calculate optimal row height based on content and mode
 */
export function calculateRowHeight(hasRecommendations: boolean, isProMode: boolean): number {
  let height = 60; // Base height
  if (hasRecommendations) height += 20; // Add space for recommendations
  if (isProMode) height += 0; // Pro mode uses same columns, just more of them
  return height;
}

/**
 * Memoized wrapper for VirtualizedGrid to prevent unnecessary re-renders
 * Use this when the grid is part of a larger component that re-renders frequently
 */
export const MemoizedVirtualizedGrid = React.memo(
  VirtualizedGrid,
  (prevProps, nextProps) => {
    // Custom comparison for better performance
    return (
      prevProps.campaigns === nextProps.campaigns &&
      prevProps.selectedIds === nextProps.selectedIds &&
      prevProps.sortConfig === nextProps.sortConfig &&
      prevProps.rowHeight === nextProps.rowHeight &&
      prevProps.height === nextProps.height
    );
  }
);

MemoizedVirtualizedGrid.displayName = 'MemoizedVirtualizedGrid';
