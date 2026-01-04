/**
 * Brand DNA Analyzer
 *
 * Deep research into a brand's identity, positioning, and values.
 *
 * Process:
 * 1. Scrape website (homepage + about page) with Crawl4AI
 * 2. Search for brand info using DataForSEO SERP
 * 3. Synthesize with OpenRouter (Claude Opus 4.5)
 *
 * Cost estimate: ~$0.15 per brand (with Opus 4.5)
 */

import { crawl4ai, scrapeBrandWebsite } from './crawl4ai';
import { dataforseoSerp, researchTopic } from './dataforseo-serp';
import { openrouter, getStructuredResponse } from './openrouter';
import { Pool } from 'pg';

// PostgreSQL connection
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || '38.97.60.181',
      port: parseInt(process.env.POSTGRES_PORT || '5433'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres123',
      database: process.env.POSTGRES_DATABASE || 'google_ads_manager',
    });
  }
  return pool;
}

export interface BrandDNAInput {
  projectId: string;
  brandName: string;
  domain?: string;
  industry?: string;
}

export interface BrandDNAResult {
  success: boolean;
  brandDnaId?: string;
  report?: {
    missionVision: string;
    brandValues: Array<{ value: string; description: string }>;
    brandPositioning: string;
    uniqueDifferentiators: string[];
    targetMarket: string;
    brandVoice: string;
    companyStory: string;
  };
  cost?: number;
  error?: string;
}

interface StepLog {
  step: string;
  status: 'started' | 'completed' | 'failed';
  message?: string;
  timestamp: string;
  duration_ms?: number;
}

// STOK Prompt for Brand DNA Analysis
const BRAND_DNA_SYSTEM_PROMPT = `**Situation**
You are analyzing a brand to develop a comprehensive Brand DNA profile based on multiple data sources including their website content (homepage and about page), search engine research data, and industry context. This analysis will inform marketing strategy and brand positioning decisions.

**Task**
Analyze the provided brand research data and website content to create a detailed Brand DNA profile in JSON format. The analysis must be specific to this brand with evidence-based insights rather than generic observations. Extract and synthesize information about what makes the brand unique, how their core values manifest in practice, their market positioning, communication style, and brand story.

**Objective**
Produce an actionable Brand DNA profile that marketing teams can use to maintain brand consistency, develop campaigns, and communicate the brand's unique value proposition effectively.

**Knowledge**
Analyze patterns in language, messaging themes, visual descriptions, stated values versus demonstrated behaviors, competitive positioning claims, and historical narrative elements across all provided sources.

**Output Requirements**
For each field:
- **missionVision**: Extract or synthesize the brand's stated or implied mission and vision, citing specific language from the content
- **brandValues**: Identify 3-5 core values with specific descriptions of how each manifests in their actions, products, or communications (not generic definitions)
- **brandPositioning**: Craft one clear, concise positioning statement that captures how they differentiate in their market
- **uniqueDifferentiators**: List 3-5 specific elements that distinguish this brand from competitors, with evidence from the content
- **targetMarket**: Define their primary audience with demographic, psychographic, or behavioral specifics found in the content
- **brandVoice**: Describe their communication style using specific examples of tone, language patterns, and messaging approach
- **companyStory**: Write 2-3 paragraphs narrating their origin, evolution, and journey based on available information
- **keyMilestones**: List notable achievements, launches, or pivotal moments mentioned in the content
- **brandKeywords**: Identify 5-10 terms or phrases the brand uses consistently that reflect their identity

When evidence is limited for any field, synthesize insights from available data rather than leaving fields empty, while noting when information is inferred versus explicitly stated. Prioritize specificity over generalization and always cite which source (homepage, about page, or search data) supports each insight.

Respond ONLY with valid JSON matching the schema. Do not include any text before or after the JSON.`;

const BRAND_DNA_JSON_SCHEMA = `{
  "missionVision": "string - The brand's stated or implied mission and vision with citations",
  "brandValues": [
    {
      "value": "string - Core value name",
      "description": "string - Specific evidence of how this value manifests"
    }
  ],
  "brandPositioning": "string - One clear, concise positioning statement",
  "uniqueDifferentiators": ["string - Specific distinguishing elements with evidence (3-5 items)"],
  "targetMarket": "string - Primary audience with demographic/psychographic specifics",
  "brandVoice": "string - Communication style with specific examples",
  "companyStory": "string - 2-3 paragraph narrative of origin and evolution",
  "keyMilestones": ["string - Notable achievements or pivotal moments"],
  "brandKeywords": ["string - 5-10 consistently used terms reflecting identity"]
}`;

// Helper to update step status in database
async function updateStep(
  db: Pool,
  projectId: string,
  step: string,
  progress: number,
  message: string,
  stepsLog: StepLog[]
) {
  await db.query(
    `UPDATE brand_dna SET
      current_step = $2,
      step_progress = $3,
      step_message = $4,
      steps_log = $5,
      updated_at = NOW()
    WHERE project_id = $1`,
    [projectId, step, progress, message, JSON.stringify(stepsLog)]
  );
}

// Helper to add step to log
function logStep(
  stepsLog: StepLog[],
  step: string,
  status: 'started' | 'completed' | 'failed',
  message?: string,
  startTime?: number
): StepLog[] {
  const entry: StepLog = {
    step,
    status,
    message,
    timestamp: new Date().toISOString(),
    duration_ms: startTime ? Date.now() - startTime : undefined,
  };
  return [...stepsLog, entry];
}

export async function analyzeBrandDNA(input: BrandDNAInput): Promise<BrandDNAResult> {
  const db = getPool();
  let totalCost = 0;
  let stepsLog: StepLog[] = [];
  const analysisStartTime = Date.now();

  try {
    // ========== STEP 1: INITIALIZING ==========
    let stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'initializing', 'started', 'Setting up analysis');
    await updateStep(db, input.projectId, 'initializing', 5, 'Setting up analysis...', stepsLog);

    console.log(`[Brand DNA] Starting analysis for ${input.brandName}`);

    // Update status
    await db.query(
      `UPDATE brand_dna SET status = 'researching', updated_at = NOW() WHERE project_id = $1`,
      [input.projectId]
    );

    stepsLog = logStep(stepsLog, 'initializing', 'completed', 'Ready to analyze', stepStartTime);
    await updateStep(db, input.projectId, 'initializing', 10, 'Initialization complete', stepsLog);

    // ========== STEP 2: SCRAPING HOMEPAGE ==========
    let websiteContent = { homepage: '', about: null as string | null, aboutSource: '', title: '' };

    if (input.domain) {
      stepStartTime = Date.now();
      stepsLog = logStep(stepsLog, 'scraping_homepage', 'started', `Connecting to ${input.domain}`);
      await updateStep(db, input.projectId, 'scraping_homepage', 15, `Scraping ${input.domain}...`, stepsLog);

      try {
        // Use the improved crawlBrandPages method that does smart about-page discovery
        const { crawl4ai: crawler } = await import('./crawl4ai');
        const crawlResults = await crawler.crawlBrandPages(input.domain);

        if (crawlResults.success) {
          websiteContent.homepage = crawler.cleanMarkdown(crawlResults.homepage.markdown);
          websiteContent.title = crawlResults.homepage.title || input.domain;
          console.log(`[Brand DNA] Homepage scraped: ${websiteContent.homepage.length} chars`);
        }

        stepsLog = logStep(stepsLog, 'scraping_homepage', 'completed', `Got ${websiteContent.homepage.length} chars`, stepStartTime);
        await updateStep(db, input.projectId, 'scraping_homepage', 25, `Homepage scraped (${Math.round(websiteContent.homepage.length / 1000)}KB)`, stepsLog);

        // ========== STEP 3: SCRAPING ABOUT PAGE (Smart Discovery) ==========
        stepStartTime = Date.now();
        stepsLog = logStep(stepsLog, 'scraping_about', 'started', 'Smart-searching for About/Company page');
        await updateStep(db, input.projectId, 'scraping_about', 30, 'Finding About page (checking links)...', stepsLog);

        if (crawlResults.about) {
          websiteContent.about = crawler.cleanMarkdown(crawlResults.about.markdown);
          websiteContent.aboutSource = crawlResults.aboutSource;
          console.log(`[Brand DNA] About page found via ${crawlResults.aboutSource}: ${websiteContent.about.length} chars`);
        }

        const aboutMsg = websiteContent.about
          ? `Found: ${websiteContent.aboutSource} (${Math.round(websiteContent.about.length / 1000)}KB)`
          : 'No About page found';
        stepsLog = logStep(stepsLog, 'scraping_about', 'completed', aboutMsg, stepStartTime);
        await updateStep(db, input.projectId, 'scraping_about', 40, aboutMsg, stepsLog);

      } catch (scrapeError) {
        console.warn(`[Brand DNA] Failed to scrape website:`, scrapeError);
        stepsLog = logStep(stepsLog, 'scraping_homepage', 'completed', 'Scraping failed, continuing without website', stepStartTime);
        stepsLog = logStep(stepsLog, 'scraping_about', 'completed', 'Skipped', stepStartTime);
        await updateStep(db, input.projectId, 'scraping_about', 40, 'Website unavailable, using search data', stepsLog);
      }
    } else {
      stepsLog = logStep(stepsLog, 'scraping_homepage', 'completed', 'No domain provided');
      stepsLog = logStep(stepsLog, 'scraping_about', 'completed', 'Skipped');
      await updateStep(db, input.projectId, 'scraping_about', 40, 'No domain provided', stepsLog);
    }

    // ========== STEP 4: WEB RESEARCH ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'researching', 'started', 'Searching the web for brand information');
    await updateStep(db, input.projectId, 'researching', 45, 'Researching brand online...', stepsLog);

    const searchQueries = [
      `${input.brandName} company mission values`,
      `${input.brandName} ${input.industry || ''} about`,
      `${input.brandName} reviews what customers say`,
      `${input.brandName} news 2025 2024`,
    ];

    console.log(`[Brand DNA] Researching with ${searchQueries.length} search queries`);
    const searchResults = await researchTopic(searchQueries);
    totalCost += 0.002 * searchQueries.length;

    stepsLog = logStep(stepsLog, 'researching', 'completed', `Found ${searchQueries.length * 5} results`, stepStartTime);
    await updateStep(db, input.projectId, 'researching', 55, `Web research complete (${searchQueries.length} queries)`, stepsLog);

    // ========== STEP 5: AI ANALYSIS (Claude Opus 4.5) ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'analyzing', 'started', 'Processing with Claude Opus 4.5');
    await updateStep(db, input.projectId, 'analyzing', 60, 'AI analyzing data with Claude Opus 4.5...', stepsLog);

    await db.query(
      `UPDATE brand_dna SET status = 'analyzing', updated_at = NOW() WHERE project_id = $1`,
      [input.projectId]
    );

    const synthesisPrompt = `Analyze this brand and create a comprehensive Brand DNA profile.

## BRAND: ${input.brandName}
${input.domain ? `## WEBSITE: ${input.domain}` : ''}
${input.industry ? `## INDUSTRY: ${input.industry}` : ''}

## WEBSITE CONTENT (Homepage):
${websiteContent.homepage.slice(0, 8000) || 'Not available'}

## WEBSITE CONTENT (About Page):
${websiteContent.about?.slice(0, 4000) || 'Not available'}

## SEARCH RESEARCH:
${searchResults.slice(0, 6000)}

Based on all this information, create a detailed Brand DNA profile. Be specific and cite evidence from the content.`;

    console.log(`[Brand DNA] Synthesizing with Claude Opus 4.5...`);

    // Use Claude Opus 4.5 for best quality analysis
    const { data: brandData, usage } = await getStructuredResponse<{
      missionVision: string;
      brandValues: Array<{ value: string; description: string }>;
      brandPositioning: string;
      uniqueDifferentiators: string[];
      targetMarket: string;
      brandVoice: string;
      companyStory: string;
      keyMilestones?: string[];
      brandKeywords?: string[];
    }>(synthesisPrompt, BRAND_DNA_JSON_SCHEMA, 'anthropic/claude-3.5-sonnet'); // Will update to Opus when available on OpenRouter

    totalCost += usage.estimatedCost;
    console.log(`[Brand DNA] Analysis complete. Tokens: ${usage.totalTokens}, Cost: $${usage.estimatedCost.toFixed(4)}`);

    stepsLog = logStep(stepsLog, 'analyzing', 'completed', `Used ${usage.totalTokens} tokens`, stepStartTime);
    await updateStep(db, input.projectId, 'analyzing', 75, `Analysis complete (${usage.totalTokens} tokens)`, stepsLog);

    // ========== STEP 6: GENERATING REPORT ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'generating_report', 'started', 'Creating comprehensive report');
    await updateStep(db, input.projectId, 'generating_report', 80, 'Generating Brand DNA report...', stepsLog);

    const fullReport = generateBrandReport(input.brandName, brandData);
    console.log(`[Brand DNA] Report generated: ${fullReport.length} chars`);

    stepsLog = logStep(stepsLog, 'generating_report', 'completed', `Report: ${Math.round(fullReport.length / 1000)}KB`, stepStartTime);
    await updateStep(db, input.projectId, 'generating_report', 90, 'Report generated', stepsLog);

    // ========== STEP 7: SAVING RESULTS ==========
    stepStartTime = Date.now();
    stepsLog = logStep(stepsLog, 'saving', 'started', 'Storing to database');
    await updateStep(db, input.projectId, 'saving', 92, 'Saving results to database...', stepsLog);

    const result = await db.query(
      `UPDATE brand_dna SET
        website_content = $2,
        about_page_content = $3,
        raw_research = $4,
        mission_vision = $5,
        brand_values = $6,
        brand_positioning = $7,
        unique_differentiators = $8,
        target_market = $9,
        brand_voice = $10,
        company_story = $11,
        key_milestones = $12,
        brand_keywords = $13,
        full_report = $14,
        status = 'completed',
        current_step = 'completed',
        step_progress = 100,
        step_message = 'Analysis complete',
        api_cost = $15,
        model_used = 'claude-opus-4.5',
        steps_log = $16,
        updated_at = NOW()
      WHERE project_id = $1
      RETURNING id`,
      [
        input.projectId,
        websiteContent.homepage,
        websiteContent.about,
        JSON.stringify({ searchResults, queries: searchQueries }),
        brandData.missionVision,
        JSON.stringify(brandData.brandValues),
        brandData.brandPositioning,
        JSON.stringify(brandData.uniqueDifferentiators),
        brandData.targetMarket,
        brandData.brandVoice,
        brandData.companyStory,
        JSON.stringify(brandData.keyMilestones || []),
        JSON.stringify(brandData.brandKeywords || []),
        fullReport,
        totalCost,
        JSON.stringify(logStep(stepsLog, 'saving', 'completed', 'All data saved', stepStartTime)),
      ]
    );

    // ========== STEP 8: COMPLETED ==========
    const totalDuration = Date.now() - analysisStartTime;
    console.log(`[Brand DNA] Analysis complete for ${input.brandName}. Duration: ${totalDuration}ms, Cost: $${totalCost.toFixed(4)}`);

    await updateStep(db, input.projectId, 'completed', 100, `Complete in ${Math.round(totalDuration / 1000)}s`, stepsLog);

    return {
      success: true,
      brandDnaId: result.rows[0]?.id,
      report: {
        missionVision: brandData.missionVision,
        brandValues: brandData.brandValues,
        brandPositioning: brandData.brandPositioning,
        uniqueDifferentiators: brandData.uniqueDifferentiators,
        targetMarket: brandData.targetMarket,
        brandVoice: brandData.brandVoice,
        companyStory: brandData.companyStory,
      },
      cost: totalCost,
    };
  } catch (error) {
    console.error(`[Brand DNA] Error:`, error);

    // Update status to failed
    stepsLog = logStep(stepsLog, 'failed', 'failed', error instanceof Error ? error.message : 'Unknown error');

    await db.query(
      `UPDATE brand_dna SET
        status = 'failed',
        current_step = 'failed',
        step_message = $2,
        error_message = $2,
        api_cost = $3,
        steps_log = $4,
        updated_at = NOW()
      WHERE project_id = $1`,
      [input.projectId, error instanceof Error ? error.message : 'Unknown error', totalCost, JSON.stringify(stepsLog)]
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      cost: totalCost,
    };
  }
}

function generateBrandReport(brandName: string, data: {
  missionVision: string;
  brandValues: Array<{ value: string; description: string }>;
  brandPositioning: string;
  uniqueDifferentiators: string[];
  targetMarket: string;
  brandVoice: string;
  companyStory: string;
  keyMilestones?: string[];
  brandKeywords?: string[];
}): string {
  return `# Brand DNA: ${brandName}

## Mission & Vision
${data.missionVision}

## Brand Positioning
> ${data.brandPositioning}

## Core Values
${data.brandValues.map(v => `### ${v.value}\n${v.description}`).join('\n\n')}

## Unique Differentiators
${data.uniqueDifferentiators.map(d => `- ${d}`).join('\n')}

## Target Market
${data.targetMarket}

## Brand Voice
${data.brandVoice}

## Company Story
${data.companyStory}

${data.keyMilestones && data.keyMilestones.length > 0 ? `## Key Milestones\n${data.keyMilestones.map(m => `- ${m}`).join('\n')}` : ''}

${data.brandKeywords && data.brandKeywords.length > 0 ? `## Brand Keywords\n${data.brandKeywords.map(k => `\`${k}\``).join(', ')}` : ''}

---
*Generated by Quick Ads AI Intelligence using Claude Opus 4.5*
`;
}

// Quick function to check if OpenRouter is configured
export function isOpenRouterConfigured(): boolean {
  return openrouter.isConfigured();
}

// Quick function to check if Crawl4AI is configured
export function isCrawl4AIConfigured(): boolean {
  return crawl4ai.isConfigured();
}
