/**
 * Crawl4AI Integration
 *
 * Self-hosted website scraper that returns markdown content.
 * Configured at: http://38.97.60.181:11235
 * Cost: FREE (self-hosted)
 */

export interface CrawlResult {
  url: string;
  success: boolean;
  markdown: string;
  html?: string;
  title?: string;
  description?: string;
  error?: string;
  metadata?: {
    links?: Array<{ href: string; text: string }>;
    images?: Array<{ src: string; alt: string }>;
  };
}

export interface CrawlOptions {
  priority?: number;
  wait_for_selector?: string;
  wait_time?: number;
  extract_links?: boolean;
  extract_images?: boolean;
  screenshot?: boolean;
}

class Crawl4AIClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.CRAWL4AI_URL || 'http://38.97.60.181:11235';
    this.token = process.env.CRAWL4AI_TOKEN || 'crawl4ai_secret_token';
  }

  isConfigured(): boolean {
    return !!this.baseUrl && !!this.token;
  }

  async crawl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
    try {
      const response = await fetch(`${this.baseUrl}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          urls: [url],
          priority: options.priority ?? 10,
          wait_for_selector: options.wait_for_selector,
          wait_time: options.wait_time,
          extract_links: options.extract_links ?? true,
          extract_images: options.extract_images ?? false,
          screenshot: options.screenshot ?? false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          url,
          success: false,
          markdown: '',
          error: `HTTP ${response.status}: ${error}`,
        };
      }

      const data = await response.json();

      // Crawl4AI returns results array
      const result = data.results?.[0] || data;

      return {
        url,
        success: result.success ?? true,
        markdown: result.markdown || result.content || '',
        html: result.html,
        title: result.metadata?.title || this.extractTitle(result.markdown || ''),
        description: result.metadata?.description,
        metadata: {
          links: result.links,
          images: result.images,
        },
      };
    } catch (error) {
      return {
        url,
        success: false,
        markdown: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Crawl multiple URLs in parallel
  async crawlMultiple(urls: string[], options: CrawlOptions = {}): Promise<CrawlResult[]> {
    const results = await Promise.all(
      urls.map(url => this.crawl(url, options))
    );
    return results;
  }

  // Keywords that indicate an "about" page
  private aboutKeywords = [
    'about', 'about us', 'about-us', 'about me', 'about-me',
    'who we are', 'who-we-are', 'our story', 'our-story',
    'company', 'team', 'our team', 'our-team', 'meet the team',
    'mission', 'our mission', 'vision', 'values',
    'history', 'our history', 'background', 'who is',
    'meet us', 'learn more', 'get to know us', 'discover us'
  ];

  // Find about-like pages from homepage links
  findAboutLinks(links: Array<{ href: string; text: string }> | undefined, baseUrl: string): string[] {
    if (!links || links.length === 0) return [];

    const aboutUrls: string[] = [];
    const seenPaths = new Set<string>();

    for (const link of links) {
      const text = (link.text || '').toLowerCase().trim();
      const href = (link.href || '').toLowerCase();

      // Check if link text or URL contains about keywords
      const isAboutLink = this.aboutKeywords.some(keyword =>
        text.includes(keyword) || href.includes(keyword.replace(/\s+/g, '-'))
      );

      if (isAboutLink && link.href) {
        // Normalize the URL
        let fullUrl = link.href;
        if (fullUrl.startsWith('/')) {
          fullUrl = `${baseUrl}${fullUrl}`;
        } else if (!fullUrl.startsWith('http')) {
          fullUrl = `${baseUrl}/${fullUrl}`;
        }

        // Skip if it's an external link or already seen
        const path = new URL(fullUrl).pathname;
        if (fullUrl.includes(baseUrl.replace('https://', '').replace('http://', '')) && !seenPaths.has(path)) {
          seenPaths.add(path);
          aboutUrls.push(fullUrl);
        }
      }
    }

    return aboutUrls.slice(0, 5); // Limit to 5 candidates
  }

  // Crawl a website's main pages (homepage + about) with smart discovery
  async crawlBrandPages(domain: string): Promise<{
    homepage: CrawlResult;
    about: CrawlResult | null;
    aboutSource: string;
    success: boolean;
  }> {
    // Normalize domain
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const baseUrl = `https://${cleanDomain}`;

    // Crawl homepage WITH link extraction
    const homepage = await this.crawl(baseUrl, { extract_links: true });

    // Try to find and crawl about page
    let about: CrawlResult | null = null;
    let aboutSource = '';

    // STRATEGY 1: Try common hardcoded paths first (fast)
    const commonPaths = ['/about', '/about-us', '/company', '/who-we-are'];
    for (const path of commonPaths) {
      const aboutResult = await this.crawl(`${baseUrl}${path}`);
      if (aboutResult.success && aboutResult.markdown.length > 300) {
        about = aboutResult;
        aboutSource = `Common path: ${path}`;
        console.log(`[Crawl4AI] Found about page at common path: ${path}`);
        break;
      }
    }

    // STRATEGY 2: If not found, look at homepage links for about-like pages
    if (!about && homepage.metadata?.links) {
      const aboutCandidates = this.findAboutLinks(homepage.metadata.links, baseUrl);
      console.log(`[Crawl4AI] Found ${aboutCandidates.length} about-like links on homepage:`, aboutCandidates);

      for (const candidateUrl of aboutCandidates) {
        // Skip if we already tried this as a common path
        const path = new URL(candidateUrl).pathname;
        if (commonPaths.includes(path)) continue;

        const aboutResult = await this.crawl(candidateUrl);
        if (aboutResult.success && aboutResult.markdown.length > 300) {
          about = aboutResult;
          aboutSource = `Discovered link: ${path}`;
          console.log(`[Crawl4AI] Found about page via link discovery: ${path}`);
          break;
        }
      }
    }

    // STRATEGY 3: Try more path variations
    if (!about) {
      const morePaths = [
        '/our-story', '/our-team', '/team', '/mission',
        '/about/company', '/about/team', '/en/about', '/en/about-us'
      ];
      for (const path of morePaths) {
        const aboutResult = await this.crawl(`${baseUrl}${path}`);
        if (aboutResult.success && aboutResult.markdown.length > 300) {
          about = aboutResult;
          aboutSource = `Extended path: ${path}`;
          console.log(`[Crawl4AI] Found about page at extended path: ${path}`);
          break;
        }
      }
    }

    return {
      homepage,
      about,
      aboutSource: aboutSource || 'Not found',
      success: homepage.success,
    };
  }

  // Extract title from markdown
  private extractTitle(markdown: string): string {
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1];

    const titleMatch = markdown.match(/^(.+)\n={3,}/m);
    if (titleMatch) return titleMatch[1];

    return '';
  }

  // Clean markdown for AI processing
  cleanMarkdown(markdown: string): string {
    return markdown
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      // Remove image references (keep alt text)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove link URLs but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Trim
      .trim();
  }

  // Extract key sections from markdown
  extractSections(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = markdown.split('\n');

    let currentSection = 'intro';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headerMatch) {
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        currentSection = headerMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '_');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }
}

// Singleton instance
export const crawl4ai = new Crawl4AIClient();

// Quick function to scrape a page
export async function scrapePage(url: string): Promise<string> {
  const result = await crawl4ai.crawl(url);
  if (!result.success) {
    throw new Error(result.error || 'Failed to scrape page');
  }
  return crawl4ai.cleanMarkdown(result.markdown);
}

// Quick function to scrape brand pages
export async function scrapeBrandWebsite(domain: string): Promise<{
  homepage: string;
  about: string | null;
  aboutSource: string;
  title: string;
}> {
  const results = await crawl4ai.crawlBrandPages(domain);
  return {
    homepage: crawl4ai.cleanMarkdown(results.homepage.markdown),
    about: results.about ? crawl4ai.cleanMarkdown(results.about.markdown) : null,
    aboutSource: results.aboutSource,
    title: results.homepage.title || domain,
  };
}
