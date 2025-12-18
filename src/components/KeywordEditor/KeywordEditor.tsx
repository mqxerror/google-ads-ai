'use client';

import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useDrillDown } from '@/contexts/DrillDownContext';

interface KeywordEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onKeywordsAdded?: () => void;
}

type MatchType = 'EXACT' | 'PHRASE' | 'BROAD';

interface KeywordEntry {
  text: string;
  matchType: MatchType;
}

export default function KeywordEditor({ isOpen, onClose, onKeywordsAdded }: KeywordEditorProps) {
  const { currentAccount } = useAccount();
  const { selectedCampaign, selectedAdGroup } = useDrillDown();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [keywordText, setKeywordText] = useState('');
  const [defaultMatchType, setDefaultMatchType] = useState<MatchType>('BROAD');
  const [keywords, setKeywords] = useState<KeywordEntry[]>([]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setKeywordText('');
      setKeywords([]);
      setError(null);
    }
  }, [isOpen]);

  const parseKeywords = (text: string): KeywordEntry[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return lines.map(line => {
      // Auto-detect match type from notation
      if (line.startsWith('[') && line.endsWith(']')) {
        return { text: line.slice(1, -1), matchType: 'EXACT' as MatchType };
      }
      if (line.startsWith('"') && line.endsWith('"')) {
        return { text: line.slice(1, -1), matchType: 'PHRASE' as MatchType };
      }
      return { text: line, matchType: defaultMatchType };
    });
  };

  const handleAddKeywords = () => {
    const newKeywords = parseKeywords(keywordText);
    if (newKeywords.length > 0) {
      setKeywords([...keywords, ...newKeywords]);
      setKeywordText('');
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const updateKeywordMatchType = (index: number, matchType: MatchType) => {
    const updated = [...keywords];
    updated[index].matchType = matchType;
    setKeywords(updated);
  };

  const handleSubmit = async () => {
    if (keywords.length === 0) {
      setError('Please add at least one keyword');
      return;
    }

    if (!currentAccount || !selectedAdGroup) {
      setError('No account or ad group selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/google-ads/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount.id,
          adGroupId: selectedAdGroup.id,
          keywords: keywords.map(k => ({
            text: k.text,
            matchType: k.matchType,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add keywords');
      }

      onKeywordsAdded?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add keywords');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 z-50 flex items-start justify-center overflow-y-auto py-8 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl">
        <div className="relative w-full overflow-hidden rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add Keywords</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedAdGroup?.name} • {selectedCampaign?.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {error && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Keyword Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter keywords (one per line)
                </label>
                <textarea
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  placeholder={`Enter keywords here, e.g.:\nrunning shoes\n"men's running shoes"\n[best running shoes]`}
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Use [keyword] for exact match, &quot;keyword&quot; for phrase match, or plain text for broad match.
                </p>
              </div>

              {/* Default Match Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Match Type (for unmarked keywords)
                </label>
                <div className="flex gap-2">
                  {(['BROAD', 'PHRASE', 'EXACT'] as MatchType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setDefaultMatchType(type)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        defaultMatchType === type
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type === 'EXACT' ? '[exact]' : type === 'PHRASE' ? '"phrase"' : 'broad'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddKeywords}
                disabled={!keywordText.trim()}
                className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                + Add to list below
              </button>

              {/* Keywords List */}
              {keywords.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Keywords to add ({keywords.length})
                    </label>
                    <button
                      onClick={() => setKeywords([])}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="rounded-lg border border-gray-200 divide-y divide-gray-200 max-h-48 overflow-y-auto">
                    {keywords.map((keyword, index) => (
                      <div key={index} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-gray-900">{keyword.text}</span>
                          <select
                            value={keyword.matchType}
                            onChange={(e) => updateKeywordMatchType(index, e.target.value as MatchType)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            <option value="BROAD">broad</option>
                            <option value="PHRASE">&quot;phrase&quot;</option>
                            <option value="EXACT">[exact]</option>
                          </select>
                        </div>
                        <button
                          onClick={() => removeKeyword(index)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Negative Keywords Hint */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-600">
                  <strong>Tip:</strong> These keywords will be added as positive keywords.
                  Negative keywords can be managed in the campaign settings.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <span className="text-sm text-gray-500">
              {keywords.length} keyword{keywords.length !== 1 ? 's' : ''} ready to add
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || keywords.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : `Add ${keywords.length} Keyword${keywords.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
