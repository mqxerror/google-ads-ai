import { useMemo } from 'react';
import { GeneratedKeyword } from '../types';

interface Filters {
  type: string;
  intent: string;
  match: string;
  viewMode: 'list' | 'clusters';
}

export function useKeywordFiltering(keywords: GeneratedKeyword[], filters: Filters) {
  const filteredKeywords = useMemo(() => {
    return keywords.filter((kw) => {
      if (filters.type !== 'all' && kw.type !== filters.type) return false;
      if (filters.intent !== 'all' && kw.estimatedIntent !== filters.intent)
        return false;
      if (filters.match !== 'all' && kw.suggestedMatchType !== filters.match)
        return false;
      return true;
    });
  }, [keywords, filters]);

  return filteredKeywords;
}
