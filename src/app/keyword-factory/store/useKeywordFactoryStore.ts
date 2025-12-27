import { create } from 'zustand';
import { GeneratedKeyword, KeywordCluster, FactoryStats } from '../types';

interface GenerationOptions {
  generateVariations: boolean;
  generateSynonyms: boolean;
  suggestMatchTypes: boolean;
  includeNegatives: boolean;
  enrichWithMetrics: boolean;
  metricsProviders: ('google_ads' | 'moz' | 'dataforseo')[];
  maxKeywordsToEnrich: number;
  minSearchVolume: number;
  sortByMetrics: boolean;
  targetLocation: string;
}

interface Filters {
  type: string;
  intent: string;
  match: string;
  viewMode: 'list' | 'clusters';
}

interface UIState {
  expandedSection: 'enrichment' | null;
  showOnboardingModal: boolean;
  dontShowAgain: boolean;
  selectedKeywordForDetail: GeneratedKeyword | null;
}

interface KeywordFactoryStore {
  // Generation state
  seedInput: string;
  generating: boolean;
  keywords: GeneratedKeyword[];
  negativeKeywords: GeneratedKeyword[];
  clusters: KeywordCluster[];
  stats: FactoryStats | null;
  error: string | null;
  warnings: string[];

  // Filter state
  filters: Filters;

  // Selection state
  selectedKeywords: Set<string>;

  // Options state
  options: GenerationOptions;

  // UI state
  ui: UIState;

  // Actions - Generation
  setSeedInput: (input: string) => void;
  generateKeywords: () => Promise<void>;
  setGenerating: (generating: boolean) => void;
  setKeywords: (keywords: GeneratedKeyword[]) => void;
  setNegativeKeywords: (keywords: GeneratedKeyword[]) => void;
  setClusters: (clusters: KeywordCluster[]) => void;
  setStats: (stats: FactoryStats | null) => void;
  setError: (error: string | null) => void;
  setWarnings: (warnings: string[]) => void;

  // Actions - Filters
  updateFilters: (filters: Partial<Filters>) => void;

  // Actions - Selection
  toggleKeyword: (keyword: string) => void;
  selectAll: (keywords: GeneratedKeyword[]) => void;
  clearSelection: () => void;

  // Actions - Options
  updateOptions: (options: Partial<GenerationOptions>) => void;

  // Actions - UI
  setExpandedSection: (section: 'enrichment' | null) => void;
  setShowOnboardingModal: (show: boolean) => void;
  setDontShowAgain: (value: boolean) => void;
  setSelectedKeywordForDetail: (keyword: GeneratedKeyword | null) => void;
  handleEnableEnrichment: () => void;
  dismissOnboarding: () => void;
}

export const useKeywordFactoryStore = create<KeywordFactoryStore>((set, get) => ({
  // Initial state - Generation
  seedInput: '',
  generating: false,
  keywords: [],
  negativeKeywords: [],
  clusters: [],
  stats: null,
  error: null,
  warnings: [],

  // Initial state - Filters
  filters: {
    type: 'all',
    intent: 'all',
    match: 'all',
    viewMode: 'list',
  },

  // Initial state - Selection
  selectedKeywords: new Set(),

  // Initial state - Options
  options: {
    generateVariations: true,
    generateSynonyms: true,
    suggestMatchTypes: true,
    includeNegatives: true,
    enrichWithMetrics: false,
    metricsProviders: ['google_ads'],
    maxKeywordsToEnrich: 50,
    minSearchVolume: 0,
    sortByMetrics: true,
    targetLocation: 'US',
  },

  // Initial state - UI
  ui: {
    expandedSection: null,
    showOnboardingModal: false,
    dontShowAgain: false,
    selectedKeywordForDetail: null,
  },

  // Actions - Generation
  setSeedInput: (input) => set({ seedInput: input }),

  generateKeywords: async () => {
    const { seedInput, options } = get();
    const seeds = seedInput
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (seeds.length === 0) return;

    set({ generating: true, error: null, warnings: [] });

    try {
      const res = await fetch('/api/keywords/factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedKeywords: seeds, options }),
      });

      const data = await res.json();

      if (data.error && !data.keywords?.length) {
        set({ error: data.error });
      } else {
        set({
          keywords: data.keywords || [],
          negativeKeywords: data.negativeKeywords || [],
          clusters: data.clusters || [],
          stats: data.stats,
          warnings: data.warnings || [],
          selectedKeywords: new Set(),
        });
      }
    } catch (err) {
      set({ error: 'Failed to generate keywords. Please try again.' });
    } finally {
      set({ generating: false });
    }
  },

  setGenerating: (generating) => set({ generating }),
  setKeywords: (keywords) => set({ keywords }),
  setNegativeKeywords: (keywords) => set({ negativeKeywords: keywords }),
  setClusters: (clusters) => set({ clusters }),
  setStats: (stats) => set({ stats }),
  setError: (error) => set({ error }),
  setWarnings: (warnings) => set({ warnings }),

  // Actions - Filters
  updateFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  // Actions - Selection
  toggleKeyword: (keyword) =>
    set((state) => {
      const newSelected = new Set(state.selectedKeywords);
      if (newSelected.has(keyword)) {
        newSelected.delete(keyword);
      } else {
        newSelected.add(keyword);
      }
      return { selectedKeywords: newSelected };
    }),

  selectAll: (keywords) =>
    set({ selectedKeywords: new Set(keywords.map((k) => k.keyword)) }),

  clearSelection: () => set({ selectedKeywords: new Set() }),

  // Actions - Options
  updateOptions: (newOptions) =>
    set((state) => ({
      options: { ...state.options, ...newOptions },
    })),

  // Actions - UI
  setExpandedSection: (section) =>
    set((state) => ({
      ui: { ...state.ui, expandedSection: section },
    })),

  setShowOnboardingModal: (show) =>
    set((state) => ({
      ui: { ...state.ui, showOnboardingModal: show },
    })),

  setDontShowAgain: (value) =>
    set((state) => ({
      ui: { ...state.ui, dontShowAgain: value },
    })),

  setSelectedKeywordForDetail: (keyword) =>
    set((state) => ({
      ui: { ...state.ui, selectedKeywordForDetail: keyword },
    })),

  handleEnableEnrichment: () => {
    const { ui, updateOptions, setShowOnboardingModal } = get();
    updateOptions({ enrichWithMetrics: true });
    setShowOnboardingModal(false);
    if (ui.dontShowAgain) {
      localStorage.setItem('keyword-factory-enrichment-onboarding', 'true');
    }
  },

  dismissOnboarding: () => {
    const { ui, setShowOnboardingModal } = get();
    setShowOnboardingModal(false);
    if (ui.dontShowAgain) {
      localStorage.setItem('keyword-factory-enrichment-onboarding', 'true');
    }
  },
}));
