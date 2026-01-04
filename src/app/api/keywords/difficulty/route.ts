/**
 * Keyword Difficulty API
 *
 * Fetches ONLY Keyword Difficulty (KD) from DataForSEO Labs API.
 * Cost: ~$0.30 per 1000 keywords
 *
 * NOTE: For Volume, CPC, Competition - use Google Ads API (more accurate for PPC)
 *
 * Features:
 * - Caches KD in keyword_metrics table
 * - Returns cached values if available (< 30 days old)
 * - Only fetches from DataForSEO for new/expired keywords
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';
import { fetchKeywordDifficulty } from '@/lib/keyword-data/dataforseo';

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

// Location code mapping
const LOCATION_CODES: Record<string, number> = {
  US: 2840,
  GB: 2826,
  CA: 2124,
  AU: 2036,
  DE: 2276,
  FR: 2250,
  ES: 2724,
  PT: 2620,
};

export interface KDResult {
  keyword: string;
  difficulty: number | null;
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
    const { keywords, location = 'US' } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords array required' }, { status: 400 });
    }

    // Limit to 500 keywords per request to manage costs
    const keywordsToProcess = keywords.slice(0, 500);
    const locationCode = LOCATION_CODES[location] || 2840;
    const locale = `${location.toLowerCase()}-${location.toUpperCase()}`;

    console.log(`[KD API] Processing ${keywordsToProcess.length} keywords (location: ${location}/${locationCode})`);

    const db = getPool();
    const results: Record<string, KDResult> = {};

    // Step 1: Check cache for existing KD values (< 30 days old)
    const normalizedKeywords = keywordsToProcess.map(kw => kw.toLowerCase().trim());

    try {
      const cachedQuery = await db.query(
        `SELECT keyword, keyword_normalized, dataforseo_kd, dataforseo_kd_fetched_at
         FROM keyword_metrics
         WHERE keyword_normalized = ANY($1)
           AND dataforseo_kd IS NOT NULL
           AND dataforseo_kd_fetched_at > NOW() - INTERVAL '30 days'`,
        [normalizedKeywords]
      );

      // Map cached results
      for (const row of cachedQuery.rows) {
        const originalKeyword = keywordsToProcess.find(
          kw => kw.toLowerCase().trim() === row.keyword_normalized
        );
        if (originalKeyword) {
          results[originalKeyword] = {
            keyword: originalKeyword,
            difficulty: row.dataforseo_kd,
            cached: true,
          };
        }
      }

      console.log(`[KD API] Found ${Object.keys(results).length} cached KD values`);
    } catch (cacheError) {
      console.error('[KD API] Cache check error:', cacheError);
    }

    // Step 2: Identify keywords that need fetching
    const keywordsToFetch = keywordsToProcess.filter(kw => !results[kw]);

    console.log(`[KD API] Need to fetch ${keywordsToFetch.length} keywords from DataForSEO`);

    // Step 3: Fetch from DataForSEO
    let fetchedCount = 0;
    let fetchErrors = 0;

    if (keywordsToFetch.length > 0) {
      const fetchResults = await fetchKeywordDifficulty(keywordsToFetch, locationCode);

      for (const result of fetchResults) {
        if (result.difficulty !== null) {
          results[result.keyword] = {
            keyword: result.keyword,
            difficulty: result.difficulty,
            cached: false,
          };
          fetchedCount++;

          // Step 4: Save KD to database
          const keywordNormalized = result.keyword.toLowerCase().trim();
          try {
            await db.query(
              `INSERT INTO keyword_metrics (
                keyword,
                keyword_normalized,
                locale,
                dataforseo_kd,
                dataforseo_kd_fetched_at,
                best_difficulty,
                best_source
              )
              VALUES ($1, $2, $3, $4, NOW(), $4, 'dataforseo')
              ON CONFLICT (keyword_normalized, locale, device)
              DO UPDATE SET
                dataforseo_kd = $4,
                dataforseo_kd_fetched_at = NOW(),
                best_difficulty = COALESCE($4, keyword_metrics.best_difficulty),
                updated_at = NOW()`,
              [result.keyword, keywordNormalized, locale, result.difficulty]
            );
          } catch (dbError) {
            console.error(`[KD API] Failed to save KD for "${result.keyword}":`, dbError);
          }
        } else {
          results[result.keyword] = {
            keyword: result.keyword,
            difficulty: null,
            cached: false,
            error: result.error,
          };
          fetchErrors++;
        }
      }
    }

    // Calculate stats
    const cachedCount = Object.values(results).filter(r => r.cached).length;
    const totalWithKD = Object.values(results).filter(r => r.difficulty !== null).length;
    const estimatedCost = (keywordsToFetch.length * 0.0003).toFixed(4);

    console.log(`[KD API] Complete: ${totalWithKD}/${keywordsToProcess.length} with KD (${cachedCount} cached, ${fetchedCount} fetched), cost: $${estimatedCost}`);

    return NextResponse.json({
      results,
      stats: {
        total: keywordsToProcess.length,
        withKD: totalWithKD,
        cached: cachedCount,
        fetched: fetchedCount,
        failed: fetchErrors,
        estimatedCost: `$${estimatedCost}`,
      },
    });
  } catch (error) {
    console.error('[KD API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword difficulty', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
