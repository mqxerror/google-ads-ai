'use client';

import { useKeywordFactoryStore } from '../store/useKeywordFactoryStore';

export default function GenerationStatsPanel() {
  const { stats, negativeKeywords } = useKeywordFactoryStore();

  if (!stats) return null;

  return (
    <>
      {/* Stats Card */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-text mb-3">Generation Stats</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-surface2 rounded-lg text-center">
            <p className="text-2xl font-bold text-text">{stats.totalGenerated}</p>
            <p className="text-xs text-text3">Total Keywords</p>
          </div>
          <div className="p-3 bg-surface2 rounded-lg text-center">
            <p className="text-2xl font-bold text-text">{stats.clusters}</p>
            <p className="text-xs text-text3">Clusters</p>
          </div>
          <div className="p-3 bg-success-light rounded-lg text-center">
            <p className="text-2xl font-bold text-success">{stats.byIntent.transactional || 0}</p>
            <p className="text-xs text-text3">Transactional</p>
          </div>
          <div className="p-3 bg-warning-light rounded-lg text-center">
            <p className="text-2xl font-bold text-warning">{stats.byIntent.commercial || 0}</p>
            <p className="text-xs text-text3">Commercial</p>
          </div>
        </div>

        {/* Enrichment Stats */}
        {stats.enrichment && (
          <div className="mt-4 pt-4 border-t border-divider">
            <h4 className="text-xs font-medium text-text mb-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              Enrichment Stats
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text3">Enriched:</span>
                <span className="font-medium text-text">{stats.enrichment.enriched} keywords</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text3">From cache:</span>
                <span className="font-medium text-emerald-600">{stats.enrichment.cached}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text3">Google Ads:</span>
                <span className="font-medium text-text">{stats.enrichment.googleFetched}</span>
              </div>
              {stats.enrichment.mozFetched > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text3">Moz:</span>
                  <span className="font-medium text-text">{stats.enrichment.mozFetched}</span>
                </div>
              )}
              {stats.enrichment.dataForSeoFetched > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text3">DataForSEO:</span>
                  <span className="font-medium text-text">{stats.enrichment.dataForSeoFetched}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-divider">
                <span className="text-text3">Est. Cost:</span>
                <span className="font-semibold text-accent">
                  ${stats.enrichment.estimatedCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Negative Suggestions */}
      {negativeKeywords.length > 0 && (
        <div className="card p-4 border-danger/20 bg-danger-light/30">
          <h3 className="text-sm font-medium text-danger mb-3">Suggested Negatives</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {negativeKeywords.slice(0, 10).map((kw, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-text">{kw.keyword}</span>
                <span
                  className="text-xs text-text3 truncate max-w-[150px]"
                  title={kw.negativeReason}
                >
                  {kw.negativeReason?.split(' - ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card p-4 bg-accent-light border-accent/20">
        <h3 className="text-sm font-medium text-accent mb-2">Tips</h3>
        <ul className="text-xs text-text2 space-y-1">
          <li>Start with 3-5 broad seed keywords</li>
          <li>Use transactional keywords for conversion</li>
          <li>Group by clusters for better ad groups</li>
          <li>Export and import to Google Ads Editor</li>
        </ul>
      </div>
    </>
  );
}
