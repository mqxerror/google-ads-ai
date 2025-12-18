'use client';

import { useState } from 'react';
import { Campaign } from '@/types/campaign';
import { generateRecommendations, Recommendation, getImpactColor } from '@/lib/recommendations';

interface RecommendationsPanelProps {
  campaign: Campaign;
  onAction?: (recommendation: Recommendation, campaign: Campaign) => void;
  compact?: boolean;
}

export default function RecommendationsPanel({ campaign, onAction, compact = false }: RecommendationsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const recommendations = generateRecommendations(campaign);

  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium text-green-800">No issues detected</span>
        </div>
        <p className="mt-1 text-sm text-green-700">This campaign is performing well based on current metrics.</p>
      </div>
    );
  }

  if (compact) {
    // Compact view for grid row
    const topRec = recommendations[0];
    return (
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getImpactColor(topRec.impact)}`}>
          {topRec.impact}
        </span>
        <span className="text-sm text-gray-700 line-clamp-1">{topRec.issue}</span>
        {onAction && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction(topRec, campaign);
            }}
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Fix
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Recommendations ({recommendations.length})
        </h3>
        <span className="text-xs text-gray-500">Priority sorted</span>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
          >
            <button
              onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
              className="w-full px-4 py-3 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getImpactColor(rec.impact)}`}>
                      {rec.impact}
                    </span>
                    <span className="font-medium text-gray-900">{rec.issue}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{rec.impactEstimate}</p>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${expandedId === rec.id ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expandedId === rec.id && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-sm text-gray-600">{rec.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <ActionIcon type={rec.actionType} />
                    <span>Suggested action</span>
                  </div>
                  {onAction && (
                    <button
                      onClick={() => onAction(rec, campaign)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        rec.actionType === 'pause'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : rec.actionType === 'enable'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {rec.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionIcon({ type }: { type: Recommendation['actionType'] }) {
  switch (type) {
    case 'pause':
      return (
        <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'enable':
      return (
        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'adjust_bid':
      return (
        <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
  }
}
