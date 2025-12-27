/**
 * CRUD operations for Keyword Lists
 */

import { Pool } from 'pg';
import type {
  KeywordList,
  KeywordListItem,
  CreateKeywordListInput,
  UpdateKeywordListInput,
  AddKeywordToListInput,
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
// Lists CRUD
// =====================================================

export async function createKeywordList(
  input: CreateKeywordListInput
): Promise<KeywordList> {
  const pool = getPool();
  const result = await pool.query<KeywordList>(
    `
    INSERT INTO keyword_lists (user_id, name, description, color, icon, is_favorite)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      input.user_id,
      input.name,
      input.description || null,
      input.color || '#3B82F6',
      input.icon || '📁',
      input.is_favorite || false,
    ]
  );

  return result.rows[0];
}

export async function getKeywordLists(userId: string): Promise<KeywordList[]> {
  const pool = getPool();
  const result = await pool.query<KeywordList>(
    `
    SELECT * FROM keyword_lists
    WHERE user_id = $1
    ORDER BY is_favorite DESC, created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

export async function getKeywordListById(
  listId: string,
  userId: string
): Promise<KeywordList | null> {
  const pool = getPool();
  const result = await pool.query<KeywordList>(
    `
    SELECT * FROM keyword_lists
    WHERE id = $1 AND user_id = $2
    `,
    [listId, userId]
  );

  return result.rows[0] || null;
}

export async function updateKeywordList(
  listId: string,
  userId: string,
  input: UpdateKeywordListInput
): Promise<KeywordList | null> {
  const pool = getPool();

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  if (input.color !== undefined) {
    fields.push(`color = $${paramIndex++}`);
    values.push(input.color);
  }
  if (input.icon !== undefined) {
    fields.push(`icon = $${paramIndex++}`);
    values.push(input.icon);
  }
  if (input.is_favorite !== undefined) {
    fields.push(`is_favorite = $${paramIndex++}`);
    values.push(input.is_favorite);
  }

  if (fields.length === 0) {
    return getKeywordListById(listId, userId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(listId, userId);

  const result = await pool.query<KeywordList>(
    `
    UPDATE keyword_lists
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

export async function deleteKeywordList(
  listId: string,
  userId: string
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `
    DELETE FROM keyword_lists
    WHERE id = $1 AND user_id = $2
    `,
    [listId, userId]
  );

  return result.rowCount || 0;
}

// =====================================================
// List Items CRUD
// =====================================================

export async function addKeywordsToList(
  listId: string,
  userId: string,
  keywords: AddKeywordToListInput[]
): Promise<{ added: number; duplicates: number }> {
  const pool = getPool();

  // First verify list belongs to user
  const list = await getKeywordListById(listId, userId);
  if (!list) {
    throw new Error('List not found or access denied');
  }

  let added = 0;
  let duplicates = 0;

  for (const kw of keywords) {
    const keywordNormalized = kw.keyword.toLowerCase().trim();

    try {
      await pool.query(
        `
        INSERT INTO keyword_list_items (
          list_id,
          keyword,
          keyword_normalized,
          snapshot_search_volume,
          snapshot_cpc,
          snapshot_opportunity_score,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (list_id, keyword_normalized) DO NOTHING
        `,
        [
          listId,
          kw.keyword,
          keywordNormalized,
          kw.snapshot_search_volume || null,
          kw.snapshot_cpc || null,
          kw.snapshot_opportunity_score || null,
          kw.notes || null,
        ]
      );
      added++;
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        duplicates++;
      } else {
        throw error;
      }
    }
  }

  return { added, duplicates };
}

export async function getListItems(
  listId: string,
  userId: string
): Promise<KeywordListItem[]> {
  const pool = getPool();

  // First verify list belongs to user
  const list = await getKeywordListById(listId, userId);
  if (!list) {
    throw new Error('List not found or access denied');
  }

  const result = await pool.query<KeywordListItem>(
    `
    SELECT * FROM keyword_list_items
    WHERE list_id = $1
    ORDER BY position ASC, added_at ASC
    `,
    [listId]
  );

  return result.rows;
}

export async function removeKeywordsFromList(
  listId: string,
  userId: string,
  keywords: string[]
): Promise<number> {
  const pool = getPool();

  // First verify list belongs to user
  const list = await getKeywordListById(listId, userId);
  if (!list) {
    throw new Error('List not found or access denied');
  }

  const keywordsNormalized = keywords.map((k) => k.toLowerCase().trim());

  const result = await pool.query(
    `
    DELETE FROM keyword_list_items
    WHERE list_id = $1
      AND keyword_normalized = ANY($2)
    `,
    [listId, keywordsNormalized]
  );

  return result.rowCount || 0;
}

export async function updateListItemPosition(
  itemId: string,
  listId: string,
  userId: string,
  newPosition: number
): Promise<KeywordListItem | null> {
  const pool = getPool();

  // First verify list belongs to user
  const list = await getKeywordListById(listId, userId);
  if (!list) {
    throw new Error('List not found or access denied');
  }

  const result = await pool.query<KeywordListItem>(
    `
    UPDATE keyword_list_items
    SET position = $1
    WHERE id = $2 AND list_id = $3
    RETURNING *
    `,
    [newPosition, itemId, listId]
  );

  return result.rows[0] || null;
}

export async function updateListItemNotes(
  itemId: string,
  listId: string,
  userId: string,
  notes: string
): Promise<KeywordListItem | null> {
  const pool = getPool();

  // First verify list belongs to user
  const list = await getKeywordListById(listId, userId);
  if (!list) {
    throw new Error('List not found or access denied');
  }

  const result = await pool.query<KeywordListItem>(
    `
    UPDATE keyword_list_items
    SET notes = $1
    WHERE id = $2 AND list_id = $3
    RETURNING *
    `,
    [notes, itemId, listId]
  );

  return result.rows[0] || null;
}

// =====================================================
// Utility Functions
// =====================================================

export async function getListsByKeyword(
  keyword: string,
  userId: string
): Promise<KeywordList[]> {
  const pool = getPool();
  const keywordNormalized = keyword.toLowerCase().trim();

  const result = await pool.query<KeywordList>(
    `
    SELECT DISTINCT kl.*
    FROM keyword_lists kl
    INNER JOIN keyword_list_items kli ON kl.id = kli.list_id
    WHERE kl.user_id = $1
      AND kli.keyword_normalized = $2
    ORDER BY kl.is_favorite DESC, kl.created_at DESC
    `,
    [userId, keywordNormalized]
  );

  return result.rows;
}

export async function searchLists(
  userId: string,
  query: string
): Promise<KeywordList[]> {
  const pool = getPool();

  const result = await pool.query<KeywordList>(
    `
    SELECT * FROM keyword_lists
    WHERE user_id = $1
      AND (
        name ILIKE $2
        OR description ILIKE $2
      )
    ORDER BY is_favorite DESC, created_at DESC
    `,
    [userId, `%${query}%`]
  );

  return result.rows;
}
