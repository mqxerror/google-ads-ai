import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddings, kMeansClustering } from '@/lib/embeddings';
import { GeneratedKeyword } from '@/app/keyword-factory/types';

export const runtime = 'nodejs';
export const maxDuration = 30; // Reduced from 60s to prevent long hangs

interface ClusterRequest {
  keywords: GeneratedKeyword[];
  clusterMethod?: 'meaning' | 'similarity';
  sensitivity?: number;
  minClusterSize?: number;
  maxClusters?: number;
}

// Simple fallback clustering when AI embeddings fail
async function simpleFallbackClustering(keywords: GeneratedKeyword[]): Promise<any[]> {
  // Group keywords by first word (simple but fast)
  const groups = new Map<string, GeneratedKeyword[]>();

  keywords.forEach(kw => {
    const firstWord = kw.keyword.split(' ')[0].toLowerCase();
    if (!groups.has(firstWord)) {
      groups.set(firstWord, []);
    }
    groups.get(firstWord)!.push(kw);
  });

  // Convert to ad groups
  const adGroups = Array.from(groups.entries())
    .filter(([_, kws]) => kws.length >= 2) // At least 2 keywords per group
    .map(([word, kws]) => ({
      name: `${word.charAt(0).toUpperCase()}${word.slice(1)} Keywords`,
      keywords: kws,
    }));

  // If we have single keywords, group them together
  const singleKeywords = Array.from(groups.entries())
    .filter(([_, kws]) => kws.length === 1)
    .flatMap(([_, kws]) => kws);

  if (singleKeywords.length > 0) {
    adGroups.push({
      name: 'Other Keywords',
      keywords: singleKeywords,
    });
  }

  return adGroups;
}

// Generate ad group name from cluster keywords
function generateAdGroupName(keywords: GeneratedKeyword[]): string {
  // Extract most common words from keywords
  const wordFrequency = new Map<string, number>();

  keywords.forEach((kw) => {
    const words = kw.keyword.toLowerCase().split(/\s+/);
    words.forEach((word) => {
      // Filter out common words
      const stopWords = ['and', 'or', 'the', 'a', 'an', 'for', 'to', 'in', 'on', 'at', 'with', 'from'];
      if (!stopWords.includes(word) && word.length > 2) {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      }
    });
  });

  // Get top 2-3 most common words
  const sortedWords = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  if (sortedWords.length === 0) {
    return `Ad Group ${Math.random().toString(36).substring(7)}`;
  }

  // Capitalize first letter of each word
  const name = sortedWords
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return name;
}

export async function POST(request: NextRequest) {
  try {
    const body: ClusterRequest = await request.json();

    const {
      keywords,
      clusterMethod = 'similarity',
      sensitivity = 0.2,
      minClusterSize = 3,
      maxClusters = 7
    } = body;

    console.log(`[Cluster API] Settings - Method: ${clusterMethod}, Sensitivity: ${sensitivity}, Min Size: ${minClusterSize}, Max Clusters: ${maxClusters}`);

    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: 'No keywords provided' },
        { status: 400 }
      );
    }

    // Generate embeddings for all keywords
    const keywordTexts = keywords.map((kw) => kw.keyword);
    console.log(`[Cluster API] Generating embeddings for ${keywordTexts.length} keywords...`);

    let embeddings: number[][];
    let usedFallback = false;

    try {
      embeddings = await generateEmbeddings(keywordTexts);
    } catch (error) {
      console.error('[Cluster API] Embeddings failed, using fallback clustering:', error);

      // USE FALLBACK
      const adGroups = await simpleFallbackClustering(keywords);

      return NextResponse.json({
        adGroups,
        clustersCount: adGroups.length,
        totalKeywords: keywords.length,
        fallback: true, // Flag for UI
      });
    }

    // Use maxClusters as the target number of ad groups
    // Sensitivity affects the clustering algorithm's tolerance, not the count
    const numKeywords = keywords.length;

    // Ensure we don't request more clusters than we have keywords
    let k = Math.min(maxClusters, Math.max(1, numKeywords));

    // If we have very few keywords, adjust
    if (numKeywords < maxClusters) {
      k = Math.max(1, Math.floor(numKeywords / 2)); // At least 2 keywords per group when possible
    }

    console.log(`[Cluster API] Target clusters: ${k} (from ${numKeywords} keywords, user requested ${maxClusters})`);

    // Cluster keywords using k-means
    console.log(`[Cluster API] Clustering into ${k} groups...`);
    const clusters = kMeansClustering(embeddings, k, 100);

    // Map clusters to ad groups - DON'T filter out small clusters
    const adGroups = clusters
      .map((cluster) => {
        // Get keywords for this cluster
        const clusterKeywords = cluster.items.map((item) => keywords[item.index]);

        // Generate ad group name
        const name = generateAdGroupName(clusterKeywords);

        return {
          name,
          keywords: clusterKeywords,
        };
      })
      .filter((group) => group.keywords.length > 0); // Only filter out completely empty groups

    console.log(`[Cluster API] Created ${adGroups.length} ad groups (user requested ${maxClusters})`);

    return NextResponse.json({
      adGroups,
      clustersCount: adGroups.length,
      totalKeywords: keywords.length,
    });
  } catch (error) {
    console.error('[Cluster API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cluster keywords', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
