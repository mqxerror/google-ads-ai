'use client';

import { GeneratedKeyword } from '../types';
import TrendSparkline from './TrendSparkline';
import DataSourceBadge from './DataSourceBadge';

interface KeywordTableProps {
  keywords: GeneratedKeyword[];
  selectedKeywords: Set<string>;
  onToggleKeyword: (keyword: string) => void;
  onToggleAll: () => void;
  onKeywordDetail: (keyword: GeneratedKeyword) => void;
  showMetrics: boolean;
  targetLocation: string;
}

const TARGET_LOCATIONS = [
  { code: 'US', name: '🇺🇸 United States', geoCode: '2840' },
  { code: 'GB', name: '🇬🇧 United Kingdom', geoCode: '2826' },
  { code: 'CA', name: '🇨🇦 Canada', geoCode: '2124' },
  { code: 'AU', name: '🇦🇺 Australia', geoCode: '2036' },
  { code: 'DE', name: '🇩🇪 Germany', geoCode: '2276' },
  { code: 'FR', name: '🇫🇷 France', geoCode: '2250' },
  { code: 'ES', name: '🇪🇸 Spain', geoCode: '2724' },
  { code: 'IT', name: '🇮🇹 Italy', geoCode: '2380' },
  { code: 'PT', name: '🇵🇹 Portugal', geoCode: '2620' },
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  seed: { bg: 'bg-accent-light', text: 'text-accent' },
  variation: { bg: 'bg-blue-100', text: 'text-blue-600' },
  synonym: { bg: 'bg-purple-100', text: 'text-purple-600' },
  modifier: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  long_tail: { bg: 'bg-orange-100', text: 'text-orange-600' },
};

const INTENT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  transactional: { bg: 'bg-success-light', text: 'text-success', icon: '💰' },
  commercial: { bg: 'bg-warning-light', text: 'text-warning', icon: '🔍' },
  informational: { bg: 'bg-blue-100', text: 'text-blue-600', icon: '📚' },
  navigational: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🧭' },
};

const MATCH_TYPE_ICONS: Record<string, string> = {
  EXACT: '[exact]',
  PHRASE: '"phrase"',
  BROAD: '+broad',
};

export default function KeywordTable({
  keywords,
  selectedKeywords,
  onToggleKeyword,
  onToggleAll,
  onKeywordDetail,
  showMetrics,
  targetLocation,
}: KeywordTableProps) {
  const allSelected = selectedKeywords.size === keywords.length && keywords.length > 0;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-surface2">
              <th className="p-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded"
                />
              </th>
              <th className="p-3 text-left text-sm font-medium text-text2">Keyword</th>
              {showMetrics && (
                <>
                  <th className="p-3 text-right text-sm font-medium text-text2">
                    <div className="flex items-center justify-end gap-1">
                      Volume
                      <span className="px-1.5 py-0.5 text-[10px] bg-surface3 rounded font-normal normal-case">
                        {TARGET_LOCATIONS.find(l => l.code === targetLocation)?.code || 'US'}
                      </span>
                    </div>
                  </th>
                  <th className="p-3 text-center text-sm font-medium text-text2" title="12-month search volume trend">Trend</th>
                  <th className="p-3 text-right text-sm font-medium text-text2" title="3-month change">3M%</th>
                  <th className="p-3 text-right text-sm font-medium text-text2" title="Year-over-year change">YoY%</th>
                  <th className="p-3 text-right text-sm font-medium text-text2" title="Low bid estimate">Low Bid</th>
                  <th className="p-3 text-right text-sm font-medium text-text2" title="High bid estimate">High Bid</th>
                  <th className="p-3 text-center text-sm font-medium text-text2">Comp.</th>
                  <th className="p-3 text-right text-sm font-medium text-text2">Score</th>
                </>
              )}
              <th className="p-3 text-left text-sm font-medium text-text2">Type</th>
              <th className="p-3 text-left text-sm font-medium text-text2">Match Type</th>
              <th className="p-3 text-left text-sm font-medium text-text2">Intent</th>
              <th className="p-3 text-center text-sm font-medium text-text2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keywords.slice(0, 100).map((kw, i) => (
              <tr
                key={i}
                className={`border-t border-divider hover:bg-surface2 transition-colors cursor-pointer ${
                  selectedKeywords.has(kw.keyword) ? 'bg-accent-light/50' : ''
                }`}
                onClick={() => onToggleKeyword(kw.keyword)}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedKeywords.has(kw.keyword)}
                    onChange={() => onToggleKeyword(kw.keyword)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded"
                  />
                </td>
                <td className="p-3">
                  <div>
                    <span className="text-text font-medium">{kw.keyword}</span>
                    {(kw.metrics || kw.googleApisData) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {/* Data source badge */}
                        {kw.metrics && kw.metrics.dataSource !== 'unavailable' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-surface3 text-text3">
                            {kw.metrics.dataSource === 'cached' ? '💾 cached' :
                             kw.metrics.dataSource === 'google_ads' ? '🎯 google' :
                             kw.metrics.dataSource === 'moz' ? '📊 moz' : '📈 dataforseo'}
                          </span>
                        )}
                        {kw.metrics?.cacheAge && kw.metrics.cacheAge > 0 && (
                          <span className="text-xs text-text3">({kw.metrics.cacheAge}d old)</span>
                        )}

                        {/* Google Trends badge */}
                        {kw.googleApisData?.trends && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20" title={`Interest: ${kw.googleApisData.trends.interestScore}/100`}>
                            {kw.googleApisData.trends.direction === 'rising' ? '📈 Rising' :
                             kw.googleApisData.trends.direction === 'declining' ? '📉 Declining' :
                             kw.googleApisData.trends.direction === 'breakout' ? '🔥 Breakout' :
                             '➡️ Stable'}
                          </span>
                        )}

                        {/* YouTube content gap badge */}
                        {kw.googleApisData?.youtube?.contentGap && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20" title={`Video opportunity - Gap Score: ${kw.googleApisData.youtube.gapScore}`}>
                            🎥 Video Opp
                          </span>
                        )}

                        {/* NLP Intent badge */}
                        {kw.googleApisData?.nlp && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20" title={`Confidence: ${Math.round(kw.googleApisData.nlp.intentConfidence * 100)}%`}>
                            🧠 {kw.googleApisData.nlp.intent}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                {showMetrics && (
                  <>
                    <td className="p-3 text-right">
                      {kw.metrics?.searchVolume !== null && kw.metrics?.searchVolume !== undefined ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-text font-medium">
                            {kw.metrics.searchVolume.toLocaleString()}
                          </span>
                          <span className="text-xs opacity-60" title={kw.metrics.dataSource || 'unknown'}>
                            {kw.metrics.dataSource === 'cached' ? '💾' :
                             kw.metrics.dataSource === 'google_ads' ? '🎯' :
                             kw.metrics.dataSource === 'moz' ? '📊' : '📈'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text3 text-xs">—</span>
                      )}
                    </td>
                    {/* Trend Sparkline */}
                    <td className="p-3 text-center">
                      {kw.metrics?.monthlySearchVolumes && kw.metrics.monthlySearchVolumes.length > 0 ? (
                        <TrendSparkline data={kw.metrics.monthlySearchVolumes} width={60} height={20} />
                      ) : (
                        <span className="text-text3 text-xs">—</span>
                      )}
                    </td>
                    {/* 3-Month Change */}
                    <td className="p-3 text-right">
                      {kw.metrics?.threeMonthChange !== null && kw.metrics?.threeMonthChange !== undefined ? (
                        <span className={`text-sm font-medium ${
                          kw.metrics.threeMonthChange > 0 ? 'text-emerald-600' :
                          kw.metrics.threeMonthChange < 0 ? 'text-red-500' :
                          'text-text3'
                        }`}>
                          {kw.metrics.threeMonthChange > 0 ? '+' : ''}{kw.metrics.threeMonthChange.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-text3 text-xs">—</span>
                      )}
                    </td>
                    {/* Year-over-Year Change */}
                    <td className="p-3 text-right">
                      {kw.metrics?.yearOverYearChange !== null && kw.metrics?.yearOverYearChange !== undefined ? (
                        <span className={`text-sm font-medium ${
                          kw.metrics.yearOverYearChange > 0 ? 'text-emerald-600' :
                          kw.metrics.yearOverYearChange < 0 ? 'text-red-500' :
                          'text-text3'
                        }`}>
                          {kw.metrics.yearOverYearChange > 0 ? '+' : ''}{kw.metrics.yearOverYearChange.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-text3 text-xs">—</span>
                      )}
                    </td>
                    {/* Low Bid */}
                    <td className="p-3 text-right">
                      {kw.metrics?.lowBidMicros !== null && kw.metrics?.lowBidMicros !== undefined ? (
                        <span className="text-text text-sm">${(kw.metrics.lowBidMicros / 1000000).toFixed(2)}</span>
                      ) : (
                        <span className="text-text3 text-xs">—</span>
                      )}
                    </td>
                    {/* High Bid */}
                    <td className="p-3 text-right">
                      {kw.metrics?.highBidMicros !== null && kw.metrics?.highBidMicros !== undefined ? (
                        <span className="text-text text-sm">${(kw.metrics.highBidMicros / 1000000).toFixed(2)}</span>
                      ) : (
                        <span className="text-text3 text-xs">—</span>
                      )}
                    </td>
                    {/* Competition */}
                    <td className="p-3 text-center">
                      {kw.metrics?.competition ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          kw.metrics.competition === 'HIGH' ? 'bg-danger-light text-danger' :
                          kw.metrics.competition === 'MEDIUM' ? 'bg-warning-light text-warning' :
                          'bg-success-light text-success'
                        }`}>
                          {kw.metrics.competition[0]}
                        </span>
                      ) : (
                        <span className="text-text3 text-xs">—</span>
                      )}
                    </td>
                    {/* Opportunity Score */}
                    <td className="p-3 text-right">
                      {kw.opportunityScore !== undefined ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex-1 max-w-[80px] h-2 bg-surface3 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                kw.opportunityScore >= 75 ? 'bg-emerald-500' :
                                kw.opportunityScore >= 50 ? 'bg-yellow-500' :
                                'bg-orange-500'
                              }`}
                              style={{ width: `${kw.opportunityScore || 0}%` }}
                            />
                          </div>
                          <span className="text-text font-medium text-sm min-w-[2rem]">{kw.opportunityScore || 0}</span>
                        </div>
                      ) : (
                        <span className="text-text3 text-xs">—</span>
                      )}
                    </td>
                  </>
                )}
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${TYPE_COLORS[kw.type]?.bg || 'bg-gray-100'} ${TYPE_COLORS[kw.type]?.text || 'text-gray-600'}`}>
                    {kw.type}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-text3 text-sm font-mono">{MATCH_TYPE_ICONS[kw.suggestedMatchType]}</span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${INTENT_COLORS[kw.estimatedIntent]?.bg || 'bg-gray-100'} ${INTENT_COLORS[kw.estimatedIntent]?.text || 'text-gray-600'}`}>
                    {INTENT_COLORS[kw.estimatedIntent]?.icon || ''} {kw.estimatedIntent}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onKeywordDetail(kw);
                    }}
                    className="text-accent hover:text-accent-dark transition-colors text-lg"
                    title="View detailed insights"
                  >
                    🔍
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
