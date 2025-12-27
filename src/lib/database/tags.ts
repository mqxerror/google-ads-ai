/**
 * CRUD operations for Keyword Tags
 */

import { Pool } from 'pg';
import type {
  KeywordTag,
  KeywordTagAssignment,
  CreateKeywordTagInput,
  AssignTagInput,
} from './types';

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

// =====================================================
// Tags CRUD
// =====================================================

export async function createKeywordTag(
  input: CreateKeywordTagInput
): Promise<KeywordTag> {
  const pool = getPool();
  const result = await pool.query<KeywordTag>(
    `
    INSERT INTO keyword_tags (user_id, name, color, description)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [
      input.user_id,
      input.name,
      input.color || '#6B7280',
      input.description || null,
    ]
  );

  return result.rows[0];
}

export async function getKeywordTags(userId: string): Promise<KeywordTag[]> {
  const pool = getPool();
  const result = await pool.query<KeywordTag>(
    `
    SELECT * FROM keyword_tags
    WHERE user_id = $1
    ORDER BY keyword_count DESC, name ASC
    `,
    [userId]
  );

  return result.rows;
}

export async function getKeywordTagById(
  tagId: string,
  userId: string
): Promise<KeywordTag | null> {
  const pool = getPool();
  const result = await pool.query<KeywordTag>(
    `
    SELECT * FROM keyword_tags
    WHERE id = $1 AND user_id = $2
    `,
    [tagId, userId]
  );

  return result.rows[0] || null;
}

export async function updateKeywordTag(
  tagId: string,
  userId: string,
  updates: Partial<Pick<KeywordTag, 'name' | 'color' | 'description'>>
): Promise<KeywordTag | null> {
  const pool = getPool();

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.color !== undefined) {
    fields.push(`color = $${paramIndex++}`);
    values.push(updates.color);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (fields.length === 0) {
    return getKeywordTagById(tagId, userId);
  }

  values.push(tagId, userId);

  const result = await pool.query<KeywordTag>(
    `
    UPDATE keyword_tags
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

export async function deleteKeywordTag(
  tagId: string,
  userId: string
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `
    DELETE FROM keyword_tags
    WHERE id = $1 AND user_id = $2
    `,
    [tagId, userId]
  );

  return result.rowCount || 0;
}

// =====================================================
// Tag Assignments
// =====================================================

export async function assignTagsToKeywords(
  input: AssignTagInput
): Promise<{ assigned: number; duplicates: number }> {
  const pool = getPool();

  // First verify tag belongs to user
  const tag = await getKeywordTagById(input.tag_id, input.user_id);
  if (!tag) {
    throw new Error('Tag not found or access denied');
  }

  let assigned = 0;
  let duplicates = 0;

  for (const keyword of input.keywords) {
    const keywordNormalized = keyword.toLowerCase().trim();

    try {
      const result = await pool.query(
        `
        INSERT INTO keyword_tag_assignments (keyword_normalized, tag_id, user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (keyword_normalized, tag_id, user_id) DO NOTHING
        RETURNING id
        `,
        [keywordNormalized, input.tag_id, input.user_id]
      );

      if (result.rowCount && result.rowCount > 0) {
        assigned++;
      } else {
        duplicates++;
      }
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        duplicates++;
      } else {
        throw error;
      }
    }
  }

  return { assigned, duplicates };
}

export async function unassignTagsFromKeywords(
  tagId: string,
  userId: string,
  keywords: string[]
): Promise<number> {
  const pool = getPool();

  // First verify tag belongs to user
  const tag = await getKeywordTagById(tagId, userId);
  if (!tag) {
    throw new Error('Tag not found or access denied');
  }

  const keywordsNormalized = keywords.map((k) => k.toLowerCase().trim());

  const result = await pool.query(
    `
    DELETE FROM keyword_tag_assignments
    WHERE tag_id = $1
      AND user_id = $2
      AND keyword_normalized = ANY($3)
    `,
    [tagId, userId, keywordsNormalized]
  );

  return result.rowCount || 0;
}

export async function getTagsForKeyword(
  keyword: string,
  userId: string
): Promise<KeywordTag[]> {
  const pool = getPool();
  const keywordNormalized = keyword.toLowerCase().trim();

  const result = await pool.query<KeywordTag>(
    `
    SELECT kt.*
    FROM keyword_tags kt
    INNER JOIN keyword_tag_assignments kta ON kt.id = kta.tag_id
    WHERE kta.keyword_normalized = $1
      AND kta.user_id = $2
    ORDER BY kt.name ASC
    `,
    [keywordNormalized, userId]
  );

  return result.rows;
}

export async function getKeywordsForTag(
  tagId: string,
  userId: string
): Promise<string[]> {
  const pool = getPool();

  // First verify tag belongs to user
  const tag = await getKeywordTagById(tagId, userId);
  if (!tag) {
    throw new Error('Tag not found or access denied');
  }

  const result = await pool.query<{ keyword_normalized: string }>(
    `
    SELECT keyword_normalized
    FROM keyword_tag_assignments
    WHERE tag_id = $1 AND user_id = $2
    ORDER BY tagged_at DESC
    `,
    [tagId, userId]
  );

  return result.rows.map((row) => row.keyword_normalized);
}

export async function getTagAssignments(
  userId: string,
  keywords?: string[]
): Promise<Map<string, KeywordTag[]>> {
  const pool = getPool();

  let query = `
    SELECT
      kta.keyword_normalized,
      kt.*
    FROM keyword_tag_assignments kta
    INNER JOIN keyword_tags kt ON kta.tag_id = kt.id
    WHERE kta.user_id = $1
  `;

  const params: any[] = [userId];

  if (keywords && keywords.length > 0) {
    const keywordsNormalized = keywords.map((k) => k.toLowerCase().trim());
    query += ` AND kta.keyword_normalized = ANY($2)`;
    params.push(keywordsNormalized);
  }

  query += ` ORDER BY kta.keyword_normalized, kt.name`;

  const result = await pool.query<
    { keyword_normalized: string } & KeywordTag
  >(query, params);

  const map = new Map<string, KeywordTag[]>();

  for (const row of result.rows) {
    const { keyword_normalized, ...tag } = row;
    if (!map.has(keyword_normalized)) {
      map.set(keyword_normalized, []);
    }
    map.get(keyword_normalized)!.push(tag as KeywordTag);
  }

  return map;
}

// =====================================================
// Bulk Operations
// =====================================================

export async function bulkAssignTag(
  tagId: string,
  userId: string,
  keywords: string[]
): Promise<{ assigned: number; duplicates: number }> {
  return assignTagsToKeywords({
    tag_id: tagId,
    user_id: userId,
    keywords,
  });
}

export async function bulkUnassignTag(
  tagId: string,
  userId: string,
  keywords: string[]
): Promise<number> {
  return unassignTagsFromKeywords(tagId, userId, keywords);
}

export async function removeAllTagsFromKeyword(
  keyword: string,
  userId: string
): Promise<number> {
  const pool = getPool();
  const keywordNormalized = keyword.toLowerCase().trim();

  const result = await pool.query(
    `
    DELETE FROM keyword_tag_assignments
    WHERE keyword_normalized = $1 AND user_id = $2
    `,
    [keywordNormalized, userId]
  );

  return result.rowCount || 0;
}

// =====================================================
// Utility Functions
// =====================================================

export async function searchTags(
  userId: string,
  query: string
): Promise<KeywordTag[]> {
  const pool = getPool();

  const result = await pool.query<KeywordTag>(
    `
    SELECT * FROM keyword_tags
    WHERE user_id = $1
      AND (
        name ILIKE $2
        OR description ILIKE $2
      )
    ORDER BY keyword_count DESC, name ASC
    `,
    [userId, `%${query}%`]
  );

  return result.rows;
}

export async function getMostUsedTags(
  userId: string,
  limit: number = 10
): Promise<KeywordTag[]> {
  const pool = getPool();

  const result = await pool.query<KeywordTag>(
    `
    SELECT * FROM keyword_tags
    WHERE user_id = $1
    ORDER BY keyword_count DESC
    LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows;
}
