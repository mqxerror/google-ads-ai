/**
 * Smart Embedding Service
 *
 * Optimized embedding retrieval with multi-level caching:
 * 1. Check keyword_list_items table (list-specific cache)
 * 2. Check keywords table (global cache from Google Ads)
 * 3. Generate new embeddings via OpenAI only for missing keywords
 * 4. Store back to caches for future use
 */

import { Pool } from 'pg';
import OpenAI from 'openai';

// PostgreSQL connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || '38.97.60.181',
      port: parseInt(process.env.POSTGRES_PORT || '5433'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres123',
      database: process.env.POSTGRES_DATABASE || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// OpenAI client singleton
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

// Embedding configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

export interface EmbeddingResult {
  keyword: string;
  keywordNormalized: string;
  embedding: number[];
  source: 'list_cache' | 'global_cache' | 'openai';
}

export interface GetEmbeddingsResult {
  embeddings: EmbeddingResult[];
  stats: {
    total: number;
    fromListCache: number;
    fromGlobalCache: number;
    fromOpenAI: number;
    costSaved: number; // Estimated $ saved by using cache
  };
}

/**
 * Get embeddings for keywords with smart caching
 *
 * @param listId - Optional list ID to check list-specific cache first
 * @param keywords - Array of keyword strings to get embeddings for
 * @param storeToList - Whether to store new embeddings back to list items
 */
export async function getSmartEmbeddings(
  keywords: string[],
  listId?: string,
  storeToList: boolean = true
): Promise<GetEmbeddingsResult> {
  const db = getPool();
  const results: EmbeddingResult[] = [];
  const stats = {
    total: keywords.length,
    fromListCache: 0,
    fromGlobalCache: 0,
    fromOpenAI: 0,
    costSaved: 0,
  };

  // Normalize keywords
  const keywordMap = new Map<string, string>();
  keywords.forEach(kw => {
    keywordMap.set(kw.toLowerCase().trim(), kw);
  });
  const normalizedKeywords = Array.from(keywordMap.keys());

  // Track which keywords still need embeddings
  let pendingKeywords = new Set(normalizedKeywords);

  // =========================================
  // Step 1: Check list-specific cache
  // =========================================
  if (listId) {
    try {
      const listCacheResult = await db.query<{
        keyword_normalized: string;
        embedding: string;
      }>(
        `SELECT keyword_normalized, embedding::text
         FROM keyword_list_items
         WHERE list_id = $1
           AND keyword_normalized = ANY($2)
           AND embedding IS NOT NULL`,
        [listId, normalizedKeywords]
      );

      for (const row of listCacheResult.rows) {
        const embedding = parseEmbedding(row.embedding);
        if (embedding) {
          results.push({
            keyword: keywordMap.get(row.keyword_normalized) || row.keyword_normalized,
            keywordNormalized: row.keyword_normalized,
            embedding,
            source: 'list_cache',
          });
          pendingKeywords.delete(row.keyword_normalized);
          stats.fromListCache++;
        }
      }

      console.log(`[SmartEmbeddings] Found ${stats.fromListCache} in list cache`);
    } catch (error) {
      console.warn('[SmartEmbeddings] List cache query failed:', error);
    }
  }

  // =========================================
  // Step 2: Check global keywords cache
  // =========================================
  if (pendingKeywords.size > 0) {
    try {
      const globalCacheResult = await db.query<{
        keyword: string;
        embedding: string;
      }>(
        `SELECT DISTINCT ON (LOWER(TRIM(keyword)))
           LOWER(TRIM(keyword)) as keyword,
           embedding::text
         FROM keywords
         WHERE LOWER(TRIM(keyword)) = ANY($1)
           AND embedding IS NOT NULL
         ORDER BY LOWER(TRIM(keyword)), updated_at DESC`,
        [Array.from(pendingKeywords)]
      );

      for (const row of globalCacheResult.rows) {
        const embedding = parseEmbedding(row.embedding);
        if (embedding) {
          results.push({
            keyword: keywordMap.get(row.keyword) || row.keyword,
            keywordNormalized: row.keyword,
            embedding,
            source: 'global_cache',
          });
          pendingKeywords.delete(row.keyword);
          stats.fromGlobalCache++;
        }
      }

      console.log(`[SmartEmbeddings] Found ${stats.fromGlobalCache} in global cache`);
    } catch (error) {
      console.warn('[SmartEmbeddings] Global cache query failed:', error);
    }
  }

  // =========================================
  // Step 3: Generate new embeddings via OpenAI
  // =========================================
  if (pendingKeywords.size > 0) {
    const pendingArray = Array.from(pendingKeywords);
    console.log(`[SmartEmbeddings] Generating ${pendingArray.length} new embeddings via OpenAI`);

    try {
      const client = getOpenAIClient();

      // Batch process (OpenAI supports up to 2048 inputs)
      const BATCH_SIZE = 2048;
      const newEmbeddings: { keyword: string; embedding: number[] }[] = [];

      for (let i = 0; i < pendingArray.length; i += BATCH_SIZE) {
        const batch = pendingArray.slice(i, i + BATCH_SIZE);

        const response = await client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
          dimensions: EMBEDDING_DIMENSION,
        });

        const sortedEmbeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map((item, idx) => ({
            keyword: batch[idx],
            embedding: item.embedding,
          }));

        newEmbeddings.push(...sortedEmbeddings);
      }

      // Add to results
      for (const { keyword, embedding } of newEmbeddings) {
        results.push({
          keyword: keywordMap.get(keyword) || keyword,
          keywordNormalized: keyword,
          embedding,
          source: 'openai',
        });
        stats.fromOpenAI++;
      }

      // =========================================
      // Step 4: Store new embeddings to caches
      // =========================================
      if (storeToList && listId && newEmbeddings.length > 0) {
        await storeEmbeddingsToList(db, listId, newEmbeddings);
      }

      // Also store to global cache for future use
      if (newEmbeddings.length > 0) {
        await storeEmbeddingsGlobally(db, newEmbeddings);
      }

    } catch (error) {
      console.error('[SmartEmbeddings] OpenAI embedding generation failed:', error);
      throw error;
    }
  }

  // Calculate cost saved
  // OpenAI text-embedding-3-small: $0.00002 per 1K tokens (~4 tokens per keyword)
  const cachedCount = stats.fromListCache + stats.fromGlobalCache;
  stats.costSaved = (cachedCount * 4 * 0.00002) / 1000;

  console.log(`[SmartEmbeddings] Complete: ${stats.fromListCache} list cache, ${stats.fromGlobalCache} global cache, ${stats.fromOpenAI} OpenAI`);

  return { embeddings: results, stats };
}

/**
 * Store embeddings to list items table
 */
async function storeEmbeddingsToList(
  db: Pool,
  listId: string,
  embeddings: { keyword: string; embedding: number[] }[]
): Promise<void> {
  try {
    const updates = embeddings.map(({ keyword, embedding }) => ({
      keyword_normalized: keyword.toLowerCase().trim(),
      embedding: formatEmbedding(embedding),
    }));

    // Batch update
    for (const update of updates) {
      await db.query(
        `UPDATE keyword_list_items
         SET embedding = $1::vector,
             embedding_model = $2,
             embedding_updated_at = NOW()
         WHERE list_id = $3
           AND keyword_normalized = $4`,
        [update.embedding, EMBEDDING_MODEL, listId, update.keyword_normalized]
      );
    }

    console.log(`[SmartEmbeddings] Stored ${updates.length} embeddings to list cache`);
  } catch (error) {
    console.warn('[SmartEmbeddings] Failed to store to list cache:', error);
  }
}

/**
 * Store embeddings to global keywords table
 */
async function storeEmbeddingsGlobally(
  db: Pool,
  embeddings: { keyword: string; embedding: number[] }[]
): Promise<void> {
  try {
    for (const { keyword, embedding } of embeddings) {
      // Upsert into global keywords table (without campaign_id for general cache)
      await db.query(
        `INSERT INTO keywords (keyword, embedding, source, created_at, updated_at)
         VALUES ($1, $2::vector, 'cluster_cache', NOW(), NOW())
         ON CONFLICT ON CONSTRAINT unique_keyword_campaign
         DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
        [keyword, formatEmbedding(embedding)]
      );
    }

    console.log(`[SmartEmbeddings] Stored ${embeddings.length} embeddings to global cache`);
  } catch (error) {
    // Non-critical - just log and continue
    console.warn('[SmartEmbeddings] Failed to store to global cache (non-critical):', error);
  }
}

/**
 * Parse embedding from PostgreSQL vector string
 */
function parseEmbedding(vectorString: string): number[] | null {
  try {
    // Format: [0.123,0.456,...]
    const cleaned = vectorString.replace(/[\[\]]/g, '');
    const values = cleaned.split(',').map(Number);
    if (values.some(isNaN)) return null;
    return values;
  } catch {
    return null;
  }
}

/**
 * Format embedding for PostgreSQL vector type
 */
function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Get embeddings for a specific list with caching
 */
export async function getListEmbeddings(
  listId: string,
  userEmail: string
): Promise<GetEmbeddingsResult> {
  const db = getPool();

  // Get all keywords from the list
  const listResult = await db.query<{ keyword: string }>(
    `SELECT kli.keyword
     FROM keyword_list_items kli
     JOIN keyword_lists kl ON kli.list_id = kl.id
     WHERE kli.list_id = $1 AND kl.user_id = $2`,
    [listId, userEmail]
  );

  const keywords = listResult.rows.map(r => r.keyword);

  if (keywords.length === 0) {
    return {
      embeddings: [],
      stats: { total: 0, fromListCache: 0, fromGlobalCache: 0, fromOpenAI: 0, costSaved: 0 }
    };
  }

  return getSmartEmbeddings(keywords, listId, true);
}

/**
 * Pre-warm embeddings cache for a list
 * Call this when adding keywords to ensure they have embeddings
 */
export async function prewarmListEmbeddings(
  listId: string,
  userEmail: string
): Promise<{ generated: number; cached: number }> {
  const result = await getListEmbeddings(listId, userEmail);
  return {
    generated: result.stats.fromOpenAI,
    cached: result.stats.fromListCache + result.stats.fromGlobalCache,
  };
}
