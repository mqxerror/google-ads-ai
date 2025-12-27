import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddings, kMeansClustering } from '@/lib/embeddings';
import { GeneratedKeyword } from '@/app/keyword-factory/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ClusterRequest {
  keywords: GeneratedKeyword[];
  minClusterSize?: number;
  maxClusters?: number;
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

    const { keywords, minClusterSize = 3, maxClusters = 7 } = body;

    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: 'No keywords provided' },
        { status: 400 }
      );
    }

    // Generate embeddings for all keywords
    const keywordTexts = keywords.map((kw) => kw.keyword);
    console.log(`[Cluster API] Generating embeddings for ${keywordTexts.length} keywords...`);

    const embeddings = await generateEmbeddings(keywordTexts);

    // Determine optimal number of clusters
    const numKeywords = keywords.length;
    let k = Math.min(maxClusters, Math.max(2, Math.ceil(numKeywords / minClusterSize)));

    // Cluster keywords using k-means
    console.log(`[Cluster API] Clustering into ${k} groups...`);
    const clusters = kMeansClustering(embeddings, k, 100);

    // Map clusters to ad groups
    const adGroups = clusters
      .filter((cluster) => cluster.items.length >= Math.max(2, minClusterSize - 1)) // Allow slightly smaller clusters
      .map((cluster) => {
        // Get keywords for this cluster
        const clusterKeywords = cluster.items.map((item) => keywords[item.index]);

        // Generate ad group name
        const name = generateAdGroupName(clusterKeywords);

        return {
          name,
          keywords: clusterKeywords,
        };
      });

    // If we have too few ad groups, merge smallest ones
    if (adGroups.length < 2 && keywords.length > 5) {
      // Fallback: create 2-3 balanced groups
      const groupSize = Math.ceil(keywords.length / 3);
      const fallbackGroups = [];

      for (let i = 0; i < keywords.length; i += groupSize) {
        const groupKeywords = keywords.slice(i, i + groupSize);
        fallbackGroups.push({
          name: generateAdGroupName(groupKeywords),
          keywords: groupKeywords,
        });
      }

      return NextResponse.json({
        adGroups: fallbackGroups,
        clustersCount: fallbackGroups.length,
        totalKeywords: keywords.length,
      });
    }

    console.log(`[Cluster API] Created ${adGroups.length} ad groups`);

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
