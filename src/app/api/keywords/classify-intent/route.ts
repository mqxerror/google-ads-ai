/**
 * Intent Classification API
 *
 * Fetches keyword search intent from DataForSEO Labs API.
 * Cost: ~$0.02 per 1000 keywords (very cheap!)
 *
 * Features:
 * - Caches intent in keyword_metrics table
 * - Returns cached values if available (< 30 days old)
 * - Only fetches from DataForSEO for new/expired keywords
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';
import { fetchSearchIntent, SearchIntent } from '@/lib/keyword-data/dataforseo';

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

export interface IntentResult {
  keyword: string;
  intent: SearchIntent | null;
  confidence: number | null;
  cached: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keywords, listId, language = 'en' } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords array required' }, { status: 400 });
    }

    // Limit to 1000 keywords per request (DataForSEO limit)
    const keywordsToProcess = keywords.slice(0, 1000);

    console.log(`[Intent API] Processing ${keywordsToProcess.length} keywords${listId ? ` (list: ${listId})` : ''}`);

    const db = getPool();
    const results: Record<string, IntentResult> = {};

    // Step 1: Deduplicate keywords (case-insensitive)
    const normalizedKeywords = keywordsToProcess.map(kw => kw.toLowerCase().trim());
    const uniqueNormalized = [...new Set(normalizedKeywords)];

    // Map normalized -> original keyword (keep first occurrence)
    const normalizedToOriginal = new Map<string, string>();
    for (const kw of keywordsToProcess) {
      const norm = kw.toLowerCase().trim();
      if (!normalizedToOriginal.has(norm)) {
        normalizedToOriginal.set(norm, kw);
      }
    }

    console.log(`[Intent API] ${keywordsToProcess.length} keywords -> ${uniqueNormalized.length} unique`);

    // Step 2: Check cache for existing intent values (< 30 days old)
    try {
      const cachedQuery = await db.query(
        `SELECT keyword, keyword_normalized, dataforseo_intent, dataforseo_intent_probability, dataforseo_intent_fetched_at
         FROM keyword_metrics
         WHERE keyword_normalized = ANY($1)
           AND dataforseo_intent IS NOT NULL
           AND dataforseo_intent_fetched_at > NOW() - INTERVAL '30 days'`,
        [uniqueNormalized]
      );

      // Map cached results
      for (const row of cachedQuery.rows) {
        const originalKeyword = normalizedToOriginal.get(row.keyword_normalized);
        if (originalKeyword) {
          results[originalKeyword] = {
            keyword: originalKeyword,
            intent: row.dataforseo_intent as SearchIntent,
            confidence: row.dataforseo_intent_probability ? parseFloat(row.dataforseo_intent_probability) : null,
            cached: true,
          };
        }
      }

      console.log(`[Intent API] Cache hit: ${Object.keys(results).length}/${uniqueNormalized.length} keywords`);
    } catch (cacheError) {
      console.error('[Intent API] Cache check error:', cacheError);
    }

    // Step 3: Identify unique keywords that need fetching (not in cache)
    const cachedNormalized = new Set(
      Object.keys(results).map(kw => kw.toLowerCase().trim())
    );
    const toFetchNormalized = uniqueNormalized.filter(norm => !cachedNormalized.has(norm));
    const keywordsToFetch = toFetchNormalized.map(norm => normalizedToOriginal.get(norm)!);

    console.log(`[Intent API] Need to fetch ${keywordsToFetch.length} keywords from DataForSEO (${Object.keys(results).length} cached)`);

    // Step 4: Fetch from DataForSEO (only uncached keywords)
    let fetchedCount = 0;
    let fetchErrors = 0;

    if (keywordsToFetch.length > 0) {
      const fetchResults = await fetchSearchIntent(keywordsToFetch, language);

      for (const result of fetchResults) {
        if (result.intent !== null) {
          results[result.keyword] = {
            keyword: result.keyword,
            intent: result.intent,
            confidence: result.probability,
            cached: false,
          };
          fetchedCount++;

          // Step 5: Save intent to database (for future cache hits)
          const keywordNormalized = result.keyword.toLowerCase().trim();
          try {
            await db.query(
              `INSERT INTO keyword_metrics (
                keyword,
                keyword_normalized,
                locale,
                dataforseo_intent,
                dataforseo_intent_probability,
                dataforseo_secondary_intents,
                dataforseo_intent_fetched_at,
                best_intent,
                best_source
              )
              VALUES ($1, $2, $3, $4, $5, $6, NOW(), $4, 'dataforseo')
              ON CONFLICT (keyword_normalized, locale, device)
              DO UPDATE SET
                dataforseo_intent = $4,
                dataforseo_intent_probability = $5,
                dataforseo_secondary_intents = $6,
                dataforseo_intent_fetched_at = NOW(),
                best_intent = COALESCE($4, keyword_metrics.best_intent),
                updated_at = NOW()`,
              [
                result.keyword,
                keywordNormalized,
                `${language}-${language.toUpperCase()}`,
                result.intent,
                result.probability,
                result.secondaryIntents ? JSON.stringify(result.secondaryIntents) : null,
              ]
            );
          } catch (dbError) {
            console.error(`[Intent API] Failed to save intent for "${result.keyword}":`, dbError);
          }
        } else {
          results[result.keyword] = {
            keyword: result.keyword,
            intent: null,
            confidence: null,
            cached: false,
            error: result.error,
          };
          fetchErrors++;
        }
      }
    }

    // Also update keyword_list_items if listId is provided
    let savedToListCount = 0;
    if (listId) {
      try {
        for (const [keyword, result] of Object.entries(results)) {
          if (result.intent) {
            const keywordNormalized = keyword.toLowerCase().trim();
            await db.query(
              `UPDATE keyword_list_items
               SET intent = $1,
                   intent_confidence = $2,
                   intent_source = 'dataforseo',
                   intent_classified_at = NOW()
               WHERE list_id = $3 AND keyword_normalized = $4`,
              [result.intent, result.confidence, listId, keywordNormalized]
            );
            savedToListCount++;
          }
        }
        console.log(`[Intent API] Updated ${savedToListCount} keywords in list ${listId}`);
      } catch (dbError) {
        console.error('[Intent API] Failed to update list items:', dbError);
      }
    }

    // Calculate stats
    const cachedCount = Object.values(results).filter(r => r.cached).length;
    const totalWithIntent = Object.values(results).filter(r => r.intent !== null).length;
    const estimatedCost = (keywordsToFetch.length * 0.00002).toFixed(5);

    console.log(`[Intent API] Complete: ${totalWithIntent}/${keywordsToProcess.length} with intent (${cachedCount} cached, ${fetchedCount} fetched), cost: $${estimatedCost}`);

    return NextResponse.json({
      results,
      stats: {
        total: keywordsToProcess.length,
        withIntent: totalWithIntent,
        cached: cachedCount,
        fetched: fetchedCount,
        failed: fetchErrors,
        estimatedCost: `$${estimatedCost}`,
        savedToList: listId ? savedToListCount : undefined,
      },
    });
  } catch (error) {
    console.error('[Intent API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to classify intent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
