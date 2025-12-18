'use client';

import { useState, useEffect, useCallback } from 'react';
import { Keyword } from '@/types/campaign';
import { useAccount } from '@/contexts/AccountContext';
import { useDrillDown } from '@/contexts/DrillDownContext';
import { useDetailPanel } from '@/contexts/DetailPanelContext';
import GridSkeleton from './GridSkeleton';
import { KeywordEditor } from '@/components/KeywordEditor';

function StatusBadge({ status }: { status: string }) {
  const colors = {
    ENABLED: 'bg-green-100 text-green-800',
    PAUSED: 'bg-yellow-100 text-yellow-800',
    REMOVED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function MatchTypeBadge({ matchType }: { matchType: string }) {
  const colors = {
    EXACT: 'bg-purple-100 text-purple-800',
    PHRASE: 'bg-blue-100 text-blue-800',
    BROAD: 'bg-gray-100 text-gray-800',
  };
  const labels = {
    EXACT: '[exact]',
    PHRASE: '"phrase"',
    BROAD: 'broad',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono ${colors[matchType as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {labels[matchType as keyof typeof labels] || matchType}
    </span>
  );
}

function QualityScoreBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 7) return 'bg-green-500';
    if (s >= 5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${getColor(score)}`}
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-900">{score}/10</span>
    </div>
  );
}

export default function KeywordsGrid() {
  const { currentAccount } = useAccount();
  const { selectedAdGroup } = useDrillDown();
  const { openPanel } = useDetailPanel();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isKeywordEditorOpen, setIsKeywordEditorOpen] = useState(false);

  const loadKeywords = useCallback(async () => {
    if (!currentAccount?.id || !selectedAdGroup?.id) {
      setKeywords([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(
        `/api/google-ads/keywords?accountId=${currentAccount.id}&adGroupId=${selectedAdGroup.id}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch keywords');
      }

      const data = await response.json();
      setKeywords(data.keywords || []);
    } catch (err) {
      console.error('Error fetching keywords:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch keywords');
      setKeywords([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentAccount?.id, selectedAdGroup?.id]);

  useEffect(() => {
    loadKeywords();
  }, [loadKeywords]);

  if (isLoading) {
    return <GridSkeleton />;
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <>
        <div className="px-4 py-16 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No Keywords Found</h3>
            <p className="max-w-sm text-sm text-gray-500 mb-4">
              This ad group doesn&apos;t have any keywords yet.
            </p>
            <button
              onClick={() => setIsKeywordEditorOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add Keywords
            </button>
          </div>
        </div>
        <KeywordEditor
          isOpen={isKeywordEditorOpen}
          onClose={() => setIsKeywordEditorOpen(false)}
          onKeywordsAdded={loadKeywords}
        />
      </>
    );
  }

  return (
    <>
      {/* Header with Add Keywords button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => setIsKeywordEditorOpen(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Keywords
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Keyword
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Match Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                Quality Score
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Clicks
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Conversions
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Spend
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                CPA
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {keywords.map((keyword) => (
              <tr key={keyword.id} className="group hover:bg-blue-50 cursor-pointer" onClick={() => openPanel(keyword, 'keyword')}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{keyword.text}</div>
                  <div className="text-xs text-gray-500">ID: {keyword.id}</div>
                </td>
                <td className="px-4 py-3">
                  <MatchTypeBadge matchType={keyword.matchType} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={keyword.status} />
                </td>
                <td className="px-4 py-3">
                  {keyword.qualityScore > 0 ? (
                    <QualityScoreBar score={keyword.qualityScore} />
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {keyword.clicks.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {keyword.conversions.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  ${keyword.spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {keyword.cpa > 0 ? `$${keyword.cpa.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPanel(keyword, 'keyword');
                    }}
                    className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Keyword Editor Modal */}
      <KeywordEditor
        isOpen={isKeywordEditorOpen}
        onClose={() => setIsKeywordEditorOpen(false)}
        onKeywordsAdded={loadKeywords}
      />
    </>
  );
}
