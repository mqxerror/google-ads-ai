/**
 * Clustering API - Generate semantic clusters from keywords
 *
 * OPTIMIZED: Uses smart embedding caching to avoid redundant OpenAI calls
 * - First checks keyword_list_items cache (list-specific)
 * - Then checks keywords table (global cache)
 * - Only calls OpenAI for keywords without cached embeddings
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { getKeywordListById } from '@/lib/database/lists';
import { getSmartEmbeddings } from '@/lib/clustering/smart-embeddings';

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

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Initialize OpenAI client (for cluster naming only)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ClusterResult {
  id: number;
  name: string;
  keywords: Array<{
    keyword: string;
    volume: number | null;
    cpc: number | null;
  }>;
  totalVolume: number;
  avgCpc: number;
  color: string;
}

// Cluster colors
const CLUSTER_COLORS = [
  '#10B981', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#F59E0B', // orange
  '#EF4444', // red
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#F97316', // deep orange
];

// K-means clustering implementation
function kMeansClustering(
  embeddings: number[][],
  k: number,
  maxIterations: number = 100
): number[] {
  const n = embeddings.length;
  if (n === 0) return [];
  if (n <= k) return embeddings.map((_, i) => i);

  const dims = embeddings[0].length;

  // Initialize centroids using k-means++ algorithm
  const centroids: number[][] = [];
  const assignments = new Array(n).fill(0);

  // First centroid is random
  centroids.push([...embeddings[Math.floor(Math.random() * n)]]);

  // Remaining centroids use weighted probability
  for (let c = 1; c < k; c++) {
    const distances = embeddings.map((emb) => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = euclideanDistance(emb, centroid);
        if (dist < minDist) minDist = dist;
      }
      return minDist * minDist; // Squared distance for weighting
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalDist;

    for (let i = 0; i < n; i++) {
      rand -= distances[i];
      if (rand <= 0) {
        centroids.push([...embeddings[i]]);
        break;
      }
    }
  }

  // Iterate until convergence
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign points to nearest centroid
    let changed = false;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let minCluster = 0;

      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(embeddings[i], centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          minCluster = c;
        }
      }

      if (assignments[i] !== minCluster) {
        assignments[i] = minCluster;
        changed = true;
      }
    }

    if (!changed) break;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterPoints = embeddings.filter((_, i) => assignments[i] === c);
      if (clusterPoints.length > 0) {
        centroids[c] = new Array(dims).fill(0);
        for (const point of clusterPoints) {
          for (let d = 0; d < dims; d++) {
            centroids[c][d] += point[d];
          }
        }
        for (let d = 0; d < dims; d++) {
          centroids[c][d] /= clusterPoints.length;
        }
      }
    }
  }

  return assignments;
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Calculate optimal number of clusters using elbow method (simplified)
function calculateOptimalClusters(n: number, sensitivity: number): number {
  // Sensitivity 0 = fewer clusters, 1 = more clusters
  const base = Math.ceil(Math.sqrt(n / 2));
  const min = Math.max(2, Math.floor(base * (1 - sensitivity)));
  const max = Math.min(15, Math.ceil(base * (1 + sensitivity)));
  return Math.min(max, Math.max(min, Math.round(base * (0.5 + sensitivity))));
}

// Generate cluster name using OpenAI
async function generateClusterNames(clusters: ClusterResult[]): Promise<ClusterResult[]> {
  try {
    const prompt = clusters.map((c, i) => {
      const topKeywords = c.keywords.slice(0, 10).map(k => k.keyword).join(', ');
      return `Cluster ${i + 1}: ${topKeywords}`;
    }).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a keyword clustering expert. Generate short, descriptive names (2-4 words) for each keyword cluster. Return ONLY a JSON array of strings with the cluster names, nothing else.',
        },
        {
          role: 'user',
          content: `Generate names for these keyword clusters:\n\n${prompt}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    // Try to parse JSON array from response
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      const names = JSON.parse(match[0]) as string[];
      return clusters.map((c, i) => ({
        ...c,
        name: names[i] || `Cluster ${i + 1}`,
      }));
    }
  } catch (error) {
    console.error('Error generating cluster names:', error);
  }

  // Fallback: use first keyword of each cluster
  return clusters.map((c, i) => ({
    ...c,
    name: c.keywords[0]?.keyword?.split(' ').slice(0, 3).join(' ') || `Cluster ${i + 1}`,
  }));
}

// POST /api/lists/[id]/cluster - Generate clusters for a list
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const {
      method = 'semantic',
      sensitivity = 0.5,
      minClusterSize = 2,
      targetClusters = 'auto',
      skipAiNaming = false,  // Skip AI naming for faster results
    } = body;

    // Get list and keywords
    const list = await getKeywordListById(id, session.user.email);
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Fetch keywords from list
    const db = getPool();
    const itemsResult = await db.query<{
      keyword: string;
      snapshot_search_volume: number | null;
      snapshot_cpc: number | null;
    }>(`
      SELECT keyword, snapshot_search_volume, snapshot_cpc
      FROM keyword_list_items
      WHERE list_id = $1
      ORDER BY position ASC, added_at ASC
    `, [id]);

    if (itemsResult.rows.length === 0) {
      return NextResponse.json({ error: 'List has no keywords' }, { status: 400 });
    }

    const keywords = itemsResult.rows.map(item => ({
      keyword: item.keyword,
      volume: item.snapshot_search_volume,
      cpc: item.snapshot_cpc,
    }));

    console.log(`[Cluster API] Clustering ${keywords.length} keywords using ${method} method`);

    let clusters: ClusterResult[] = [];
    let embeddingStats: { fromListCache: number; fromGlobalCache: number; fromOpenAI: number; costSaved: number } | null = null;

    if (method === 'semantic') {
      // Get embeddings using smart caching (checks DB first, only calls OpenAI for missing)
      const texts = keywords.map(k => k.keyword);

      console.log('[Cluster API] Getting embeddings with smart caching...');
      const { embeddings: embeddingResults, stats } = await getSmartEmbeddings(texts, id, true);

      embeddingStats = {
        fromListCache: stats.fromListCache,
        fromGlobalCache: stats.fromGlobalCache,
        fromOpenAI: stats.fromOpenAI,
        costSaved: stats.costSaved,
      };

      console.log(`[Cluster API] Embeddings: ${stats.fromListCache} from list cache, ${stats.fromGlobalCache} from global cache, ${stats.fromOpenAI} from OpenAI`);
      console.log(`[Cluster API] Estimated cost saved: $${stats.costSaved.toFixed(4)}`);

      // Map embeddings back to keyword order
      const embeddingMap = new Map(
        embeddingResults.map(e => [e.keywordNormalized, e.embedding])
      );
      const embeddings = keywords.map(k => {
        const normalized = k.keyword.toLowerCase().trim();
        return embeddingMap.get(normalized) || [];
      }).filter(e => e.length > 0);

      console.log(`[Cluster API] Using ${embeddings.length} embeddings for clustering`);

      // Calculate number of clusters
      const k = targetClusters === 'auto'
        ? calculateOptimalClusters(keywords.length, sensitivity)
        : Math.min(parseInt(targetClusters), Math.floor(keywords.length / minClusterSize));

      console.log(`[Cluster API] Using ${k} clusters`);

      // Run k-means clustering
      const assignments = kMeansClustering(embeddings, k);

      // Group keywords by cluster
      const clusterMap = new Map<number, typeof keywords>();
      for (let i = 0; i < keywords.length; i++) {
        const clusterId = assignments[i];
        if (!clusterMap.has(clusterId)) {
          clusterMap.set(clusterId, []);
        }
        clusterMap.get(clusterId)!.push(keywords[i]);
      }

      // Convert to result format
      let clusterId = 0;
      clusterMap.forEach((clusterKeywords, _) => {
        if (clusterKeywords.length >= minClusterSize) {
          // Sort by volume within cluster
          clusterKeywords.sort((a, b) => (b.volume || 0) - (a.volume || 0));

          const totalVolume = clusterKeywords.reduce((sum, k) => sum + (k.volume || 0), 0);
          const avgCpc = clusterKeywords.reduce((sum, k) => sum + (k.cpc || 0), 0) / clusterKeywords.length;

          clusters.push({
            id: clusterId,
            name: `Cluster ${clusterId + 1}`,
            keywords: clusterKeywords,
            totalVolume,
            avgCpc: Math.round(avgCpc * 100) / 100,
            color: CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length],
          });
          clusterId++;
        }
      });

      // Sort clusters by total volume
      clusters.sort((a, b) => b.totalVolume - a.totalVolume);

      // Generate smart names (skip if requested for faster results)
      if (!skipAiNaming) {
        clusters = await generateClusterNames(clusters);
      } else {
        // Use first 2-3 words from top keyword as fallback name
        clusters = clusters.map((c, i) => ({
          ...c,
          name: c.keywords[0]?.keyword?.split(' ').slice(0, 3).join(' ') || `Cluster ${i + 1}`,
        }));
      }

    } else if (method === 'ngram') {
      // Simple n-gram clustering (word overlap)
      const wordGroups = new Map<string, typeof keywords>();

      for (const kw of keywords) {
        const words = kw.keyword.toLowerCase().split(/\s+/);
        // Use the most significant word (not stop words)
        const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'is', 'are', 'how', 'what', 'why', 'when', 'where', 'who']);
        const significantWord = words.find(w => !stopWords.has(w) && w.length > 2) || words[0];

        if (!wordGroups.has(significantWord)) {
          wordGroups.set(significantWord, []);
        }
        wordGroups.get(significantWord)!.push(kw);
      }

      // Convert to clusters
      let clusterId = 0;
      wordGroups.forEach((clusterKeywords, word) => {
        if (clusterKeywords.length >= minClusterSize) {
          clusterKeywords.sort((a, b) => (b.volume || 0) - (a.volume || 0));

          const totalVolume = clusterKeywords.reduce((sum, k) => sum + (k.volume || 0), 0);
          const avgCpc = clusterKeywords.reduce((sum, k) => sum + (k.cpc || 0), 0) / clusterKeywords.length;

          clusters.push({
            id: clusterId,
            name: word.charAt(0).toUpperCase() + word.slice(1),
            keywords: clusterKeywords,
            totalVolume,
            avgCpc: Math.round(avgCpc * 100) / 100,
            color: CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length],
          });
          clusterId++;
        }
      });

      clusters.sort((a, b) => b.totalVolume - a.totalVolume);
    }

    // Handle unclustered keywords (those in small clusters)
    const clusteredKeywordSet = new Set(clusters.flatMap(c => c.keywords.map(k => k.keyword)));
    const unclustered = keywords.filter(k => !clusteredKeywordSet.has(k.keyword));

    console.log(`[Cluster API] Created ${clusters.length} clusters, ${unclustered.length} unclustered`);

    return NextResponse.json({
      clusters,
      unclustered,
      stats: {
        totalKeywords: keywords.length,
        clusteredKeywords: keywords.length - unclustered.length,
        clusterCount: clusters.length,
        method,
        // Embedding cache stats (only for semantic method)
        embeddings: embeddingStats ? {
          fromCache: embeddingStats.fromListCache + embeddingStats.fromGlobalCache,
          fromListCache: embeddingStats.fromListCache,
          fromGlobalCache: embeddingStats.fromGlobalCache,
          generated: embeddingStats.fromOpenAI,
          costSaved: `$${embeddingStats.costSaved.toFixed(4)}`,
        } : null,
      },
    });
  } catch (error) {
    console.error('[Cluster API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cluster keywords' },
      { status: 500 }
    );
  }
}
