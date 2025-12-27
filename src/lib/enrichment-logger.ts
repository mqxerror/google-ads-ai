/**
 * Enrichment Logger
 * Logs keyword enrichment pipeline activity for debugging
 * Tracks API requests, responses, cache hits/misses, and data transformation
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || '38.97.60.181',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  database: process.env.POSTGRES_DB || 'google_ads_manager',
});

export interface EnrichmentLogOptions {
  requestId?: string;
  userId?: string;
  keywords: string[];
  seedKeyword?: string;
  locale?: string;
  device?: string;
  locationId?: string;
  selectedProviders: string[];
}

export interface EnrichmentLogUpdate {
  quotaCheckResult?: any;
  provider?: string;
  apiEndpoint?: string;
  apiRequest?: any;
  apiResponse?: any;
  apiError?: any;
  apiDurationMs?: number;
  cacheHits?: number;
  cacheMisses?: number;
  cachedData?: any;
  enrichedKeywords?: any;
  status?: 'pending' | 'success' | 'partial' | 'failed';
  errorMessage?: string;
}

class EnrichmentLogger {
  /**
   * Start a new enrichment log entry
   */
  async start(options: EnrichmentLogOptions): Promise<string> {
    const requestId = options.requestId || uuidv4();

    try {
      await pool.query(
        `
        INSERT INTO enrichment_logs (
          request_id,
          user_id,
          keywords,
          seed_keyword,
          locale,
          device,
          location_id,
          selected_providers,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        `,
        [
          requestId,
          options.userId || null,
          options.keywords,
          options.seedKeyword || null,
          options.locale || 'en-US',
          options.device || 'desktop',
          options.locationId || '2840',
          options.selectedProviders,
        ]
      );

      console.log(`[EnrichmentLogger] Started log for request: ${requestId}`);
      return requestId;
    } catch (error) {
      console.error('[EnrichmentLogger] Failed to start log:', error);
      return requestId; // Return ID anyway so pipeline doesn't break
    }
  }

  /**
   * Update an existing enrichment log entry
   */
  async update(requestId: string, updates: EnrichmentLogUpdate): Promise<void> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      // Build dynamic UPDATE query based on provided fields
      if (updates.quotaCheckResult !== undefined) {
        setClauses.push(`quota_check_result = $${paramCounter++}`);
        values.push(JSON.stringify(updates.quotaCheckResult));
      }
      if (updates.provider !== undefined) {
        setClauses.push(`provider = $${paramCounter++}`);
        values.push(updates.provider);
      }
      if (updates.apiEndpoint !== undefined) {
        setClauses.push(`api_endpoint = $${paramCounter++}`);
        values.push(updates.apiEndpoint);
      }
      if (updates.apiRequest !== undefined) {
        setClauses.push(`api_request = $${paramCounter++}`);
        values.push(JSON.stringify(updates.apiRequest));
      }
      if (updates.apiResponse !== undefined) {
        setClauses.push(`api_response = $${paramCounter++}`);
        values.push(JSON.stringify(updates.apiResponse));
      }
      if (updates.apiError !== undefined) {
        setClauses.push(`api_error = $${paramCounter++}`);
        values.push(JSON.stringify(updates.apiError));
      }
      if (updates.apiDurationMs !== undefined) {
        setClauses.push(`api_duration_ms = $${paramCounter++}`);
        values.push(updates.apiDurationMs);
      }
      if (updates.cacheHits !== undefined) {
        setClauses.push(`cache_hits = $${paramCounter++}`);
        values.push(updates.cacheHits);
      }
      if (updates.cacheMisses !== undefined) {
        setClauses.push(`cache_misses = $${paramCounter++}`);
        values.push(updates.cacheMisses);
      }
      if (updates.cachedData !== undefined) {
        setClauses.push(`cached_data = $${paramCounter++}`);
        values.push(JSON.stringify(updates.cachedData));
      }
      if (updates.enrichedKeywords !== undefined) {
        setClauses.push(`enriched_keywords = $${paramCounter++}`);
        values.push(JSON.stringify(updates.enrichedKeywords));
      }
      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramCounter++}`);
        values.push(updates.status);
      }
      if (updates.errorMessage !== undefined) {
        setClauses.push(`error_message = $${paramCounter++}`);
        values.push(updates.errorMessage);
      }

      if (setClauses.length === 0) {
        return; // Nothing to update
      }

      values.push(requestId); // Add requestId for WHERE clause

      await pool.query(
        `
        UPDATE enrichment_logs
        SET ${setClauses.join(', ')}
        WHERE request_id = $${paramCounter}
        `,
        values
      );

      console.log(`[EnrichmentLogger] Updated log for request: ${requestId}`);
    } catch (error) {
      console.error('[EnrichmentLogger] Failed to update log:', error);
    }
  }

  /**
   * Get recent enrichment logs
   */
  async getRecentLogs(limit: number = 50): Promise<any[]> {
    try {
      const result = await pool.query(
        `
        SELECT * FROM enrichment_logs
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit]
      );

      return result.rows;
    } catch (error) {
      console.error('[EnrichmentLogger] Failed to get recent logs:', error);
      return [];
    }
  }

  /**
   * Get a specific log by request ID
   */
  async getLog(requestId: string): Promise<any | null> {
    try {
      const result = await pool.query(
        `
        SELECT * FROM enrichment_logs
        WHERE request_id = $1
        `,
        [requestId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('[EnrichmentLogger] Failed to get log:', error);
      return null;
    }
  }
}

// Export singleton instance
export const enrichmentLogger = new EnrichmentLogger();
