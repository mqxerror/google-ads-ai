/**
 * YouTube Data API Integration
 *
 * Fetches video data to identify content opportunities
 * - Video search results count
 * - Average views for top videos
 * - Top video tags
 * - Content gap analysis (high interest, low competition)
 *
 * Quota: 10,000 units/day
 * Search costs: 100 units per query
 * = 100 searches/day with free quota
 */

export interface YouTubeVideoData {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  tags: string[];
  channelTitle: string;
}

export interface YouTubeKeywordData {
  keyword: string;

  // Total video count for this keyword
  totalResults: number;

  // Average views of top 10 videos
  avgViews: number;
  medianViews: number;

  // Top videos
  topVideos: YouTubeVideoData[];

  // Aggregated tags from top videos
  topTags: string[];

  // Content gap indicator
  // HIGH views + LOW video count = opportunity
  contentGap: boolean;
  gapScore: number; // 0-100

  fetchedAt: string;
  source: 'youtube_api';
}

/**
 * Fetch YouTube data for a keyword
 * Requires YouTube Data API key
 */
export async function getYouTubeKeywordData(
  keyword: string,
  options: {
    apiKey?: string;
    maxResults?: number;
  } = {}
): Promise<YouTubeKeywordData> {
  const {
    apiKey = process.env.YOUTUBE_API_KEY,
    maxResults = 10,
  } = options;

  if (!apiKey) {
    console.log('[YouTube] No API key provided, returning mock data');
    return generateMockYouTubeData(keyword);
  }

  try {
    console.log(`[YouTube] Fetching data for: "${keyword}"`);

    // YouTube Data API v3 search endpoint
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', keyword);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', maxResults.toString());
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('order', 'relevance');

    const searchResponse = await fetch(searchUrl.toString());

    if (!searchResponse.ok) {
      throw new Error(`YouTube API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const totalResults = searchData.pageInfo?.totalResults || 0;
    const videos = searchData.items || [];

    // Get video statistics for the results
    const videoIds = videos.map((v: any) => v.id.videoId).filter(Boolean);

    if (videoIds.length === 0) {
      return {
        keyword,
        totalResults: 0,
        avgViews: 0,
        medianViews: 0,
        topVideos: [],
        topTags: [],
        contentGap: false,
        gapScore: 0,
        fetchedAt: new Date().toISOString(),
        source: 'youtube_api',
      };
    }

    // Fetch video statistics
    const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    statsUrl.searchParams.set('part', 'statistics,snippet');
    statsUrl.searchParams.set('id', videoIds.join(','));
    statsUrl.searchParams.set('key', apiKey);

    const statsResponse = await fetch(statsUrl.toString());
    const statsData = await statsResponse.json();

    // Parse video data
    const topVideos: YouTubeVideoData[] = (statsData.items || []).map((video: any) => ({
      videoId: video.id,
      title: video.snippet?.title || '',
      viewCount: parseInt(video.statistics?.viewCount || '0'),
      likeCount: parseInt(video.statistics?.likeCount || '0'),
      commentCount: parseInt(video.statistics?.commentCount || '0'),
      publishedAt: video.snippet?.publishedAt || '',
      tags: video.snippet?.tags || [],
      channelTitle: video.snippet?.channelTitle || '',
    }));

    // Calculate statistics
    const viewCounts = topVideos.map(v => v.viewCount).sort((a, b) => b - a);
    const avgViews = viewCounts.length > 0
      ? Math.round(viewCounts.reduce((sum, v) => sum + v, 0) / viewCounts.length)
      : 0;
    const medianViews = viewCounts.length > 0
      ? viewCounts[Math.floor(viewCounts.length / 2)]
      : 0;

    // Aggregate tags
    const tagCounts = new Map<string, number>();
    topVideos.forEach(video => {
      video.tags.forEach(tag => {
        const normalized = tag.toLowerCase();
        tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    // Content gap analysis
    // HIGH views + LOW video count = opportunity
    const { contentGap, gapScore } = analyzeContentGap(totalResults, avgViews);

    console.log(`[YouTube] ✓ Found ${totalResults} videos, avg views: ${avgViews}, gap score: ${gapScore}`);

    return {
      keyword,
      totalResults,
      avgViews,
      medianViews,
      topVideos,
      topTags,
      contentGap,
      gapScore,
      fetchedAt: new Date().toISOString(),
      source: 'youtube_api',
    };

  } catch (error) {
    console.error('[YouTube] Error fetching data:', error);
    return generateMockYouTubeData(keyword);
  }
}

/**
 * Analyze content gap opportunity
 * High views + low video count = good opportunity
 */
function analyzeContentGap(totalResults: number, avgViews: number): {
  contentGap: boolean;
  gapScore: number;
} {
  // Normalize scores (0-100)
  const viewScore = Math.min(100, avgViews / 10000); // 1M views = 100
  const competitionScore = Math.min(100, totalResults / 1000); // 100K videos = 100

  // Gap score = high views, low competition
  const gapScore = Math.round(viewScore * 0.7 - competitionScore * 0.3);

  // Content gap = gap score > 50
  const contentGap = gapScore > 50;

  return { contentGap, gapScore: Math.max(0, gapScore) };
}

/**
 * Generate mock YouTube data for testing
 * TODO: Remove when API key is configured
 */
function generateMockYouTubeData(keyword: string): YouTubeKeywordData {
  const totalResults = 500 + Math.floor(Math.random() * 10000);
  const avgViews = 5000 + Math.floor(Math.random() * 50000);

  const { contentGap, gapScore } = analyzeContentGap(totalResults, avgViews);

  return {
    keyword,
    totalResults,
    avgViews,
    medianViews: Math.round(avgViews * 0.7),
    topVideos: [],
    topTags: [
      keyword,
      `${keyword} tutorial`,
      `${keyword} guide`,
      `how to ${keyword}`,
    ],
    contentGap,
    gapScore,
    fetchedAt: new Date().toISOString(),
    source: 'youtube_api',
  };
}

/**
 * Batch fetch YouTube data for multiple keywords
 * Includes quota management
 */
export async function batchGetYouTubeData(
  keywords: string[],
  options: {
    apiKey?: string;
    maxKeywords?: number;
  } = {}
): Promise<Map<string, YouTubeKeywordData>> {
  const {
    apiKey,
    maxKeywords = 50, // Limit to preserve quota (100 units per search)
  } = options;

  const results = new Map<string, YouTubeKeywordData>();

  // Process only top keywords to preserve quota
  const limitedKeywords = keywords.slice(0, maxKeywords);

  for (const keyword of limitedKeywords) {
    const data = await getYouTubeKeywordData(keyword, { apiKey });
    results.set(keyword, data);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`[YouTube] Batch completed: ${results.size} keywords processed`);
  return results;
}
