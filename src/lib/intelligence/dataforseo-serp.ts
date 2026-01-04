/**
 * DataForSEO SERP API Integration
 *
 * For real-time web search results (alternative to Perplexity).
 * Cost: ~$0.002 per SERP query
 *
 * Use cases:
 * - Brand research queries
 * - Competitor discovery
 * - Market research
 */

export interface SerpResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

export interface SerpResponse {
  query: string;
  success: boolean;
  results: SerpResult[];
  totalResults?: number;
  error?: string;
  cost?: number;
}

class DataForSEOSerpClient {
  private login: string;
  private password: string;
  private baseUrl = 'https://api.dataforseo.com/v3';

  constructor() {
    this.login = process.env.DATAFORSEO_LOGIN || '';
    this.password = process.env.DATAFORSEO_PASSWORD || '';
  }

  isConfigured(): boolean {
    return !!this.login && !!this.password;
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.login}:${this.password}`).toString('base64');
  }

  // Live SERP search - real-time results
  async search(query: string, options: {
    location?: string;
    language?: string;
    depth?: number;
  } = {}): Promise<SerpResponse> {
    if (!this.isConfigured()) {
      return {
        query,
        success: false,
        results: [],
        error: 'DataForSEO credentials not configured',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/serp/google/organic/live/advanced`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keyword: query,
          location_name: options.location || 'United States',
          language_name: options.language || 'English',
          depth: options.depth || 10,
        }]),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          query,
          success: false,
          results: [],
          error: `HTTP ${response.status}: ${error}`,
        };
      }

      const data = await response.json();

      if (data.status_code !== 20000 || !data.tasks?.[0]?.result?.[0]) {
        return {
          query,
          success: false,
          results: [],
          error: data.status_message || 'No results',
        };
      }

      const taskResult = data.tasks[0].result[0];
      const items = taskResult.items || [];

      // Filter to organic results only
      const organicResults = items
        .filter((item: any) => item.type === 'organic')
        .map((item: any, index: number) => ({
          title: item.title || '',
          url: item.url || '',
          description: item.description || '',
          position: item.rank_absolute || index + 1,
        }));

      return {
        query,
        success: true,
        results: organicResults,
        totalResults: taskResult.se_results_count,
        cost: 0.002, // Approximate cost per query
      };
    } catch (error) {
      return {
        query,
        success: false,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Search multiple queries in parallel
  async searchMultiple(queries: string[], options?: {
    location?: string;
    language?: string;
    depth?: number;
  }): Promise<SerpResponse[]> {
    return Promise.all(queries.map(q => this.search(q, options)));
  }

  // Search for brand information
  async searchBrand(brandName: string): Promise<{
    general: SerpResponse;
    news: SerpResponse;
    reviews: SerpResponse;
  }> {
    const [general, news, reviews] = await Promise.all([
      this.search(`${brandName} company`),
      this.search(`${brandName} news 2025`),
      this.search(`${brandName} reviews`),
    ]);

    return { general, news, reviews };
  }

  // Search for competitors
  async findCompetitors(domain: string, industry: string): Promise<SerpResponse> {
    return this.search(`${industry} competitors similar to ${domain}`);
  }

  // Format SERP results for AI consumption
  formatForAI(response: SerpResponse): string {
    if (!response.success || response.results.length === 0) {
      return `No results found for: ${response.query}`;
    }

    const formatted = response.results
      .slice(0, 5) // Top 5 results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`)
      .join('\n\n');

    return `Search results for: ${response.query}\n\n${formatted}`;
  }
}

// Singleton instance
export const dataforseoSerp = new DataForSEOSerpClient();

// Quick search function
export async function webSearch(query: string): Promise<SerpResult[]> {
  const response = await dataforseoSerp.search(query);
  if (!response.success) {
    throw new Error(response.error || 'Search failed');
  }
  return response.results;
}

// Multi-query search with formatted output
export async function researchTopic(queries: string[]): Promise<string> {
  const responses = await dataforseoSerp.searchMultiple(queries);
  return responses
    .map(r => dataforseoSerp.formatForAI(r))
    .join('\n\n---\n\n');
}
