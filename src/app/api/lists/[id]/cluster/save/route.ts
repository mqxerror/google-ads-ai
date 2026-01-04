/**
 * Save Clusters API - Persist clusters as new keyword lists
 *
 * Options:
 * - Save each cluster as a separate list
 * - Naming pattern: "[Parent List] - [Cluster Name]"
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

// Cluster colors for new lists
const CLUSTER_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#14B8A6', '#6366F1', '#84CC16', '#F97316',
];

interface ClusterToSave {
  name: string;
  keywords: Array<{
    keyword: string;
    volume: number | null;
    cpc: number | null;
  }>;
  color?: string;
}

interface SaveClustersRequest {
  clusters: ClusterToSave[];
  saveMode: 'separate' | 'single';  // 'separate' = each cluster as list, 'single' = all in one list with tags
  parentListName?: string;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: parentListId } = await context.params;
    const body: SaveClustersRequest = await request.json();
    const { clusters, saveMode = 'separate', parentListName } = body;

    if (!clusters || clusters.length === 0) {
      return NextResponse.json({ error: 'No clusters to save' }, { status: 400 });
    }

    const db = getPool();
    const userId = session.user.email;
    const savedLists: { id: string; name: string; keywordCount: number }[] = [];

    if (saveMode === 'separate') {
      // Create a separate list for each cluster
      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const listName = parentListName
          ? `${parentListName} - ${cluster.name}`
          : cluster.name;
        const color = cluster.color || CLUSTER_COLORS[i % CLUSTER_COLORS.length];

        // Create the list
        const listResult = await db.query<{ id: string }>(
          `INSERT INTO keyword_lists (user_id, name, description, color, icon, is_favorite)
           VALUES ($1, $2, $3, $4, $5, false)
           ON CONFLICT (user_id, name) DO UPDATE SET
             description = EXCLUDED.description,
             updated_at = NOW()
           RETURNING id`,
          [
            userId,
            listName,
            `Cluster from "${parentListName || 'clustering'}" with ${cluster.keywords.length} keywords`,
            color,
            '🎯',
          ]
        );

        const newListId = listResult.rows[0].id;

        // Add keywords to the list
        let addedCount = 0;
        for (const kw of cluster.keywords) {
          const keywordNormalized = kw.keyword.toLowerCase().trim();

          try {
            await db.query(
              `INSERT INTO keyword_list_items (
                list_id, keyword, keyword_normalized,
                snapshot_search_volume, snapshot_cpc, notes
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (list_id, keyword_normalized) DO NOTHING`,
              [
                newListId,
                kw.keyword,
                keywordNormalized,
                kw.volume,
                kw.cpc,
                `From cluster: ${cluster.name}`,
              ]
            );
            addedCount++;
          } catch (err) {
            // Skip duplicates
          }
        }

        savedLists.push({
          id: newListId,
          name: listName,
          keywordCount: addedCount,
        });
      }
    } else {
      // Single list mode - combine all clusters into one list with notes
      const combinedName = parentListName
        ? `${parentListName} - Clustered`
        : 'Clustered Keywords';

      // Create single list
      const listResult = await db.query<{ id: string }>(
        `INSERT INTO keyword_lists (user_id, name, description, color, icon, is_favorite)
         VALUES ($1, $2, $3, $4, $5, false)
         ON CONFLICT (user_id, name) DO UPDATE SET
           description = EXCLUDED.description,
           updated_at = NOW()
         RETURNING id`,
        [
          userId,
          combinedName,
          `Combined clusters with ${clusters.reduce((sum, c) => sum + c.keywords.length, 0)} keywords`,
          '#8B5CF6',
          '📊',
        ]
      );

      const newListId = listResult.rows[0].id;
      let totalAdded = 0;

      // Add keywords from all clusters with cluster name in notes
      for (const cluster of clusters) {
        for (const kw of cluster.keywords) {
          const keywordNormalized = kw.keyword.toLowerCase().trim();

          try {
            await db.query(
              `INSERT INTO keyword_list_items (
                list_id, keyword, keyword_normalized,
                snapshot_search_volume, snapshot_cpc, notes
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (list_id, keyword_normalized) DO NOTHING`,
              [
                newListId,
                kw.keyword,
                keywordNormalized,
                kw.volume,
                kw.cpc,
                `Cluster: ${cluster.name}`,
              ]
            );
            totalAdded++;
          } catch (err) {
            // Skip duplicates
          }
        }
      }

      savedLists.push({
        id: newListId,
        name: combinedName,
        keywordCount: totalAdded,
      });
    }

    console.log(`[Save Clusters] Saved ${savedLists.length} lists with ${savedLists.reduce((s, l) => s + l.keywordCount, 0)} total keywords`);

    return NextResponse.json({
      success: true,
      savedLists,
      message: saveMode === 'separate'
        ? `Created ${savedLists.length} new lists from clusters`
        : `Created 1 combined list with all clusters`,
    });

  } catch (error) {
    console.error('[Save Clusters] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save clusters' },
      { status: 500 }
    );
  }
}
