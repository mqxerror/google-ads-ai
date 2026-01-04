import OpenAI from 'openai';

// Timeout wrapper utility for promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// OpenAI client singleton
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

// =============================================================================
// EMBEDDING MODEL CONFIGURATION
// =============================================================================
// text-embedding-3-small: $0.00002/1K tokens (62% cheaper than ada-002)
// text-embedding-3-large: $0.00013/1K tokens (higher quality)
// text-embedding-ada-002: $0.0001/1K tokens (legacy)
// =============================================================================

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSION = 1536; // Can be 512, 1024, or 1536 for text-embedding-3-*
export const EMBEDDING_VERSION = '2'; // Increment when changing models

// Supported models for migration
export const SUPPORTED_MODELS = {
  'text-embedding-3-small': { dimensions: [512, 1024, 1536], costPer1K: 0.00002 },
  'text-embedding-3-large': { dimensions: [256, 1024, 3072], costPer1K: 0.00013 },
  'text-embedding-ada-002': { dimensions: [1536], costPer1K: 0.0001 },
} as const;

// Embedding metadata for storage (with versioning)
export interface EmbeddingMetadata {
  model: string;
  dimensions: number;
  version: string;
  createdAt: string;
}

// Get current embedding metadata
export function getEmbeddingMetadata(): EmbeddingMetadata {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSION,
    version: EMBEDDING_VERSION,
    createdAt: new Date().toISOString(),
  };
}

// Check if embedding needs re-generation (model mismatch)
export function needsReembedding(storedModel: string, storedVersion?: string): boolean {
  return storedModel !== EMBEDDING_MODEL || (storedVersion !== undefined && storedVersion !== EMBEDDING_VERSION);
}

// =============================================================================
// IN-MEMORY CACHE (for frequently accessed embeddings)
// =============================================================================
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour TTL
const MAX_CACHE_SIZE = 1000; // Max cached embeddings

function getCacheKey(text: string): string {
  return `${EMBEDDING_MODEL}:${EMBEDDING_VERSION}:${text.toLowerCase().trim()}`;
}

function getFromCache(text: string): number[] | null {
  const key = getCacheKey(text);
  const cached = embeddingCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.embedding;
  }
  if (cached) {
    embeddingCache.delete(key); // Expired
  }
  return null;
}

function setInCache(text: string, embedding: number[]): void {
  // Evict oldest entries if cache is full
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey) embeddingCache.delete(oldestKey);
  }
  const key = getCacheKey(text);
  embeddingCache.set(key, { embedding, timestamp: Date.now() });
}

// Cache stats for monitoring
export function getCacheStats(): { size: number; maxSize: number; hitRate: string } {
  return {
    size: embeddingCache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: 'N/A', // Would need hit/miss counters for accurate rate
  };
}

// Clear cache (useful when switching models)
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

// =============================================================================
// EMBEDDING GENERATION
// =============================================================================

// Generate embedding for a single text (with caching)
export async function generateEmbedding(text: string): Promise<number[]> {
  const normalizedText = text.trim().toLowerCase();

  // Check cache first
  const cached = getFromCache(normalizedText);
  if (cached) {
    return cached;
  }

  const client = getOpenAIClient();

  const response = await withTimeout(
    client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: normalizedText,
      dimensions: EMBEDDING_DIMENSION, // text-embedding-3-* supports custom dimensions
    }),
    20000, // 20 second timeout
    'OpenAI embeddings request timed out'
  );

  const embedding = response.data[0].embedding;

  // Cache the result
  setInCache(normalizedText, embedding);

  return embedding;
}

// Generate embeddings for multiple texts (batch processing with caching)
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const normalizedTexts = texts.map(t => t.trim().toLowerCase());

  // Check cache for each text
  const results: (number[] | null)[] = normalizedTexts.map(t => getFromCache(t));
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  results.forEach((result, index) => {
    if (result === null) {
      uncachedIndices.push(index);
      uncachedTexts.push(normalizedTexts[index]);
    }
  });

  // If all cached, return early
  if (uncachedTexts.length === 0) {
    return results as number[][];
  }

  // Batch process uncached texts
  // OpenAI supports up to 2048 inputs per request
  const BATCH_SIZE = 2048;
  const newEmbeddings: number[][] = [];

  for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
    const batch = uncachedTexts.slice(i, i + BATCH_SIZE);

    const response = await withTimeout(
      client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSION,
      }),
      20000, // 20 second timeout
      'OpenAI embeddings request timed out'
    );

    // Sort by index to ensure order is preserved
    const sortedEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);

    newEmbeddings.push(...sortedEmbeddings);
  }

  // Cache new embeddings and fill results
  newEmbeddings.forEach((embedding, i) => {
    const originalIndex = uncachedIndices[i];
    const text = uncachedTexts[i];
    setInCache(text, embedding);
    results[originalIndex] = embedding;
  });

  return results as number[][];
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Find the centroid of multiple embeddings
export function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot calculate centroid of empty array');
  }

  const dimension = embeddings[0].length;
  const centroid = new Array(dimension).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      centroid[i] += embedding[i];
    }
  }

  for (let i = 0; i < dimension; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

// Simple k-means clustering
export interface Cluster {
  centroid: number[];
  items: { index: number; embedding: number[] }[];
}

export function kMeansClustering(
  embeddings: number[][],
  k: number,
  maxIterations: number = 100
): Cluster[] {
  if (embeddings.length < k) {
    // If we have fewer items than clusters, each item is its own cluster
    return embeddings.map((embedding, index) => ({
      centroid: embedding,
      items: [{ index, embedding }],
    }));
  }

  // Initialize centroids using k-means++ style initialization
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();

  // First centroid is random
  const firstIndex = Math.floor(Math.random() * embeddings.length);
  centroids.push([...embeddings[firstIndex]]);
  usedIndices.add(firstIndex);

  // Remaining centroids chosen with probability proportional to distance
  while (centroids.length < k) {
    let maxDist = -1;
    let bestIndex = -1;

    for (let i = 0; i < embeddings.length; i++) {
      if (usedIndices.has(i)) continue;

      // Find minimum distance to any existing centroid
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = 1 - cosineSimilarity(embeddings[i], centroid);
        minDist = Math.min(minDist, dist);
      }

      if (minDist > maxDist) {
        maxDist = minDist;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      centroids.push([...embeddings[bestIndex]]);
      usedIndices.add(bestIndex);
    }
  }

  // Iterate
  let assignments: number[] = new Array(embeddings.length).fill(-1);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each point to nearest centroid
    const newAssignments: number[] = [];
    for (let i = 0; i < embeddings.length; i++) {
      let bestCluster = 0;
      let bestSimilarity = -Infinity;

      for (let c = 0; c < centroids.length; c++) {
        const similarity = cosineSimilarity(embeddings[i], centroids[c]);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = c;
        }
      }

      newAssignments.push(bestCluster);
    }

    // Check for convergence
    const converged = newAssignments.every((a, i) => a === assignments[i]);
    assignments = newAssignments;

    if (converged) break;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterEmbeddings = embeddings.filter((_, i) => assignments[i] === c);
      if (clusterEmbeddings.length > 0) {
        centroids[c] = calculateCentroid(clusterEmbeddings);
      }
    }
  }

  // Build result clusters
  const clusters: Cluster[] = centroids.map(centroid => ({
    centroid,
    items: [],
  }));

  for (let i = 0; i < embeddings.length; i++) {
    clusters[assignments[i]].items.push({
      index: i,
      embedding: embeddings[i],
    });
  }

  // Filter out empty clusters
  return clusters.filter(c => c.items.length > 0);
}

// Agglomerative clustering with similarity threshold
export function clusterBySimilarity(
  embeddings: number[][],
  similarityThreshold: number = 0.8,
  minClusterSize: number = 2
): Cluster[] {
  if (embeddings.length === 0) {
    return [];
  }

  // Start with each item in its own cluster
  const clusters: Cluster[] = embeddings.map((embedding, index) => ({
    centroid: embedding,
    items: [{ index, embedding }],
  }));

  // Merge clusters until no more merges possible
  let merged = true;
  while (merged) {
    merged = false;
    let bestI = -1;
    let bestJ = -1;
    let bestSimilarity = -Infinity;

    // Find most similar pair of clusters
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const similarity = cosineSimilarity(clusters[i].centroid, clusters[j].centroid);
        if (similarity > bestSimilarity && similarity >= similarityThreshold) {
          bestSimilarity = similarity;
          bestI = i;
          bestJ = j;
        }
      }
    }

    // Merge if found
    if (bestI >= 0 && bestJ >= 0) {
      const mergedItems = [...clusters[bestI].items, ...clusters[bestJ].items];
      const mergedEmbeddings = mergedItems.map(item => item.embedding);
      const newCentroid = calculateCentroid(mergedEmbeddings);

      clusters[bestI] = {
        centroid: newCentroid,
        items: mergedItems,
      };
      clusters.splice(bestJ, 1);
      merged = true;
    }
  }

  // Filter by minimum size
  return clusters.filter(c => c.items.length >= minClusterSize);
}

// Format embedding for PostgreSQL vector type
export function formatEmbeddingForPostgres(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// Parse embedding from PostgreSQL vector type
export function parseEmbeddingFromPostgres(vectorString: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vectorString.replace(/[\[\]]/g, '');
  return cleaned.split(',').map(Number);
}
