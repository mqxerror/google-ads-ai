import { GeneratedKeyword } from '../types';

export function useKeywordExport() {
  const copyToClipboard = (keywords: string[]) => {
    const text = keywords.join('\n');
    navigator.clipboard.writeText(text);
  };

  const exportCSV = (
    keywords: GeneratedKeyword[],
    selectedKeywords: Set<string>,
    includeMetrics: boolean
  ) => {
    const selected = keywords.filter((k) => selectedKeywords.has(k.keyword));

    // Enhanced CSV with metrics
    const headers = ['Keyword', 'Type', 'Match Type', 'Intent'];
    if (includeMetrics) {
      headers.push('Volume', 'CPC', 'Competition', 'Opportunity Score');
    }

    const csv = [
      headers.join(','),
      ...selected.map((k) => {
        const row = [
          `"${k.keyword}"`,
          k.type,
          k.suggestedMatchType,
          k.estimatedIntent,
        ];

        if (includeMetrics) {
          row.push(
            k.metrics?.searchVolume?.toString() || '0',
            k.metrics?.cpc?.toFixed(2) || '0.00',
            k.metrics?.competition || 'UNKNOWN',
            k.opportunityScore?.toString() || '0'
          );
        }

        return row.join(',');
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    copyToClipboard,
    exportCSV,
  };
}
