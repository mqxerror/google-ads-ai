'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAccount } from './AccountContext';
import { Campaign, AdGroup, Keyword } from '@/types/campaign';
import { useDateRangeState, DateRange, DateRangePreset } from '@/hooks/useDateRangeParams';

interface DailyMetrics {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpa: number;
}

// Cache configuration
const CACHE_KEY_PREFIX = 'gads-cache-';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const MIN_FETCH_INTERVAL_MS = 30 * 1000; // Minimum 30 seconds between fetches
const RATE_LIMIT_BACKOFF_MS = 60 * 60 * 1000; // 1 hour backoff when rate limited

interface CachedData<T> {
  data: T;
  timestamp: number;
  dateRange: { startDate: string; endDate: string };
}

function getCache<T>(key: string, dateRange: { startDate: string; endDate: string }): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (cached) {
      const parsed: CachedData<T> = JSON.parse(cached);
      const now = Date.now();
      // Check if cache is still valid and for the same date range
      if (
        now - parsed.timestamp < CACHE_TTL_MS &&
        parsed.dateRange.startDate === dateRange.startDate &&
        parsed.dateRange.endDate === dateRange.endDate
      ) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function setCache<T>(key: string, data: T, dateRange: { startDate: string; endDate: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      dateRange,
    };
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

function isRateLimited(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rateLimitUntil = localStorage.getItem(CACHE_KEY_PREFIX + 'rate-limit');
    if (rateLimitUntil) {
      const until = parseInt(rateLimitUntil, 10);
      if (Date.now() < until) {
        return true;
      }
      localStorage.removeItem(CACHE_KEY_PREFIX + 'rate-limit');
    }
  } catch {
    // Ignore errors
  }
  return false;
}

function setRateLimited(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + 'rate-limit', String(Date.now() + RATE_LIMIT_BACKOFF_MS));
  } catch {
    // Ignore errors
  }
}

// API response metadata for debugging
interface ApiQueryMeta {
  customerId: string;
  startDate: string;
  endDate: string;
  campaignId?: string;
  adGroupId?: string;
  executedAt: string;
}

interface LastApiResponse {
  campaigns?: ApiQueryMeta;
  adGroups?: ApiQueryMeta;
  keywords?: ApiQueryMeta;
}

interface CampaignsDataContextValue {
  // Campaign data
  campaigns: Campaign[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  // Daily metrics for trends
  dailyMetrics: DailyMetrics[];
  isDailyMetricsLoading: boolean;

  // Date range (single source of truth from URL params)
  dateRange: DateRange;
  setDateRange: (range: DateRange | DateRangePreset) => void;

  // Data freshness tracking
  lastSyncedAt: Date | null;
  syncStatus: 'idle' | 'syncing' | 'error' | 'partial';
  dataCompleteness: number;

  // Ad Groups (for drill-down context)
  adGroups: AdGroup[];
  fetchAdGroups: (campaignId: string) => Promise<void>;
  isAdGroupsLoading: boolean;

  // Keywords (for drill-down context)
  keywords: Keyword[];
  fetchKeywords: (adGroupId: string) => Promise<void>;
  isKeywordsLoading: boolean;

  // API response metadata for debugging (shows actual executed queries)
  lastApiResponse: LastApiResponse;
}

const CampaignsDataContext = createContext<CampaignsDataContextValue | undefined>(undefined);

// Note: Date range is now managed via URL params using useDateRangeParams hook
// This ensures SSR + client always match (single source of truth)

export function CampaignsDataProvider({ children }: { children: ReactNode }) {
  const { currentAccount } = useAccount();

  // Date range - SSR-safe state management with consistent preset calculation
  const { dateRange, setDateRange } = useDateRangeState();

  // Campaign data state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Daily metrics state
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [isDailyMetricsLoading, setIsDailyMetricsLoading] = useState(false);

  // Data freshness tracking
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'partial'>('idle');
  const [dataCompleteness, setDataCompleteness] = useState(100);

  // Refs for rate limiting
  const lastFetchTime = useRef<number>(0);
  const isFetching = useRef<boolean>(false);

  // Ad Groups state (for AI context when drilling down)
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [isAdGroupsLoading, setIsAdGroupsLoading] = useState(false);

  // Keywords state (for AI context when drilling down)
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isKeywordsLoading, setIsKeywordsLoading] = useState(false);

  // Track actual API response metadata for debugging
  const [lastApiResponse, setLastApiResponse] = useState<LastApiResponse>({});

  // Fetch campaigns with caching and rate limiting
  const fetchCampaigns = useCallback(async (forceRefresh = false) => {
    if (!currentAccount?.id) {
      setCampaigns([]);
      return;
    }

    const cacheKey = `campaigns-${currentAccount.id}`;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCache<Campaign[]>(cacheKey, dateRange);
      if (cached) {
        setCampaigns(cached);
        setLastSyncedAt(new Date());
        setSyncStatus('idle');
        setIsLoading(false);
        return;
      }
    }

    // Check rate limit - but only block if we don't have cache
    if (isRateLimited()) {
      setError('API rate limited. Please wait before trying again.');
      setSyncStatus('error');
      setIsLoading(false);
      return;
    }

    // Check if we're already fetching
    if (isFetching.current) {
      return;
    }

    // Check minimum interval between fetches (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < MIN_FETCH_INTERVAL_MS) {
      return;
    }

    isFetching.current = true;
    setIsLoading(true);
    setError(null);
    setSyncStatus('syncing');

    try {
      const params = new URLSearchParams({
        accountId: currentAccount.id,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const response = await fetch(`/api/google-ads/campaigns?${params}`);

      if (!response.ok) {
        const data = await response.json();
        // Check for rate limit error
        if (data.error?.includes('Too many requests') || response.status === 429) {
          setRateLimited();
          throw new Error('API rate limited. Please wait before trying again.');
        }
        throw new Error(data.error || 'Failed to fetch campaigns');
      }

      const data = await response.json();
      const campaignsData = data.campaigns || [];
      setCampaigns(campaignsData);
      setCache(cacheKey, campaignsData, dateRange);
      setLastSyncedAt(new Date());
      lastFetchTime.current = Date.now();
      setSyncStatus('idle');

      // Capture API metadata for debugging
      if (data._meta?.query) {
        setLastApiResponse(prev => ({
          ...prev,
          campaigns: {
            ...data._meta.query,
            executedAt: data._meta.executedAt,
          },
        }));
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch campaigns';
      // Check for rate limit in error message
      if (errorMessage.includes('Too many requests')) {
        setRateLimited();
      }
      setError(errorMessage);
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [currentAccount?.id, dateRange]);

  // Fetch daily metrics for trends with caching
  const fetchDailyMetrics = useCallback(async () => {
    if (!currentAccount?.id) {
      setDailyMetrics([]);
      setIsDailyMetricsLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = `metrics-${currentAccount.id}`;
    const cached = getCache<DailyMetrics[]>(cacheKey, dateRange);
    if (cached) {
      setDailyMetrics(cached);
      // Calculate completeness from cached data
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      const expectedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const completeness = expectedDays > 0 ? Math.round((cached.length / expectedDays) * 100) : 100;
      setDataCompleteness(Math.min(completeness, 100));
      setIsDailyMetricsLoading(false);
      return;
    }

    // Check rate limit - only block if we don't have cache
    if (isRateLimited()) {
      setIsDailyMetricsLoading(false);
      return;
    }

    setIsDailyMetricsLoading(true);

    try {
      const params = new URLSearchParams({
        accountId: currentAccount.id,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const response = await fetch(`/api/google-ads/reports?${params}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error?.includes('Too many requests') || response.status === 429) {
          setRateLimited();
          throw new Error('API rate limited');
        }
        throw new Error('Failed to fetch daily metrics');
      }

      const data = await response.json();
      const metrics = data.dailyMetrics || [];
      setDailyMetrics(metrics);
      setCache(cacheKey, metrics, dateRange);

      // Calculate data completeness based on expected vs actual days
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      const expectedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const actualDays = metrics.length;
      const completeness = expectedDays > 0 ? Math.round((actualDays / expectedDays) * 100) : 100;
      setDataCompleteness(Math.min(completeness, 100));

      // Set partial status if we have campaigns but incomplete daily data
      if (completeness < 100 && syncStatus !== 'error') {
        setSyncStatus('partial');
      }
    } catch (err) {
      console.error('Error fetching daily metrics:', err);
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes('Too many requests') || errorMessage.includes('rate limit')) {
        setRateLimited();
      }
      setDailyMetrics([]);
      setDataCompleteness(0);
    } finally {
      setIsDailyMetricsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.id, dateRange.startDate, dateRange.endDate]);

  // Fetch ad groups for a specific campaign (with date range for metric consistency)
  const fetchAdGroups = useCallback(async (campaignId: string) => {
    if (!currentAccount?.id || !campaignId) {
      setAdGroups([]);
      return;
    }

    setIsAdGroupsLoading(true);

    try {
      const params = new URLSearchParams({
        accountId: currentAccount.id,
        campaignId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const response = await fetch(`/api/google-ads/ad-groups?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch ad groups');
      }

      const data = await response.json();
      setAdGroups(data.adGroups || []);

      // Capture API metadata for debugging
      if (data._meta?.query) {
        setLastApiResponse(prev => ({
          ...prev,
          adGroups: {
            ...data._meta.query,
            executedAt: data._meta.executedAt,
          },
        }));
      }
    } catch (err) {
      console.error('Error fetching ad groups:', err);
      setAdGroups([]);
    } finally {
      setIsAdGroupsLoading(false);
    }
  }, [currentAccount?.id, dateRange.startDate, dateRange.endDate]);

  // Fetch keywords for a specific ad group (with date range for metric consistency)
  const fetchKeywords = useCallback(async (adGroupId: string) => {
    if (!currentAccount?.id || !adGroupId) {
      setKeywords([]);
      return;
    }

    setIsKeywordsLoading(true);

    try {
      const params = new URLSearchParams({
        accountId: currentAccount.id,
        adGroupId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const response = await fetch(`/api/google-ads/keywords?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch keywords');
      }

      const data = await response.json();
      setKeywords(data.keywords || []);

      // Capture API metadata for debugging
      if (data._meta?.query) {
        setLastApiResponse(prev => ({
          ...prev,
          keywords: {
            ...data._meta.query,
            executedAt: data._meta.executedAt,
          },
        }));
      }
    } catch (err) {
      console.error('Error fetching keywords:', err);
      setKeywords([]);
    } finally {
      setIsKeywordsLoading(false);
    }
  }, [currentAccount?.id, dateRange.startDate, dateRange.endDate]);

  // Load from cache on mount/account change - NO automatic API calls
  // User must manually refresh to fetch fresh data (protects API limits)
  useEffect(() => {
    if (currentAccount?.id) {
      // Only load from cache, don't make API calls automatically
      const campaignsCacheKey = `campaigns-${currentAccount.id}`;
      const metricsCacheKey = `metrics-${currentAccount.id}`;

      const cachedCampaigns = getCache<Campaign[]>(campaignsCacheKey, dateRange);
      if (cachedCampaigns) {
        setCampaigns(cachedCampaigns);
        setSyncStatus('idle');
        // Get the cache timestamp for lastSyncedAt
        try {
          const cached = localStorage.getItem(CACHE_KEY_PREFIX + campaignsCacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            setLastSyncedAt(new Date(parsed.timestamp));
          }
        } catch {
          // Ignore
        }
      }

      const cachedMetrics = getCache<DailyMetrics[]>(metricsCacheKey, dateRange);
      if (cachedMetrics) {
        setDailyMetrics(cachedMetrics);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        const expectedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const completeness = expectedDays > 0 ? Math.round((cachedMetrics.length / expectedDays) * 100) : 100;
        setDataCompleteness(Math.min(completeness, 100));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.id, dateRange.startDate, dateRange.endDate]);

  // Clear drill-down data when account changes
  useEffect(() => {
    setAdGroups([]);
    setKeywords([]);
  }, [currentAccount?.id]);

  // Force refresh function for manual refresh
  const refetch = useCallback(async () => {
    await fetchCampaigns(true);
    await fetchDailyMetrics();
  }, [fetchCampaigns, fetchDailyMetrics]);

  const value: CampaignsDataContextValue = {
    campaigns,
    isLoading,
    error,
    refetch,
    dailyMetrics,
    isDailyMetricsLoading,
    dateRange,
    setDateRange,
    lastSyncedAt,
    syncStatus,
    dataCompleteness,
    adGroups,
    fetchAdGroups,
    isAdGroupsLoading,
    keywords,
    fetchKeywords,
    isKeywordsLoading,
    lastApiResponse,
  };

  return (
    <CampaignsDataContext.Provider value={value}>
      {children}
    </CampaignsDataContext.Provider>
  );
}

export function useCampaignsData() {
  const context = useContext(CampaignsDataContext);
  if (context === undefined) {
    throw new Error('useCampaignsData must be used within a CampaignsDataProvider');
  }
  return context;
}
