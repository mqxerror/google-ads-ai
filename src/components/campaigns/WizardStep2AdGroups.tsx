'use client';

import { useState, useEffect } from 'react';
import { GeneratedKeyword } from '@/app/keyword-factory/types';

interface AdGroup {
  id: string;
  name: string;
  keywords: GeneratedKeyword[];
  avgCpc: number;
  totalVolume: number;
}

interface WizardStep2Props {
  data: any;
  onUpdate: (updates: any) => void;
  setIsProcessing: (processing: boolean) => void;
}

export default function WizardStep2AdGroups({ data, onUpdate, setIsProcessing }: WizardStep2Props) {
  const [adGroups, setAdGroups] = useState<AdGroup[]>(data.adGroups || []);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate clusters on first load if no ad groups exist
  useEffect(() => {
    const keywords = data.preSelectedKeywords || data.manualKeywords || [];
    if (adGroups.length === 0 && keywords.length > 0 && !isGenerating) {
      handleGenerateClusters();
    }
  }, []);

  const handleGenerateClusters = async () => {
    // Use manual keywords if no pre-selected keywords
    const keywords = data.preSelectedKeywords || data.manualKeywords || [];

    if (keywords.length === 0) {
      setError('No keywords found. Please go back to Step 1 and add keywords.');
      return;
    }

    setIsGenerating(true);
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/campaigns/wizard/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          minClusterSize: 3,
          maxClusters: 7,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate ad groups');
      }

      const { adGroups: generatedAdGroups } = await response.json();

      // Calculate metrics for each ad group
      const adGroupsWithMetrics = generatedAdGroups.map((group: any, index: number) => {
        const avgCpc = group.keywords.reduce((sum: number, kw: GeneratedKeyword) => sum + (kw.metrics?.cpc || 0), 0) / group.keywords.length;
        const totalVolume = group.keywords.reduce((sum: number, kw: GeneratedKeyword) => sum + (kw.metrics?.searchVolume || 0), 0);

        return {
          id: `ag-${Date.now()}-${index}`,
          name: group.name || `Ad Group ${index + 1}`,
          keywords: group.keywords,
          avgCpc,
          totalVolume,
        };
      });

      setAdGroups(adGroupsWithMetrics);
      onUpdate({ adGroups: adGroupsWithMetrics });

      // Auto-expand first group
      if (adGroupsWithMetrics.length > 0) {
        setExpandedGroups(new Set([adGroupsWithMetrics[0].id]));
      }
    } catch (err) {
      console.error('Error generating clusters:', err);
      setError('Failed to generate ad groups. Please try again.');
    } finally {
      setIsGenerating(false);
      setIsProcessing(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const updateAdGroupName = (groupId: string, newName: string) => {
    const updatedGroups = adGroups.map((group) =>
      group.id === groupId ? { ...group, name: newName } : group
    );
    setAdGroups(updatedGroups);
    onUpdate({ adGroups: updatedGroups });
  };

  const removeKeywordFromGroup = (groupId: string, keywordToRemove: string) => {
    const updatedGroups = adGroups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            keywords: group.keywords.filter((kw) => kw.keyword !== keywordToRemove),
          }
        : group
    );
    setAdGroups(updatedGroups);
    onUpdate({ adGroups: updatedGroups });
  };

  if (isGenerating) {
    const keywords = data.preSelectedKeywords || data.manualKeywords || [];
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full mb-4" />
        <h3 className="text-lg font-medium text-text mb-2">Generating ad groups...</h3>
        <p className="text-sm text-text3">
          Using AI to cluster {keywords.length} keywords by semantic similarity
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-lg p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="text-lg font-medium text-danger mb-2">Error</h3>
        <p className="text-sm text-text3 mb-4">{error}</p>
        <button
          onClick={handleGenerateClusters}
          className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (adGroups.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🎯</div>
        <h3 className="text-lg font-medium text-text mb-2">No ad groups yet</h3>
        <p className="text-sm text-text3 mb-6">
          Generate ad groups by clustering keywords with semantic similarity
        </p>
        <button
          onClick={handleGenerateClusters}
          className="px-8 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
        >
          Generate Ad Groups
        </button>
      </div>
    );
  }

  const keywords = data.preSelectedKeywords || data.manualKeywords || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text">Ad Groups</h3>
          <p className="text-sm text-text3 mt-1">
            {adGroups.length} groups created from {keywords.length} keywords
          </p>
        </div>
        <button
          onClick={handleGenerateClusters}
          className="px-4 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text hover:bg-surface transition-colors"
        >
          ↻ Regenerate
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface2 rounded-lg p-4 border border-divider">
          <div className="text-xs text-text3 mb-1">Total Keywords</div>
          <div className="text-2xl font-bold text-text">
            {adGroups.reduce((sum, group) => sum + group.keywords.length, 0)}
          </div>
        </div>
        <div className="bg-surface2 rounded-lg p-4 border border-divider">
          <div className="text-xs text-text3 mb-1">Avg CPC</div>
          <div className="text-2xl font-bold text-text">
            ${(adGroups.reduce((sum, group) => sum + group.avgCpc, 0) / adGroups.length).toFixed(2)}
          </div>
        </div>
        <div className="bg-surface2 rounded-lg p-4 border border-divider">
          <div className="text-xs text-text3 mb-1">Total Volume</div>
          <div className="text-2xl font-bold text-text">
            {(adGroups.reduce((sum, group) => sum + group.totalVolume, 0) / 1000).toFixed(1)}K
          </div>
        </div>
      </div>

      {/* Ad Groups List */}
      <div className="space-y-3">
        {adGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div
              key={group.id}
              className="bg-surface2 border border-divider rounded-lg overflow-hidden transition-all"
            >
              {/* Group Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface transition-colors"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateAdGroupName(group.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-text bg-transparent border-b border-transparent hover:border-accent focus:border-accent focus:outline-none transition-colors"
                    />
                    <div className="text-xs text-text3 mt-1">
                      {group.keywords.length} keywords · Avg CPC: ${group.avgCpc.toFixed(2)} · Volume:{' '}
                      {(group.totalVolume / 1000).toFixed(1)}K
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full">
                    {group.keywords.length} kw
                  </span>
                </div>
              </div>

              {/* Expanded Keywords */}
              {isExpanded && (
                <div className="border-t border-divider bg-surface p-4">
                  <div className="space-y-2">
                    {group.keywords.map((kw, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 bg-surface2 rounded border border-divider hover:border-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-sm text-text">{kw.keyword}</span>
                          {kw.metrics && (
                            <div className="flex items-center gap-3 text-xs text-text3">
                              <span>Vol: {(kw.metrics.searchVolume / 1000).toFixed(1)}K</span>
                              <span>CPC: ${kw.metrics.cpc.toFixed(2)}</span>
                              <span>Comp: {(kw.metrics.competition * 100).toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeKeywordFromGroup(group.id, kw.keyword)}
                          className="text-text3 hover:text-danger transition-colors text-xs px-2 py-1"
                          title="Remove keyword"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <h4 className="font-medium text-text text-sm mb-1">Ad Group Tips</h4>
            <ul className="text-xs text-text3 space-y-1">
              <li>• Each ad group should contain tightly related keywords</li>
              <li>• Ad copy in Step 3 will be generated for each group</li>
              <li>• You can edit group names and remove keywords</li>
              <li>• Regenerate if clusters don't look right</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
