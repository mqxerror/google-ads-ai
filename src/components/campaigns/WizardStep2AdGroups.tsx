'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [prePopulated, setPrePopulated] = useState(false);

  // Clustering controls
  const [clusterMethod, setClusterMethod] = useState<'meaning' | 'similarity'>('similarity');
  const [sensitivity, setSensitivity] = useState(0.2);
  const [maxClusters, setMaxClusters] = useState(7);
  const [showClusterSettings, setShowClusterSettings] = useState(false);

  // Sync adGroups state when data.adGroups changes (e.g., from cluster import)
  useEffect(() => {
    if (data.adGroups && data.adGroups.length > 0 && adGroups.length === 0) {
      console.log('[WizardStep2] Syncing pre-populated ad groups:', data.adGroups);
      setAdGroups(data.adGroups);
      setPrePopulated(true);
      // Auto-expand first group
      if (data.adGroups.length > 0) {
        setExpandedGroups(new Set([data.adGroups[0].id]));
      }
    }
  }, [data.adGroups]);

  const handleGenerateClusters = useCallback(async () => {
    // Use manual keywords if no pre-selected keywords
    const keywords = data.preSelectedKeywords || data.manualKeywords || [];

    if (keywords.length === 0) {
      setError('No keywords found. Please go back to Step 1 and add keywords.');
      return;
    }

    // Reset states
    setError(null);
    setShowTimeoutWarning(false);

    // Create abort controller
    const controller = new AbortController();
    setAbortController(controller);

    // Set timeout warning at 5 seconds
    const warningTimeout = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 5000);

    // Set hard timeout at 10 seconds
    const abortTimeout = setTimeout(() => {
      controller.abort();
      setError('Request timed out. The AI clustering is taking longer than expected. Try with fewer keywords or use simple grouping.');
    }, 10000);

    setIsGenerating(true);
    setIsProcessing(true);

    try {
      const response = await fetch('/api/campaigns/wizard/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          clusterMethod,
          sensitivity,
          minClusterSize: 2, // Fixed value - minimum 2 keywords per ad group
          maxClusters,
        }),
        signal: controller.signal,
      });

      clearTimeout(warningTimeout);
      clearTimeout(abortTimeout);

      if (!response.ok) {
        throw new Error('Failed to generate ad groups');
      }

      const { adGroups: generatedAdGroups, fallback } = await response.json();

      // Check if fallback clustering was used
      if (fallback) {
        setUsedFallback(true);
      }

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
    } catch (err: any) {
      clearTimeout(warningTimeout);
      clearTimeout(abortTimeout);

      console.error('Error generating clusters:', err);

      if (err.name === 'AbortError') {
        setError('Request cancelled or timed out. Please try again with fewer keywords.');
      } else {
        setError('Failed to generate ad groups. Please try again.');
      }
    } finally {
      setIsGenerating(false);
      setIsProcessing(false);
      setAbortController(null);
    }
  }, [data.preSelectedKeywords, data.manualKeywords, setIsProcessing, onUpdate, clusterMethod, sensitivity, maxClusters]);

  // Auto-generate clusters on first load if no ad groups exist AND not pre-populated from clusters
  useEffect(() => {
    const keywords = data.preSelectedKeywords || data.manualKeywords || [];
    const hasPrePopulatedAdGroups = data.adGroups && data.adGroups.length > 0;

    // Don't auto-generate if we already have ad groups from cluster import
    if (adGroups.length === 0 && !hasPrePopulatedAdGroups && keywords.length > 0 && !isGenerating) {
      handleGenerateClusters();
    }
  }, []);

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
    // Estimate: ~200ms per keyword for embeddings + clustering
    const estimatedSeconds = Math.max(3, Math.ceil((keywords.length * 200) / 1000));

    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full mb-6" />
        <h3 className="text-2xl font-bold text-text mb-3">🤖 AI is generating ad groups...</h3>
        <p className="text-sm text-text3 mb-6">
          Analyzing {keywords.length} keywords by semantic similarity
        </p>

        {/* Progress Steps */}
        <div className="bg-surface2 rounded-lg p-6 border border-divider max-w-md w-full mb-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-text">Analyzing keywords</div>
                <div className="text-xs text-text3 mt-0.5">Extracting semantic meaning from each keyword...</div>
              </div>
            </div>
            <div className="flex items-start gap-3 opacity-50">
              <div className="w-6 h-6 rounded-full border-2 border-divider flex-shrink-0"></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-text3">Grouping similar keywords</div>
                <div className="text-xs text-text3 mt-0.5">Clustering by theme and intent...</div>
              </div>
            </div>
            <div className="flex items-start gap-3 opacity-30">
              <div className="w-6 h-6 rounded-full border-2 border-divider flex-shrink-0"></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-text3">Generating ad group names</div>
                <div className="text-xs text-text3 mt-0.5">Creating descriptive names for each group...</div>
              </div>
            </div>
          </div>

          {/* Estimated Time */}
          <div className="mt-4 pt-4 border-t border-divider text-center">
            <div className="text-xs text-text3">
              Estimated time: <span className="font-medium text-accent">~{estimatedSeconds} seconds</span>
            </div>
          </div>
        </div>

        {/* Timeout Warning (appears after 5s) */}
        {showTimeoutWarning && (
          <div className="mt-4 px-6 py-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning max-w-md w-full">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱️</span>
              <div>
                <div className="font-medium">Taking longer than expected...</div>
                <div className="text-xs opacity-75 mt-0.5">This can happen with large keyword sets. Please wait or try with fewer keywords.</div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Button */}
        <button
          onClick={() => {
            abortController?.abort();
            setIsGenerating(false);
            setIsProcessing(false);
          }}
          className="mt-6 px-8 py-3 border-2 border-divider rounded-lg text-sm font-medium text-text3 hover:text-text hover:border-accent transition-colors"
        >
          Cancel Generation
        </button>
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
    const keywords = data.preSelectedKeywords || data.manualKeywords || [];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-xl font-bold text-text">Keyword Setup - Ad Group Clustering</h3>
          <p className="text-sm text-text3 mt-1">
            Cluster your keywords into Ad Groups based on meaning or similarity. You can also move keywords around manually. Your saved cluster can then be used in your campaigns.
          </p>
        </div>

        {/* Clustering Controls */}
        <div className="bg-surface2 border border-divider rounded-lg p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Number of Ad Groups */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Number of Ad Groups
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={maxClusters}
                onChange={(e) => setMaxClusters(parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
              />
              <p className="mt-1.5 text-xs text-text3">
                How many ad groups to create
              </p>
            </div>

            {/* Cluster Method */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Cluster Method
              </label>
              <select
                value={clusterMethod}
                onChange={(e) => setClusterMethod(e.target.value as 'meaning' | 'similarity')}
                className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
              >
                <option value="similarity">Cluster by Similarity</option>
                <option value="meaning">Cluster by Meaning</option>
              </select>
              <p className="mt-1.5 text-xs text-text3">
                {clusterMethod === 'similarity' ? 'Groups keywords with similar structure' : 'Groups keywords with similar meaning'}
              </p>
            </div>
          </div>

          {/* Sensitivity Slider */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text mb-2">
              Keyword Grouping Tightness ({sensitivity})
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-text3 mt-1">
              <span>Loose (diverse keywords)</span>
              <span>Tight (similar keywords)</span>
            </div>
            <p className="mt-1.5 text-xs text-text3">
              Controls how similar keywords need to be to group together
            </p>
          </div>

          {/* Cluster Button */}
          <button
            onClick={handleGenerateClusters}
            disabled={keywords.length === 0}
            className="w-full px-6 py-4 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>⚡</span>
            <span>Cluster Keywords</span>
          </button>
        </div>

        {/* Keywords List */}
        {keywords.length > 0 && (
          <div className="bg-surface2 border border-divider rounded-lg p-6">
            <h4 className="text-sm font-medium text-text mb-3">Keywords List to Cluster</h4>
            <div className="bg-surface rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="space-y-1 text-sm text-text3 font-mono">
                {keywords.slice(0, 100).map((kw: any, i: number) => (
                  <div key={i}>{kw.keyword}</div>
                ))}
                {keywords.length > 100 && (
                  <div className="text-xs text-text3 mt-2 italic">
                    ... and {keywords.length - 100} more keywords
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-text3 mt-3 text-right">
              {keywords.length} Keywords
            </p>
          </div>
        )}

        {keywords.length === 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h4 className="font-medium text-warning mb-2">No Keywords Found</h4>
            <p className="text-sm text-text3">
              Please go back to Step 1 and add keywords to cluster.
            </p>
          </div>
        )}
      </div>
    );
  }

  const keywords = data.preSelectedKeywords || data.manualKeywords || [];

  return (
    <div className="space-y-6">
      {/* Pre-populated from Cluster Studio banner */}
      {prePopulated && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-accent">Ad Groups Imported from Cluster Studio</div>
            <div className="text-xs text-text3 mt-0.5">
              Your keyword clusters have been converted to ad groups. Review and edit as needed.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text">Ad Groups</h3>
          <p className="text-sm text-text3 mt-1">
            {adGroups.length} groups created from {keywords.length} keywords
          </p>
        </div>
        <button
          onClick={() => setShowClusterSettings(!showClusterSettings)}
          className="px-4 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text hover:bg-surface transition-colors flex items-center gap-2"
        >
          <span>⚙️</span>
          <span>{showClusterSettings ? 'Hide Settings' : 'Adjust & Regenerate'}</span>
        </button>
      </div>

      {/* Clustering Settings (Collapsible) */}
      {showClusterSettings && (
        <div className="bg-surface2 border border-divider rounded-lg p-6">
          <h4 className="text-sm font-medium text-text mb-4">Clustering Settings</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Number of Ad Groups
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={maxClusters}
                onChange={(e) => setMaxClusters(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Cluster Method
              </label>
              <select
                value={clusterMethod}
                onChange={(e) => setClusterMethod(e.target.value as 'meaning' | 'similarity')}
                className="w-full px-3 py-2 bg-surface border border-divider rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="similarity">Cluster by Similarity</option>
                <option value="meaning">Cluster by Meaning</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-text mb-2">
              Keyword Grouping Tightness ({sensitivity})
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-text3 mt-1">
              <span>Loose (diverse)</span>
              <span>Tight (similar)</span>
            </div>
          </div>
          <button
            onClick={handleGenerateClusters}
            className="w-full px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium flex items-center justify-center gap-2"
          >
            <span>⚡</span>
            <span>Regenerate with New Settings</span>
          </button>
        </div>
      )}

      {/* Summary Stats */}
      {(() => {
        const totalKeywords = adGroups.reduce((sum, group) => sum + group.keywords.length, 0);
        const totalCpc = adGroups.reduce((sum, group) => sum + group.avgCpc, 0) / adGroups.length;
        const totalVolume = adGroups.reduce((sum, group) => sum + group.totalVolume, 0);
        const hasMetrics = totalCpc > 0 || totalVolume > 0;

        if (hasMetrics) {
          return (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface2 rounded-lg p-4 border border-divider">
                <div className="text-xs text-text3 mb-1">Total Keywords</div>
                <div className="text-2xl font-bold text-text">{totalKeywords}</div>
              </div>
              <div className="bg-surface2 rounded-lg p-4 border border-divider">
                <div className="text-xs text-text3 mb-1">Avg CPC</div>
                <div className="text-2xl font-bold text-text">${totalCpc.toFixed(2)}</div>
              </div>
              <div className="bg-surface2 rounded-lg p-4 border border-divider">
                <div className="text-xs text-text3 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-text">{(totalVolume / 1000).toFixed(1)}K</div>
              </div>
            </div>
          );
        } else {
          return (
            <div className="bg-surface2 rounded-lg p-4 border border-divider">
              <div className="flex items-start gap-3">
                <span className="text-xl">📊</span>
                <div className="flex-1">
                  <h4 className="font-medium text-text text-sm mb-1">
                    {totalKeywords} Keywords Clustered
                  </h4>
                  <p className="text-xs text-text3">
                    Metrics unavailable for manually entered keywords. Use Keyword Factory to generate keywords with CPC and volume data.
                  </p>
                </div>
              </div>
            </div>
          );
        }
      })()}

      {/* Fallback Clustering Notice */}
      {usedFallback && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚡</span>
            <div>
              <h4 className="font-medium text-warning text-sm mb-1">Simple Grouping Used</h4>
              <p className="text-xs text-text3">
                AI clustering was unavailable. Keywords were grouped by similarity instead.
                You can edit group names and move keywords between groups manually.
              </p>
            </div>
          </div>
        </div>
      )}

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
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateAdGroupName(group.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full font-medium text-text bg-transparent border-b border-transparent hover:border-accent focus:border-accent focus:outline-none transition-colors"
                    />
                    <div className="text-xs text-text3 mt-1">
                      {group.keywords.length} keywords
                      {group.avgCpc > 0 && ` · Avg CPC: $${group.avgCpc.toFixed(2)}`}
                      {group.totalVolume > 0 && ` · Volume: ${(group.totalVolume / 1000).toFixed(1)}K`}
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
                              {kw.metrics.searchVolume != null && <span>Vol: {(kw.metrics.searchVolume / 1000).toFixed(1)}K</span>}
                              {kw.metrics.cpc != null && <span>CPC: ${kw.metrics.cpc.toFixed(2)}</span>}
                              {kw.metrics.competition != null && <span>Comp: {(Number(kw.metrics.competition) * 100).toFixed(0)}%</span>}
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
