import { createClient } from '@supabase/supabase-js';
import { generateEmbedding, formatEmbeddingForPostgres } from './embeddings';
import type { Keyword, SearchTerm, KeywordWithSimilarity, SearchTermWithSimilarity } from './supabase';

// Get database client for raw SQL queries
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL environment variable');
  }
  return url;
}

// Find similar keywords using vector similarity search
export async function findSimilarKeywords(
  queryText: string,
  options: {
    limit?: number;
    similarityThreshold?: number;
    campaignId?: string;
    excludeNegatives?: boolean;
  } = {}
): Promise<KeywordWithSimilarity[]> {
  const {
    limit = 20,
    similarityThreshold = 0.7,
    campaignId,
    excludeNegatives = false,
  } = options;

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(queryText);
  const embeddingStr = formatEmbeddingForPostgres(queryEmbedding);

  // Build WHERE clause
  const conditions: string[] = [];
  if (campaignId) {
    conditions.push(`campaign_id = '${campaignId}'`);
  }
  if (excludeNegatives) {
    conditions.push('is_negative = false');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Using Supabase RPC for vector search
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Call the similarity search function
  const { data, error } = await supabase.rpc('search_similar_keywords', {
    query_embedding: queryEmbedding,
    similarity_threshold: similarityThreshold,
    match_count: limit,
    filter_campaign_id: campaignId || null,
    exclude_negatives: excludeNegatives,
  });

  if (error) {
    console.error('Vector search error:', error);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return data || [];
}

// Find similar search terms
export async function findSimilarSearchTerms(
  queryText: string,
  options: {
    limit?: number;
    similarityThreshold?: number;
    campaignId?: string;
    onlyNegativeCandidates?: boolean;
  } = {}
): Promise<SearchTermWithSimilarity[]> {
  const {
    limit = 20,
    similarityThreshold = 0.7,
    campaignId,
    onlyNegativeCandidates = false,
  } = options;

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(queryText);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Call the similarity search function
  const { data, error } = await supabase.rpc('search_similar_search_terms', {
    query_embedding: queryEmbedding,
    similarity_threshold: similarityThreshold,
    match_count: limit,
    filter_campaign_id: campaignId || null,
    only_negative_candidates: onlyNegativeCandidates,
  });

  if (error) {
    console.error('Vector search error:', error);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return data || [];
}

// Find keywords similar to negative keyword patterns
export async function findNegativeCandidates(
  campaignId: string,
  options: {
    minCost?: number;
    similarityThreshold?: number;
    limit?: number;
  } = {}
): Promise<SearchTermWithSimilarity[]> {
  const {
    minCost = 10,
    similarityThreshold = 0.7,
    limit = 50,
  } = options;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Call the negative candidate finder function
  const { data, error } = await supabase.rpc('find_negative_candidates', {
    p_campaign_id: campaignId,
    p_min_cost: minCost,
    p_similarity_threshold: similarityThreshold,
    p_limit: limit,
  });

  if (error) {
    console.error('Negative candidate search error:', error);
    throw new Error(`Negative candidate search failed: ${error.message}`);
  }

  return data || [];
}

// Find semantic gaps (keywords competitors have but we don't)
export async function findSemanticGaps(
  ourKeywords: string[],
  competitorKeywords: string[],
  similarityThreshold: number = 0.7
): Promise<{ keyword: string; similarity: number }[]> {
  if (ourKeywords.length === 0 || competitorKeywords.length === 0) {
    return competitorKeywords.map(kw => ({ keyword: kw, similarity: 0 }));
  }

  // Generate embeddings for all keywords
  const { generateEmbeddings, cosineSimilarity } = await import('./embeddings');

  const ourEmbeddings = await generateEmbeddings(ourKeywords);
  const competitorEmbeddings = await generateEmbeddings(competitorKeywords);

  const gaps: { keyword: string; similarity: number }[] = [];

  // For each competitor keyword, find the closest match in our keywords
  for (let i = 0; i < competitorKeywords.length; i++) {
    let maxSimilarity = 0;

    for (let j = 0; j < ourKeywords.length; j++) {
      const similarity = cosineSimilarity(competitorEmbeddings[i], ourEmbeddings[j]);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // If the best match is below threshold, it's a gap
    if (maxSimilarity < similarityThreshold) {
      gaps.push({
        keyword: competitorKeywords[i],
        similarity: maxSimilarity,
      });
    }
  }

  // Sort by similarity (lowest first = biggest gaps)
  return gaps.sort((a, b) => a.similarity - b.similarity);
}

// Cluster keywords by semantic similarity
export async function clusterKeywordsByMeaning(
  keywords: string[],
  options: {
    similarityThreshold?: number;
    minClusterSize?: number;
  } = {}
): Promise<{
  clusters: { name: string; keywords: string[]; avgSimilarity: number }[];
  unclustered: string[];
}> {
  const {
    similarityThreshold = 0.8,
    minClusterSize = 2,
  } = options;

  if (keywords.length === 0) {
    return { clusters: [], unclustered: [] };
  }

  // Generate embeddings
  const { generateEmbeddings, clusterBySimilarity } = await import('./embeddings');
  const embeddings = await generateEmbeddings(keywords);

  // Cluster
  const clusters = clusterBySimilarity(embeddings, similarityThreshold, minClusterSize);

  // Format results
  const formattedClusters = clusters.map(cluster => {
    const clusterKeywords = cluster.items.map(item => keywords[item.index]);

    // Calculate average similarity within cluster
    let totalSimilarity = 0;
    let count = 0;
    for (let i = 0; i < cluster.items.length; i++) {
      for (let j = i + 1; j < cluster.items.length; j++) {
        const { cosineSimilarity } = require('./embeddings');
        totalSimilarity += cosineSimilarity(
          cluster.items[i].embedding,
          cluster.items[j].embedding
        );
        count++;
      }
    }
    const avgSimilarity = count > 0 ? totalSimilarity / count : 1;

    // Use shortest keyword as cluster name (usually most general)
    const name = clusterKeywords.reduce((a, b) => a.length <= b.length ? a : b);

    return {
      name,
      keywords: clusterKeywords,
      avgSimilarity,
    };
  });

  // Find unclustered keywords
  const clusteredIndices = new Set(
    clusters.flatMap(c => c.items.map(item => item.index))
  );
  const unclustered = keywords.filter((_, i) => !clusteredIndices.has(i));

  return {
    clusters: formattedClusters,
    unclustered,
  };
}

// Batch update embeddings for keywords without them
export async function updateMissingKeywordEmbeddings(
  batchSize: number = 100
): Promise<{ updated: number; errors: number }> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get keywords without embeddings
  const { data: keywords, error: fetchError } = await supabase
    .from('keywords')
    .select('id, keyword')
    .is('embedding', null)
    .limit(batchSize);

  if (fetchError) {
    throw new Error(`Failed to fetch keywords: ${fetchError.message}`);
  }

  if (!keywords || keywords.length === 0) {
    return { updated: 0, errors: 0 };
  }

  // Generate embeddings
  const { generateEmbeddings } = await import('./embeddings');
  const texts = keywords.map(k => k.keyword);
  const embeddings = await generateEmbeddings(texts);

  // Update each keyword
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < keywords.length; i++) {
    const { error: updateError } = await supabase
      .from('keywords')
      .update({ embedding: embeddings[i] })
      .eq('id', keywords[i].id);

    if (updateError) {
      console.error(`Failed to update keyword ${keywords[i].id}:`, updateError);
      errors++;
    } else {
      updated++;
    }
  }

  return { updated, errors };
}

// Batch update embeddings for search terms without them
export async function updateMissingSearchTermEmbeddings(
  batchSize: number = 100
): Promise<{ updated: number; errors: number }> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get search terms without embeddings
  const { data: searchTerms, error: fetchError } = await supabase
    .from('search_terms')
    .select('id, search_term')
    .is('embedding', null)
    .limit(batchSize);

  if (fetchError) {
    throw new Error(`Failed to fetch search terms: ${fetchError.message}`);
  }

  if (!searchTerms || searchTerms.length === 0) {
    return { updated: 0, errors: 0 };
  }

  // Generate embeddings
  const { generateEmbeddings } = await import('./embeddings');
  const texts = searchTerms.map(st => st.search_term);
  const embeddings = await generateEmbeddings(texts);

  // Update each search term
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < searchTerms.length; i++) {
    const { error: updateError } = await supabase
      .from('search_terms')
      .update({ embedding: embeddings[i] })
      .eq('id', searchTerms[i].id);

    if (updateError) {
      console.error(`Failed to update search term ${searchTerms[i].id}:`, updateError);
      errors++;
    } else {
      updated++;
    }
  }

  return { updated, errors };
}
