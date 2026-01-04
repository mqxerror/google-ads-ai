'use client';

import { QualityRecommendation } from '@/types/ad-generation';

interface RecommendationsPanelProps {
  recommendations: QualityRecommendation[];
  totalChecks?: number;
}

export default function RecommendationsPanel({ recommendations, totalChecks }: RecommendationsPanelProps) {
  const passCount = recommendations.filter((r) => r.status === 'pass').length;
  const total = totalChecks ?? recommendations.length;

  const getStatusIcon = (status: QualityRecommendation['status']) => {
    switch (status) {
      case 'pass':
        return (
          <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'warn':
        return (
          <svg className="w-4 h-4 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
          </svg>
        );
      case 'fail':
        return (
          <svg className="w-4 h-4 text-danger" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const getStatusColor = (status: QualityRecommendation['status']) => {
    switch (status) {
      case 'pass':
        return 'text-success';
      case 'warn':
        return 'text-text3';
      case 'fail':
        return 'text-danger';
    }
  };

  return (
    <div className="bg-surface2 border border-divider rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-text text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Recommendations
        </h4>
        <span className="text-xs text-text3">
          {passCount} of {total} completed
        </span>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="flex items-start gap-2 group cursor-default"
            title={rec.message}
          >
            <div className="flex-shrink-0 mt-0.5">{getStatusIcon(rec.status)}</div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${rec.status === 'pass' ? 'text-text' : getStatusColor(rec.status)}`}>
                {rec.label}
              </div>
              <div className="text-xs text-text3 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {rec.message}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-4 pt-3 border-t border-divider">
        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-success transition-all duration-300"
            style={{ width: `${(passCount / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
