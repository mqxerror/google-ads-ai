import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database types for vector store
export interface Keyword {
  id: string;
  keyword: string;
  embedding: number[] | null;
  embedding_model: string | null;  // e.g., 'text-embedding-ada-002'
  embedding_dimensions: number | null;  // e.g., 1536
  embedding_created_at: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  match_type: 'BROAD' | 'PHRASE' | 'EXACT' | null;
  intent: 'commercial' | 'informational' | 'navigational' | 'transactional' | null;
  intent_score: number | null;
  search_volume: number | null;
  cpc: number | null;
  competition: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  is_negative: boolean;
  source: 'google_ads' | 'dataforseo' | 'manual' | 'ai_suggested' | null;
  created_at: string;
  updated_at: string;
}

export interface SearchTerm {
  id: string;
  search_term: string;
  embedding: number[] | null;
  embedding_model: string | null;  // e.g., 'text-embedding-ada-002'
  embedding_dimensions: number | null;  // e.g., 1536
  embedding_created_at: string | null;
  campaign_id: string | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  cost: number | null;
  matched_keyword: string | null;
  is_negative_candidate: boolean;
  negative_reason: string | null;
  created_at: string;
}

export interface KeywordCluster {
  id: string;
  name: string;
  centroid: number[] | null;
  keyword_count: number;
  avg_intent_score: number | null;
  created_at: string;
}

export interface KeywordWithSimilarity extends Keyword {
  similarity: number;
}

export interface SearchTermWithSimilarity extends SearchTerm {
  similarity: number;
}

// Keyword Metrics Cache (from 004_keyword_metrics migration)
export interface KeywordMetrics {
  id: string;
  keyword: string;
  keyword_normalized: string;
  locale: string;
  device: 'desktop' | 'mobile' | 'tablet';
  location_id: string; // Google Ads geoTargetConstant (e.g., '2840' for US)

  // Google Ads metrics
  gads_search_volume: number | null;
  gads_avg_cpc_micros: number | null;
  gads_competition: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  gads_competition_index: number | null;
  gads_fetched_at: string | null;
  gads_status: 'success' | 'not_found' | 'error' | 'quota_exceeded' | null;
  gads_error: string | null;

  // Moz metrics
  moz_volume: number | null;
  moz_difficulty: number | null;
  moz_organic_ctr: number | null;
  moz_priority: number | null;
  moz_intent_primary: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
  moz_intent_scores: Record<string, number> | null;
  moz_fetched_at: string | null;
  moz_status: 'success' | 'not_found' | 'error' | 'quota_exceeded' | null;
  moz_error: string | null;

  // DataForSEO metrics
  dataforseo_search_volume: number | null;
  dataforseo_cpc: number | null;
  dataforseo_competition: number | null;
  dataforseo_trends: Record<string, number> | null;
  dataforseo_fetched_at: string | null;
  dataforseo_status: 'success' | 'not_found' | 'error' | 'quota_exceeded' | null;
  dataforseo_error: string | null;

  // Best/derived values
  best_search_volume: number | null;
  best_cpc: number | null;
  best_difficulty: number | null;
  best_intent: 'informational' | 'navigational' | 'commercial' | 'transactional' | null;
  best_source: 'google_ads' | 'moz' | 'dataforseo' | 'cached' | 'unavailable' | 'none' | null;

  // Cache management
  created_at: string;
  updated_at: string;
  cache_hit_count: number;
  last_accessed_at: string | null;
  ttl_days: number;
  expires_at: string;
  schema_version: string;
}

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Fall back to direct PostgreSQL connection info
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_KEY or DATABASE_URL');
    }
    // For direct PostgreSQL, we'll use a different approach
    // Use a placeholder key for local development with direct PostgreSQL
    const placeholderKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE5NTczNDUyMDB9.dc6hdKxzzbh4P0ldGw_3O4LX6dYZjBb_Zaq8lOFyJWQ';

    supabaseClient = createClient(supabaseUrl || 'http://localhost:3000', placeholderKey, {
      auth: {
        persistSession: false,
      },
    });

    return supabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  return supabaseClient;
}

// Helper to execute raw SQL (for pgvector operations)
export async function executeRawSQL<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('execute_sql', {
    query: sql,
    params: params,
  });

  if (error) {
    throw new Error(`SQL execution failed: ${error.message}`);
  }

  return data as T[];
}

// Keyword operations
export async function insertKeyword(keyword: Omit<Keyword, 'id' | 'created_at' | 'updated_at'>): Promise<Keyword> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('keywords')
    .insert(keyword)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert keyword: ${error.message}`);
  }

  return data;
}

export async function insertKeywords(keywords: Omit<Keyword, 'id' | 'created_at' | 'updated_at'>[]): Promise<Keyword[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('keywords')
    .insert(keywords)
    .select();

  if (error) {
    throw new Error(`Failed to insert keywords: ${error.message}`);
  }

  return data;
}

export async function getKeywordsByCampaign(campaignId: string): Promise<Keyword[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('keywords')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) {
    throw new Error(`Failed to get keywords: ${error.message}`);
  }

  return data;
}

export async function getNegativeKeywords(campaignId?: string): Promise<Keyword[]> {
  const client = getSupabaseClient();

  let query = client
    .from('keywords')
    .select('*')
    .eq('is_negative', true);

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get negative keywords: ${error.message}`);
  }

  return data;
}

// Search term operations
export async function insertSearchTerm(searchTerm: Omit<SearchTerm, 'id' | 'created_at'>): Promise<SearchTerm> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('search_terms')
    .insert(searchTerm)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert search term: ${error.message}`);
  }

  return data;
}

export async function insertSearchTerms(searchTerms: Omit<SearchTerm, 'id' | 'created_at'>[]): Promise<SearchTerm[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('search_terms')
    .insert(searchTerms)
    .select();

  if (error) {
    throw new Error(`Failed to insert search terms: ${error.message}`);
  }

  return data;
}

export async function getSearchTermsByCampaign(campaignId: string): Promise<SearchTerm[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('search_terms')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('cost', { ascending: false });

  if (error) {
    throw new Error(`Failed to get search terms: ${error.message}`);
  }

  return data;
}

// Cluster operations
export async function insertCluster(cluster: Omit<KeywordCluster, 'id' | 'created_at'>): Promise<KeywordCluster> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('keyword_clusters')
    .insert(cluster)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert cluster: ${error.message}`);
  }

  return data;
}

export async function getClusters(): Promise<KeywordCluster[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('keyword_clusters')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get clusters: ${error.message}`);
  }

  return data;
}

// Update keyword with embedding
export async function updateKeywordEmbedding(keywordId: string, embedding: number[]): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from('keywords')
    .update({
      embedding: embedding,
      updated_at: new Date().toISOString()
    })
    .eq('id', keywordId);

  if (error) {
    throw new Error(`Failed to update keyword embedding: ${error.message}`);
  }
}

// Update search term with embedding
export async function updateSearchTermEmbedding(searchTermId: string, embedding: number[]): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from('search_terms')
    .update({ embedding: embedding })
    .eq('id', searchTermId);

  if (error) {
    throw new Error(`Failed to update search term embedding: ${error.message}`);
  }
}
